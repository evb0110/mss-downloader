// BODLEIAN LIBRARY ENHANCED FIX
// Based on deep analysis findings - current parsing logic is correct,
// issue is with manuscript availability and error handling

import https from 'https';

interface ManuscriptImage {
    url: string;
    filename: string;
    pageNumber: number;
}

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

class BodleianManifestLoader {
    private maxRetries = 3;
    private retryDelayMs = 1000;

    async fetchWithRetryAndSSL(url: string, retryCount = 0): Promise<Response> {
        try {
            // Use Node.js https module for SSL bypass
            const response = await new Promise<{ok: boolean, status: number, json: () => Promise<any>, text: () => Promise<string>}>((resolve, reject) => {
                const options = {
                    rejectUnauthorized: false,
                    timeout: 30000
                };
                
                https.get(url, options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => data += chunk);
                    res.on('end', () => {
                        resolve({
                            ok: res.statusCode! >= 200 && res.statusCode! < 300,
                            status: res.statusCode!,
                            json: async () => JSON.parse(data),
                            text: async () => data
                        });
                    });
                }).on('error', reject).on('timeout', () => {
                    reject(new Error('Request timeout'));
                });
            });
            
            return response as Response;
        } catch (error) {
            if (retryCount < this.maxRetries) {
                console.log(`[Bodleian] Retry ${retryCount + 1}/${this.maxRetries} after error:`, error);
                await new Promise(resolve => setTimeout(resolve, this.retryDelayMs * (retryCount + 1)));
                return this.fetchWithRetryAndSSL(url, retryCount + 1);
            }
            throw error;
        }
    }

    localizedStringToString(value: any): string {
        if (typeof value === 'string') return value;
        if (Array.isArray(value)) return value[0];
        if (typeof value === 'object' && value !== null) {
            return value.en?.[0] || value['@value'] || Object.values(value)[0];
        }
        return '';
    }

    async getBodleianManifest(url: string): Promise<{ images: ManuscriptImage[], displayName?: string } | ManuscriptImage[]> {
        console.log('[Bodleian] Processing URL:', url);
        
        // Enhanced URL validation
        const match = url.match(/objects\/([^/?]+)/);
        if (!match) {
            throw new Error('Invalid Bodleian URL format. Expected: https://digital.bodleian.ox.ac.uk/objects/{id}/');
        }
        
        const objectId = match[1];
        const manifestUrl = `https://iiif.bodleian.ox.ac.uk/iiif/manifest/${objectId}.json`;
        
        console.log('[Bodleian] Fetching IIIF manifest from:', manifestUrl);
        
        let response: Response;
        let manifest: IIIFManifest;
        
        try {
            response = await this.fetchWithRetryAndSSL(manifestUrl);
        } catch (error) {
            if (error.message.includes('timeout')) {
                throw new Error(`Bodleian Library connection timeout. The server may be experiencing high load. Please try again in a few minutes.`);
            } else if (error.message.includes('socket')) {
                throw new Error(`Bodleian Library connection failed. Please check your internet connection and try again.`);
            } else {
                throw new Error(`Bodleian Library server error: ${error.message}`);
            }
        }
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`Manuscript not found on Bodleian Library servers. Object ID '${objectId}' may not exist or may not be publicly available.`);
            } else if (response.status >= 500) {
                throw new Error(`Bodleian Library server error (${response.status}). Please try again later.`);
            } else {
                throw new Error(`Failed to fetch Bodleian manifest: HTTP ${response.status}`);
            }
        }
        
        try {
            // Check if response is actually JSON
            const responseText = await response.text();
            if (responseText.includes('An object of ID') && responseText.includes('was not found')) {
                throw new Error(`Manuscript '${objectId}' is not available in the Bodleian IIIF collection. It may be under processing, restricted access, or not yet digitized.`);
            }
            
            manifest = JSON.parse(responseText) as IIIFManifest;
        } catch (parseError) {
            if (parseError.message.includes('not available')) {
                throw parseError; // Re-throw our custom message
            }
            throw new Error(`Invalid IIIF manifest format from Bodleian Library. The server may be experiencing issues.`);
        }
        
        const images: ManuscriptImage[] = [];
        
        // Process IIIF v2 manifest (current format for Bodleian)
        if (manifest.sequences?.[0]?.canvases) {
            const canvases = manifest.sequences[0].canvases;
            console.log(`[Bodleian] Processing ${canvases.length} pages from IIIF v2 manifest`);
            
            for (let i = 0; i < canvases.length; i++) {
                const canvas = canvases[i];
                if (canvas && canvas.images && canvas.images[0] && canvas.images[0].resource) {
                    const resource = canvas.images[0].resource;
                    const service = resource.service;
                    
                    if (service && (service as IIIFService)['@id']) {
                        // Use maximum resolution available
                        const serviceId = (service as IIIFService)['@id'];
                        const imageUrl = `${serviceId}/full/full/0/default.jpg`;
                        
                        images.push({
                            url: imageUrl,
                            filename: `page_${String(i + 1).padStart(3, '0')}.jpg`,
                            pageNumber: i + 1
                        });
                    }
                }
            }
        }
        // Handle IIIF v3 if Bodleian upgrades (future-proofing)
        else if (manifest.items) {
            console.log(`[Bodleian] Processing ${manifest.items.length} items from IIIF v3 manifest`);
            
            for (let i = 0; i < manifest.items.length; i++) {
                const item = manifest.items[i] as IIIFCanvas;
                if (item.items && item.items[0] && item.items[0].items && item.items[0].items[0]) {
                    const annotation = item.items[0].items[0];
                    const body = Array.isArray(annotation.body) ? annotation.body[0] : annotation.body;
                    if (body && body.service && (Array.isArray(body.service) ? body.service[0] : body.service)) {
                        const service = Array.isArray(body.service) ? body.service[0] : body.service;
                        const serviceId = service.id || service['@id'];
                        
                        if (serviceId) {
                            const imageUrl = `${serviceId}/full/full/0/default.jpg`;
                            images.push({
                                url: imageUrl,
                                filename: `page_${String(i + 1).padStart(3, '0')}.jpg`,
                                pageNumber: i + 1
                            });
                        }
                    }
                }
            }
        } else {
            throw new Error(`Bodleian IIIF manifest has unexpected structure. It may be using a format not yet supported or may be corrupted.`);
        }
        
        if (images.length === 0) {
            throw new Error(`No images found in Bodleian manuscript '${objectId}'. The manifest exists but contains no downloadable pages. This may indicate the manuscript is still being processed or has restricted access.`);
        }
        
        console.log(`[Bodleian] Successfully extracted ${images.length} pages`);
        
        return {
            images,
            displayName: this.localizedStringToString(manifest.label) || `Bodleian - ${objectId}`
        };
    }
}

