const https = require('https');
const fs = require('fs');

const testUrls = [
    'https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=11000651',
    'https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=22211',
    'https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=10000059'
];

async function analyzeUrl(url) {
    console.log(`\n=== Analyzing: ${url} ===`);
    
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        }, (res) => {
            let data = '';
            
            console.log(`Status: ${res.statusCode}`);
            console.log(`Headers:`, res.headers);
            
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`Content length: ${data.length}`);
                console.log(`Content type: ${res.headers['content-type']}`);
                
                // Look for image patterns, APIs, or metadata
                const imagePatterns = [
                    /src="([^"]*\.(?:jpg|jpeg|png|gif|tiff|tif)[^"]*)"/gi,
                    /href="([^"]*\.(?:jpg|jpeg|png|gif|tiff|tif)[^"]*)"/gi,
                    /url\(([^)]*\.(?:jpg|jpeg|png|gif|tiff|tif)[^)]*)\)/gi,
                    /"([^"]*\/image\/[^"]*)/gi,
                    /"([^"]*\/img\/[^"]*)/gi
                ];
                
                const foundImages = [];
                imagePatterns.forEach(pattern => {
                    let match;
                    while ((match = pattern.exec(data)) !== null) {
                        foundImages.push(match[1]);
                    }
                });
                
                // Look for API endpoints or JSON data
                const apiPatterns = [
                    /api[^"'\s]*\/[^"'\s]*/gi,
                    /\/service[^"'\s]*/gi,
                    /\.json[^"'\s]*/gi,
                    /ajax[^"'\s]*/gi
                ];
                
                const foundApis = [];
                apiPatterns.forEach(pattern => {
                    let match;
                    while ((match = pattern.exec(data)) !== null) {
                        foundApis.push(match[0]);
                    }
                });
                
                // Look for manuscript metadata
                const metadataPatterns = [
                    /título[^<]*<[^>]*>([^<]*)/gi,
                    /title[^<]*<[^>]*>([^<]*)/gi,
                    /páginas?[^0-9]*(\d+)/gi,
                    /pages?[^0-9]*(\d+)/gi
                ];
                
                const foundMetadata = [];
                metadataPatterns.forEach(pattern => {
                    let match;
                    while ((match = pattern.exec(data)) !== null) {
                        foundMetadata.push(match[0]);
                    }
                });
                
                console.log(`Found ${foundImages.length} image references`);
                console.log(`Found ${foundApis.length} API references`);
                console.log(`Found ${foundMetadata.length} metadata references`);
                
                if (foundImages.length > 0) {
                    console.log('Sample images:', foundImages.slice(0, 3));
                }
                if (foundApis.length > 0) {
                    console.log('Sample APIs:', foundApis.slice(0, 3));
                }
                if (foundMetadata.length > 0) {
                    console.log('Sample metadata:', foundMetadata.slice(0, 3));
                }
                
                resolve({
                    url,
                    statusCode: res.statusCode,
                    contentType: res.headers['content-type'],
                    contentLength: data.length,
                    images: foundImages,
                    apis: foundApis,
                    metadata: foundMetadata,
                    rawContent: data.substring(0, 2000) // First 2000 chars for analysis
                });
            });
        });
        
        req.on('error', (err) => {
            console.error(`Error analyzing ${url}:`, err.message);
            reject(err);
        });
        
        req.setTimeout(10000, () => {
            console.error(`Timeout analyzing ${url}`);
            req.destroy();
            reject(new Error('Timeout'));
        });
        
        req.end();
    });
}

async function main() {
    console.log('Starting BVPB URL analysis...');
    
    const results = [];
    
    for (const url of testUrls) {
        try {
            const result = await analyzeUrl(url);
            results.push(result);
            // Wait between requests to be polite
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`Failed to analyze ${url}:`, error.message);
            results.push({
                url,
                error: error.message
            });
        }
    }
    
    // Save analysis results
    fs.writeFileSync('.devkit/reports/bvpb-url-analysis.json', JSON.stringify(results, null, 2));
    
    console.log('\n=== ANALYSIS COMPLETE ===');
    console.log('Results saved to .devkit/reports/bvpb-url-analysis.json');
    
    // Summary
    const successfulResults = results.filter(r => !r.error);
    console.log(`\nSuccessfully analyzed ${successfulResults.length}/${testUrls.length} URLs`);
    
    if (successfulResults.length > 0) {
        const totalImages = successfulResults.reduce((sum, r) => sum + r.images.length, 0);
        const totalApis = successfulResults.reduce((sum, r) => sum + r.apis.length, 0);
        console.log(`Total image references found: ${totalImages}`);
        console.log(`Total API references found: ${totalApis}`);
    }
}

main().catch(console.error);