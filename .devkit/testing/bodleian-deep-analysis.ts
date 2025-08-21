import https from 'https';

interface IIIFService {
    '@context'?: string;
    '@id': string;
    '@type'?: string;
    profile?: string[];
}

interface IIIFResource {
    '@id': string;
    '@type': string;
    service?: IIIFService;
}

interface IIIFImage {
    '@type': string;
    resource: IIIFResource;
}

interface IIIFCanvas {
    '@id': string;
    '@type': string;
    label?: any;
    images?: IIIFImage[];
    items?: any[];
}

interface IIIFSequence {
    '@type': string;
    canvases: IIIFCanvas[];
}

interface IIIFManifest {
    '@context': string;
    '@id': string;
    '@type': string;
    label?: any;
    sequences?: IIIFSequence[];
    items?: any[];
}

async function fetchWithSSLBypass(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const options = {
            rejectUnauthorized: false
        };
        
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    console.log('Raw response:', data.substring(0, 500));
                    reject(new Error('Failed to parse JSON: ' + e));
                }
            });
        }).on('error', reject);
    });
}

function localizedStringToString(value: any): string {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value[0];
    if (typeof value === 'object' && value !== null) {
        return value.en?.[0] || value['@value'] || Object.values(value)[0];
    }
    return '';
}