// Example usage and testing
async function testEnhancedBodleianLogic() {
    console.log('🧪 TESTING ENHANCED BODLEIAN ERROR HANDLING');
    
    const loader = new BodleianManifestLoader();
    
    // Test cases with different scenarios
    const testCases = [
        {
            name: 'Working manuscript',
            url: 'https://digital.bodleian.ox.ac.uk/objects/ae9f6cca-ae5c-4149-8fe4-95e6eca1f73c/',
            expectedResult: 'success'
        },
        {
            name: 'Non-existent manuscript',
            url: 'https://digital.bodleian.ox.ac.uk/objects/00000000-0000-0000-0000-000000000000/',
            expectedResult: 'not found error'
        },
        {
            name: 'Previously failing manuscript',
            url: 'https://digital.bodleian.ox.ac.uk/objects/8b5d46f6-ba06-4f4f-96c9-ed85bad1f98c/',
            expectedResult: 'connection or availability error'
        }
    ];
    
    for (const testCase of testCases) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🔍 Testing: ${testCase.name}`);
        console.log(`URL: ${testCase.url}`);
        console.log(`${'='.repeat(60)}`);
        
        try {
            const result = await loader.getBodleianManifest(testCase.url);
            const images = Array.isArray(result) ? result : result.images;
            const displayName = Array.isArray(result) ? 'Unknown' : result.displayName;
            
            console.log(`✅ SUCCESS: ${images.length} pages found`);
            console.log(`📋 Title: ${displayName}`);
            console.log(`📋 Sample URLs:`);
            images.slice(0, 2).forEach(img => {
                console.log(`   - ${img.filename}: ${img.url}`);
            });
        } catch (error) {
            console.log(`❌ ERROR (Expected: ${testCase.expectedResult})`);
            console.log(`📋 Error message: ${error.message}`);
            
            // Check if error message is user-friendly
            if (error.message.includes('not available') || 
                error.message.includes('not found') ||
                error.message.includes('timeout') ||
                error.message.includes('connection failed')) {
                console.log(`✅ User-friendly error message provided`);
            } else {
                console.log(`⚠️  Error message could be more user-friendly`);
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause
    }
    
    console.log('\n🏁 ENHANCED ERROR HANDLING TEST COMPLETE');
}

// Run if called directly
if (require.main === module) {
    testEnhancedBodleianLogic().catch(console.error);
}

export { BodleianManifestLoader };