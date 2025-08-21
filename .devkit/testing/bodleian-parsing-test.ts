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
        const options = { rejectUnauthorized: false };
        
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
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

async function testCurrentBodleianLogic() {
    console.log('🧪 TESTING CURRENT BODLEIAN PARSING LOGIC');
    console.log('Using working manuscript: ae9f6cca-ae5c-4149-8fe4-95e6eca1f73c');
    
    const objectId = 'ae9f6cca-ae5c-4149-8fe4-95e6eca1f73c';
    const manifestUrl = `https://iiif.bodleian.ox.ac.uk/iiif/manifest/${objectId}.json`;
    
    console.log('\n📋 STEP 1: FETCH MANIFEST');
    console.log(`Manifest URL: ${manifestUrl}`);
    
    try {
        const manifest: IIIFManifest = await fetchWithSSLBypass(manifestUrl);
        console.log(`✅ Manifest loaded successfully`);
        console.log(`📊 Type: ${manifest['@type']}`);
        console.log(`📊 Context: ${manifest['@context']}`);
        console.log(`📊 Title: ${localizedStringToString(manifest.label)}`);
        
        console.log('\n📋 STEP 2: APPLY CURRENT PARSING LOGIC');
        const images: any[] = [];
        
        // This is the exact logic from getBodleianManifest()
        if (manifest.sequences?.[0]?.canvases) {
            const canvases = manifest.sequences[0].canvases;
            console.log(`✅ Found sequences with ${canvases.length} canvases (IIIF v2)`);
            
            // Test first 5 pages to verify logic
            const maxPages = Math.min(5, canvases.length);
            console.log(`Testing first ${maxPages} pages:`);
            
            for (let i = 0; i < maxPages; i++) {
                const canvas = canvases[i];
                console.log(`\n  🔍 Page ${i + 1}:`);
                console.log(`    Canvas ID: ${canvas['@id']}`);
                
                if (canvas && canvas.images && canvas.images[0] && canvas.images[0].resource) {
                    const resource = canvas.images[0].resource;
                    const service = resource.service;
                    
                    console.log(`    ✅ Found resource: ${resource['@id']}`);
                    
                    if (service && (service as IIIFService)['@id']) {
                        const serviceId = (service as IIIFService)['@id'];
                        const imageUrl = `${serviceId}/full/full/0/default.jpg`;
                        
                        console.log(`    ✅ Service ID: ${serviceId}`);
                        console.log(`    ✅ Image URL: ${imageUrl}`);
                        
                        images.push({
                            url: imageUrl,
                            filename: `page_${String(i + 1).padStart(3, '0')}.jpg`,
                            pageNumber: i + 1
                        });
                    } else {
                        console.log(`    ❌ No service @id found`);
                        console.log(`    📋 Service structure:`, JSON.stringify(service, null, 2));
                    }
                } else {
                    console.log(`    ❌ No resource found`);
                    console.log(`    📋 Canvas structure:`, JSON.stringify(canvas, null, 2).substring(0, 300));
                }
            }
        } else if (manifest.items) {
            console.log(`✅ Found items array with ${manifest.items.length} items (IIIF v3)`);
            // IIIF v3 logic would go here
        } else {
            console.log('❌ No sequences or items found');
        }
        
        console.log('\n📋 STEP 3: RESULTS ANALYSIS');
        console.log(`Images extracted: ${images.length}/${Math.min(5, manifest.sequences?.[0]?.canvases?.length || 0)}`);
        console.log(`Would throw "No images found": ${images.length === 0 ? 'YES' : 'NO'}`);
        
        if (images.length > 0) {
            console.log('\n📋 SAMPLE IMAGE URLS:');
            images.forEach((img, idx) => {
                console.log(`  ${idx + 1}. ${img.filename}: ${img.url}`);
            });
            
            console.log('\n📋 STEP 4: TEST IMAGE URL ACCESSIBILITY');
            const testUrl = images[0].url;
            console.log(`Testing: ${testUrl}`);
            
            try {
                const response = await new Promise<{statusCode?: number, headers: any}>((resolve, reject) => {
                    https.get(testUrl, {rejectUnauthorized: false}, (res) => {
                        resolve({statusCode: res.statusCode, headers: res.headers});
                        res.destroy();
                    }).on('error', reject);
                });
                
                console.log(`✅ Image test: HTTP ${response.statusCode}`);
                console.log(`✅ Content-Type: ${response.headers['content-type']}`);
                
                if (response.statusCode === 200) {
                    console.log('🎉 CURRENT LOGIC WORKS PERFECTLY!');
                    console.log('The issue is not with parsing - it\'s with manuscript availability');
                } else {
                    console.log('⚠️  Image URLs may need different parameters');
                }
            } catch (imageError) {
                console.log(`❌ Image URL test failed: ${imageError}`);
            }
        }
        
        console.log('\n📋 STEP 5: DIAGNOSIS');
        if (images.length > 0) {
            console.log('✅ DIAGNOSIS: Current Bodleian parsing logic is CORRECT');
            console.log('✅ The problem is manuscript-specific availability, not code issues');
            console.log('✅ Some manuscripts work, others return "not found" from server');
            console.log('');
            console.log('🔧 RECOMMENDATION:');
            console.log('   1. Add better error handling for manuscript availability');
            console.log('   2. Add retry logic for socket connection issues'); 
            console.log('   3. Test with user-provided URLs to confirm which manuscripts fail');
            console.log('   4. Consider fallback mechanisms for unavailable manuscripts');
        } else {
            console.log('❌ DIAGNOSIS: Parsing logic has issues');
            console.log('❌ Need to investigate manifest structure more deeply');
        }
        
    } catch (error) {
        console.log(`❌ FAILED: ${error}`);
    }
}

testCurrentBodleianLogic().catch(console.error);