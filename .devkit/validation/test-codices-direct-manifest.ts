#!/usr/bin/env bun

/**
 * Direct Codices IIIF Manifest Test
 * Tests the known manifest URL to understand the structure
 */

const KNOWN_MANIFEST_URL = 'https://admont.codices.at/iiif/9cec1d04-d5c3-4a2a-9aa8-4279b359e701';

async function testDirectManifest() {
    console.log('🧪 Testing Codices Direct IIIF Manifest\n');
    console.log(`📖 Manifest URL: ${KNOWN_MANIFEST_URL}`);

    try {
        const response = await fetch(KNOWN_MANIFEST_URL);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const manifest = await response.json();
        
        console.log('\n📋 Manifest Details:');
        console.log(`Type: ${manifest.type || manifest['@type']}`);
        console.log(`Context: ${manifest['@context']}`);
        console.log(`ID: ${manifest.id || manifest['@id']}`);
        
        // Extract title
        let title = 'Unknown';
        if (manifest.label) {
            if (typeof manifest.label === 'string') {
                title = manifest.label;
            } else if (manifest.label.en) {
                title = manifest.label.en[0] || title;
            } else if (manifest.label.de) {
                title = manifest.label.de[0] || title;
            } else {
                const firstLang = Object.keys(manifest.label)[0];
                if (firstLang && manifest.label[firstLang].length > 0) {
                    title = manifest.label[firstLang][0];
                }
            }
        }
        console.log(`Title: ${title}`);

        // Count pages
        let pageCount = 0;
        const pageUrls: string[] = [];

        if (manifest.items) {
            // IIIF v3
            for (const canvas of manifest.items) {
                pageCount++;
                
                // Extract image URL from canvas
                if (canvas.items) {
                    for (const annotationPage of canvas.items) {
                        if (annotationPage.items) {
                            for (const annotation of annotationPage.items) {
                                if (annotation.body && annotation.body.service) {
                                    const services = Array.isArray(annotation.body.service) ? 
                                        annotation.body.service : [annotation.body.service];
                                    
                                    for (const service of services) {
                                        const serviceId = service.id || service['@id'];
                                        if (serviceId) {
                                            const fullResUrl = `${serviceId}/full/full/0/default.jpg`;
                                            pageUrls.push(fullResUrl);
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } else if (manifest.sequences) {
            // IIIF v2 fallback
            for (const sequence of manifest.sequences) {
                if (sequence.canvases) {
                    for (const canvas of sequence.canvases) {
                        pageCount++;
                        
                        if (canvas.images) {
                            for (const image of canvas.images) {
                                if (image.resource && image.resource.service) {
                                    const serviceId = image.resource.service['@id'] || image.resource.service.id;
                                    if (serviceId) {
                                        pageUrls.push(`${serviceId}/full/full/0/default.jpg`);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        console.log(`\n📊 Pages: ${pageCount}`);
        console.log(`🖼️  Extracted URLs: ${pageUrls.length}`);

        if (pageUrls.length > 0) {
            console.log('\n🎯 Sample Image URLs:');
            pageUrls.slice(0, 3).forEach((url, i) => {
                console.log(`  ${i + 1}. ${url}`);
            });

            // Test first image URL
            console.log('\n🧪 Testing first image URL...');
            const firstImageResponse = await fetch(pageUrls[0], { method: 'HEAD' });
            console.log(`Status: ${firstImageResponse.status} ${firstImageResponse.statusText}`);
            console.log(`Content-Type: ${firstImageResponse.headers.get('content-type')}`);
            console.log(`Content-Length: ${firstImageResponse.headers.get('content-length')} bytes`);
        }

        // Test the info.json endpoint if we have service URLs
        if (pageUrls.length > 0) {
            const firstServiceUrl = pageUrls[0].replace('/full/full/0/default.jpg', '');
            const infoUrl = `${firstServiceUrl}/info.json`;
            
            console.log(`\n🔍 Testing info.json: ${infoUrl}`);
            try {
                const infoResponse = await fetch(infoUrl);
                if (infoResponse.ok) {
                    const info = await infoResponse.json();
                    console.log(`✅ Info.json available`);
                    console.log(`   Width: ${info.width}px`);
                    console.log(`   Height: ${info.height}px`);
                    console.log(`   Profile: ${info.profile}`);
                } else {
                    console.log(`❌ Info.json failed: ${infoResponse.status}`);
                }
            } catch (error) {
                console.log(`❌ Info.json error: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        console.log('\n✅ ANALYSIS COMPLETE');
        console.log(`✅ Manifest is valid IIIF with ${pageCount} pages`);
        console.log(`✅ Image URLs can be extracted successfully`);
        
        return {
            success: true,
            title,
            pageCount,
            pageUrls: pageUrls.slice(0, 5) // First 5 for analysis
        };

    } catch (error) {
        console.log(`❌ ERROR: ${error instanceof Error ? error.message : String(error)}`);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

// Run the test
testDirectManifest().then(result => {
    if (result.success) {
        console.log('\n🎯 Implementation Status: CodicesLoader should work with direct manifest URLs');
        console.log('📝 Next: Need to implement URL-to-manifest mapping logic');
    } else {
        console.log('\n❌ Implementation Status: Need to fix manifest parsing');
    }
}).catch(console.error);