async function testBodleianManuscript(testUrl: string) {
    console.log('\n' + '='.repeat(80));
    console.log(`🔍 TESTING BODLEIAN MANUSCRIPT: ${testUrl}`);
    console.log('='.repeat(80));
    
    try {
        // Step 1: Extract object ID using current logic
        console.log('\n📋 STEP 1: URL ANALYSIS');
        const match = testUrl.match(/objects\/([^/?]+)/);
        if (!match) throw new Error('❌ Invalid Bodleian URL - no objects/ pattern found');
        
        const objectId = match[1];
        console.log(`✅ Object ID extracted: ${objectId}`);
        
        // Step 2: Construct manifest URL
        const manifestUrl = `https://iiif.bodleian.ox.ac.uk/iiif/manifest/${objectId}.json`;
        console.log(`✅ Manifest URL: ${manifestUrl}`);
        
        // Step 3: Fetch manifest
        console.log('\n📋 STEP 2: MANIFEST FETCHING');
        console.log('Fetching with SSL bypass...');
        
        let manifest: IIIFManifest;
        try {
            manifest = await fetchWithSSLBypass(manifestUrl);
            console.log(`✅ Manifest fetched successfully`);
            console.log(`📊 Manifest type: ${manifest['@type']}`);
            console.log(`📊 Context: ${manifest['@context']}`);
            if (manifest.label) {
                console.log(`📊 Title: ${localizedStringToString(manifest.label)}`);
            }
        } catch (fetchError) {
            console.log(`❌ Manifest fetch failed: ${fetchError}`);
            return;
        }
        
        // Step 4: Analyze manifest structure
        console.log('\n📋 STEP 3: MANIFEST STRUCTURE ANALYSIS');
        console.log(`Has sequences: ${!!manifest.sequences}`);
        console.log(`Has items (v3): ${!!manifest.items}`);
        
        if (manifest.sequences) {
            console.log(`Sequences count: ${manifest.sequences.length}`);
            if (manifest.sequences[0]) {
                console.log(`First sequence canvases: ${manifest.sequences[0].canvases?.length || 0}`);
            }
        }
        
        if (manifest.items) {
            console.log(`Items count: ${manifest.items.length}`);
        }
        
        // Step 5: Process images using current logic
        console.log('\n📋 STEP 4: IMAGE EXTRACTION TEST');
        const images: any[] = [];
        let processingMethod = '';
        
        // Test IIIF v2 processing (current logic)
        if (manifest.sequences?.[0]?.canvases) {
            processingMethod = 'IIIF v2 (sequences/canvases)';
            const canvases = manifest.sequences[0].canvases;
            console.log(`Processing ${canvases.length} canvases with IIIF v2 logic`);
            
            const maxPages = Math.min(10, canvases.length); // Test first 10 pages
            console.log(`Testing first ${maxPages} pages:`);
            
            for (let i = 0; i < maxPages; i++) {
                const canvas = canvases[i];
                console.log(`\n  Page ${i + 1}:`);
                console.log(`    Canvas ID: ${canvas['@id']}`);
                console.log(`    Has images: ${!!canvas.images}`);
                console.log(`    Images count: ${canvas.images?.length || 0}`);
                
                if (canvas && canvas.images && canvas.images[0] && canvas.images[0].resource) {
                    const resource = canvas.images[0].resource;
                    const service = resource.service;
                    
                    console.log(`    Resource ID: ${resource['@id']}`);
                    console.log(`    Has service: ${!!service}`);
                    
                    if (service && (service as IIIFService)['@id']) {
                        const serviceId = (service as IIIFService)['@id'];
                        const imageUrl = `${serviceId}/full/full/0/default.jpg`;
                        console.log(`    ✅ Generated image URL: ${imageUrl}`);
                        
                        images.push({
                            url: imageUrl,
                            filename: `page_${String(i + 1).padStart(3, '0')}.jpg`,
                            pageNumber: i + 1
                        });
                    } else {
                        console.log(`    ❌ No service @id found`);
                        console.log(`    Service structure:`, JSON.stringify(service, null, 4));
                    }
                } else {
                    console.log(`    ❌ Canvas structure issue`);
                    console.log(`    Canvas structure:`, JSON.stringify(canvas, null, 2).substring(0, 500));
                }
            }
        }
        // Test IIIF v3 processing (current logic)
        else if (manifest.items) {
            processingMethod = 'IIIF v3 (items)';
            console.log(`Processing ${manifest.items.length} items with IIIF v3 logic`);
            
            const maxPages = Math.min(10, manifest.items.length);
            console.log(`Testing first ${maxPages} pages:`);
            
            for (let i = 0; i < maxPages; i++) {
                const item = manifest.items[i];
                console.log(`\n  Page ${i + 1}:`);
                console.log(`    Item ID: ${item.id}`);
                console.log(`    Has items: ${!!item.items}`);
                
                if (item.items && item.items[0] && item.items[0].items && item.items[0].items[0]) {
                    const annotation = item.items[0].items[0];
                    const body = Array.isArray(annotation.body) ? annotation.body[0] : annotation.body;
                    console.log(`    Has annotation body: ${!!body}`);
                    
                    if (body && body.service) {
                        const service = Array.isArray(body.service) ? body.service[0] : body.service;
                        console.log(`    Service ID: ${service.id || service['@id']}`);
                        
                        if (service.id || service['@id']) {
                            const serviceId = service.id || service['@id'];
                            const imageUrl = `${serviceId}/full/full/0/default.jpg`;
                            console.log(`    ✅ Generated image URL: ${imageUrl}`);
                            
                            images.push({
                                url: imageUrl,
                                filename: `page_${String(i + 1).padStart(3, '0')}.jpg`,
                                pageNumber: i + 1
                            });
                        }
                    } else {
                        console.log(`    ❌ No service found in body`);
                        console.log(`    Body structure:`, JSON.stringify(body, null, 2).substring(0, 300));
                    }
                } else {
                    console.log(`    ❌ Item structure issue`);
                    console.log(`    Item structure:`, JSON.stringify(item, null, 2).substring(0, 500));
                }
            }
        } else {
            console.log('❌ No sequences or items found in manifest');
        }
        
        // Step 6: Results summary
        console.log('\n📋 STEP 5: RESULTS SUMMARY');
        console.log(`Processing method: ${processingMethod}`);
        console.log(`Images extracted: ${images.length}`);
        console.log(`Expected to fail with "No images found": ${images.length === 0 ? 'YES' : 'NO'}`);
        
        if (images.length > 0) {
            console.log('\n📋 SAMPLE EXTRACTED IMAGES:');
            images.slice(0, 3).forEach((img, idx) => {
                console.log(`  ${idx + 1}. ${img.filename}: ${img.url}`);
            });
        }
        
        // Step 7: Test actual image URLs
        if (images.length > 0) {
            console.log('\n📋 STEP 6: IMAGE URL VALIDATION');
            console.log('Testing first image URL...');
            
            try {
                const testImageUrl = images[0].url;
                const response = await new Promise<{statusCode?: number, headers: any}>((resolve, reject) => {
                    https.get(testImageUrl, {rejectUnauthorized: false}, (res) => {
                        resolve({statusCode: res.statusCode, headers: res.headers});
                        res.destroy(); // Don't download full image
                    }).on('error', reject);
                });
                
                console.log(`✅ Image URL test: HTTP ${response.statusCode}`);
                console.log(`✅ Content-Type: ${response.headers['content-type']}`);
                
                if (response.statusCode === 200) {
                    console.log('🎉 Image URLs are working correctly!');
                } else {
                    console.log('⚠️  Image URLs may have issues');
                }
            } catch (imageError) {
                console.log(`❌ Image URL test failed: ${imageError}`);
            }
        }
        
    } catch (error) {
        console.log(`\n❌ CRITICAL ERROR: ${error}`);
        console.log(`This would cause "No pages found" error in the app`);
    }
}

async function main() {
    console.log('🔍 BODLEIAN LIBRARY DEEP ANALYSIS');
    console.log('Testing current implementation with real manuscripts');
    
    // Test multiple Bodleian manuscripts
    const testUrls = [
        'https://digital.bodleian.ox.ac.uk/objects/748a9d50-c42c-48b5-b3c3-7cf0a4a76ee2/',
        'https://digital.bodleian.ox.ac.uk/objects/c05d4ab5-c21e-42cd-ae70-2a04e5e8ebda/',
        'https://digital.bodleian.ox.ac.uk/objects/2c26cf9c-1b37-4e51-b7d4-b9d8ec04a59a/'
    ];
    
    for (const testUrl of testUrls) {
        await testBodleianManuscript(testUrl);
        console.log('\n' + '⏸️'.repeat(10) + ' PAUSE BETWEEN TESTS ' + '⏸️'.repeat(10));
        await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause
    }
    
    console.log('\n🏁 ANALYSIS COMPLETE');
    console.log('Check above for specific failure points and root causes');
}

main().catch(console.error);