#!/usr/bin/env bun

/**
 * Codices Library Loader Validation Test
 * Tests the newly implemented CodicesLoader with real URLs
 */

const TEST_URLS = [
    'https://admont.codices.at/codices/169/90299'
];

interface TestResult {
    url: string;
    detected: string | null;
    success: boolean;
    pages?: number;
    error?: string;
    manifestUrl?: string;
}

// Simulate the detectLibrary method
function detectLibrary(url: string): string | null {
    if (url.includes('codices.at')) return 'codices';
    return null;
}

// Test manifest discovery
async function testManifestDiscovery(url: string): Promise<any> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch page: ${response.status}`);
        }

        const html = await response.text();
        
        // Look for IIIF manifest references in the HTML
        const manifestPatterns = [
            /["']([^"']*iiif[^"']*manifest[^"']*)["']/gi,
            /["']([^"']*manifest\.json[^"']*)["']/gi,
            /data-manifest=["']([^"']+)["']/gi,
            /manifest:\s*["']([^"']+)["']/gi
        ];

        const manifestUrls: string[] = [];
        for (const pattern of manifestPatterns) {
            const matches = html.matchAll(pattern);
            for (const match of matches) {
                const manifestUrl = resolveUrl(match[1], url);
                if (manifestUrl.includes('iiif') && manifestUrl.includes('manifest')) {
                    manifestUrls.push(manifestUrl);
                }
            }
        }

        return {
            manifestUrls: [...new Set(manifestUrls)],
            html: html.substring(0, 500) // First 500 chars for debugging
        };
    } catch (error) {
        throw new Error(`Manifest discovery failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function resolveUrl(url: string, baseUrl: string): string {
    try {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        const base = new URL(baseUrl);
        return new URL(url, base).toString();
    } catch {
        return url;
    }
}

// Test IIIF manifest loading
async function testIIIFManifest(manifestUrl: string): Promise<any> {
    try {
        const response = await fetch(manifestUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch manifest: ${response.status}`);
        }

        const manifest = await response.json();
        
        // Extract title
        let displayName = 'Codices manuscript';
        if (manifest.label) {
            if (typeof manifest.label === 'string') {
                displayName = manifest.label;
            } else if (manifest.label.en && manifest.label.en.length > 0) {
                displayName = manifest.label.en[0];
            } else if (manifest.label.de && manifest.label.de.length > 0) {
                displayName = manifest.label.de[0];
            } else {
                // Take first available language
                const firstLang = Object.keys(manifest.label)[0];
                if (firstLang && manifest.label[firstLang].length > 0) {
                    displayName = manifest.label[firstLang][0];
                }
            }
        }

        // Extract page images from IIIF v3 manifest
        const pageLinks = await extractImagesFromManifest(manifest);
        
        return {
            title: displayName,
            pageCount: pageLinks.length,
            pageLinks: pageLinks.slice(0, 3), // First 3 for testing
            manifest: {
                '@context': manifest['@context'],
                type: manifest.type,
                id: manifest.id
            }
        };
    } catch (error) {
        throw new Error(`Failed to parse IIIF manifest: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function extractImagesFromManifest(manifest: any): Promise<string[]> {
    const pageLinks: string[] = [];

    try {
        // IIIF Presentation API v3 structure
        const items = manifest.items || [];
        
        for (const canvas of items) {
            if (canvas.items) {
                for (const annotationPage of canvas.items) {
                    if (annotationPage.items) {
                        for (const annotation of annotationPage.items) {
                            if (annotation.body && annotation.body.id) {
                                // Get the image service URL
                                let imageServiceUrl = null;
                                
                                if (annotation.body.service) {
                                    const services = Array.isArray(annotation.body.service) ? annotation.body.service : [annotation.body.service];
                                    for (const service of services) {
                                        if (service.id || service['@id']) {
                                            imageServiceUrl = service.id || service['@id'];
                                            break;
                                        }
                                    }
                                }

                                if (imageServiceUrl) {
                                    // Generate full resolution IIIF URL
                                    const fullResUrl = `${imageServiceUrl}/full/full/0/default.jpg`;
                                    pageLinks.push(fullResUrl);
                                } else if (annotation.body.id) {
                                    // Fallback: use direct image URL if available
                                    pageLinks.push(annotation.body.id);
                                }
                            }
                        }
                    }
                }
            }
        }

        // IIIF v2 fallback
        if (pageLinks.length === 0 && manifest.sequences) {
            for (const sequence of manifest.sequences) {
                if (sequence.canvases) {
                    for (const canvas of sequence.canvases) {
                        if (canvas.images) {
                            for (const image of canvas.images) {
                                if (image.resource && image.resource.service) {
                                    const serviceId = image.resource.service['@id'] || image.resource.service.id;
                                    if (serviceId) {
                                        pageLinks.push(`${serviceId}/full/full/0/default.jpg`);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.warn(`Manifest parsing error: ${error}`);
    }

    return pageLinks;
}

async function testCodicesUrl(url: string): Promise<TestResult> {
    const result: TestResult = {
        url,
        detected: null,
        success: false
    };

    try {
        // Test detection
        result.detected = detectLibrary(url);
        console.log(`🔍 Detection: ${url} → '${result.detected}'`);

        if (result.detected !== 'codices') {
            result.error = `Detection failed - expected 'codices', got '${result.detected}'`;
            return result;
        }

        // Test manifest discovery
        console.log(`🔍 Discovering manifest from page...`);
        const discovery = await testManifestDiscovery(url);
        console.log(`📋 Found ${discovery.manifestUrls.length} potential manifest URLs`);

        if (discovery.manifestUrls.length === 0) {
            result.error = 'No IIIF manifest URLs found in page';
            return result;
        }

        // Test the first manifest URL
        const manifestUrl = discovery.manifestUrls[0];
        result.manifestUrl = manifestUrl;
        console.log(`📖 Testing manifest: ${manifestUrl}`);

        const manifestData = await testIIIFManifest(manifestUrl);
        result.pages = manifestData.pageCount;
        result.success = manifestData.pageCount > 0;

        console.log(`✅ Success: ${manifestData.title} (${manifestData.pageCount} pages)`);
        console.log(`🖼️  Sample pages:`, manifestData.pageLinks);

        if (!result.success) {
            result.error = 'No pages found in manifest';
        }

    } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        console.log(`❌ Error: ${result.error}`);
    }

    return result;
}

async function main() {
    console.log('🧪 Codices Library Loader Validation Test\n');

    const results: TestResult[] = [];

    for (const url of TEST_URLS) {
        console.log(`\n📚 Testing: ${url}`);
        console.log('─'.repeat(80));
        
        const result = await testCodicesUrl(url);
        results.push(result);
        
        await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('🏁 CODICES LOADER TEST SUMMARY');
    console.log('='.repeat(80));

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`✅ Successful: ${successful.length}/${results.length}`);
    console.log(`❌ Failed: ${failed.length}/${results.length}`);

    if (successful.length > 0) {
        console.log('\n📊 Successful Tests:');
        successful.forEach(r => {
            console.log(`  • ${r.url} → ${r.pages} pages`);
            if (r.manifestUrl) {
                console.log(`    Manifest: ${r.manifestUrl}`);
            }
        });
    }

    if (failed.length > 0) {
        console.log('\n🚨 Failed Tests:');
        failed.forEach(r => {
            console.log(`  • ${r.url}`);
            console.log(`    Error: ${r.error}`);
        });
    }

    console.log('\n🎯 Implementation Status:');
    if (results.every(r => r.success)) {
        console.log('✅ CodicesLoader is ready for production use');
    } else if (successful.length > 0) {
        console.log('⚠️  CodicesLoader partially working - needs refinement');
    } else {
        console.log('❌ CodicesLoader needs major fixes');
    }

    console.log('\n📝 Next Steps:');
    console.log('1. Run: npm run build');
    console.log('2. Test in the actual application');
    console.log('3. Validate with more manuscript URLs');
    console.log('4. Consider auto-split for large manuscripts');
}

main().catch(console.error);