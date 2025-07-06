const https = require('https');
const fs = require('fs');

async function detailedAnalysis(url) {
    console.log(`\n=== Detailed Analysis: ${url} ===`);
    
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        }, (res) => {
            let data = '';
            
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`Analyzing HTML content...`);
                
                // Look for specific BVPB patterns
                const patterns = {
                    imageUrls: [
                        /imagen\.do\?path=([^"&]*)/gi,
                        /"([^"]*\/imagen\/[^"]*)/gi,
                        /"([^"]*\/img\/[^"]*\.(?:jpg|jpeg|png|gif|tiff|tif))/gi,
                        /src="([^"]*imagen[^"]*)/gi
                    ],
                    manifestUrls: [
                        /manifest\.do\?path=([^"&]*)/gi,
                        /"([^"]*manifest[^"]*)/gi,
                        /"([^"]*\.json[^"]*)/gi
                    ],
                    pageNumbers: [
                        /página[^0-9]*(\d+)/gi,
                        /page[^0-9]*(\d+)/gi,
                        /total[^0-9]*(\d+)/gi,
                        /páginas[^0-9]*(\d+)/gi
                    ],
                    titles: [
                        /<h1[^>]*>([^<]*)</gi,
                        /<h2[^>]*>([^<]*)</gi,
                        /<title[^>]*>([^<]*)</gi,
                        /título[^<]*<[^>]*>([^<]*)</gi
                    ],
                    downloadLinks: [
                        /href="([^"]*download[^"]*)/gi,
                        /href="([^"]*descargar[^"]*)/gi,
                        /href="([^"]*pdf[^"]*)/gi
                    ],
                    metadataFields: [
                        /class="[^"]*metadata[^"]*"[^>]*>([^<]*)/gi,
                        /class="[^"]*field[^"]*"[^>]*>([^<]*)/gi,
                        /class="[^"]*value[^"]*"[^>]*>([^<]*)/gi
                    ]
                };
                
                const results = {};
                
                Object.keys(patterns).forEach(key => {
                    results[key] = [];
                    patterns[key].forEach(pattern => {
                        let match;
                        while ((match = pattern.exec(data)) !== null) {
                            results[key].push(match[1] || match[0]);
                        }
                    });
                });
                
                // Look for JavaScript variables that might contain image paths
                const jsVarPatterns = [
                    /var\s+(\w+)\s*=\s*"([^"]*imagen[^"]*)"/gi,
                    /var\s+(\w+)\s*=\s*"([^"]*path[^"]*)"/gi,
                    /var\s+(\w+)\s*=\s*"([^"]*\.jpg[^"]*)"/gi
                ];
                
                results.jsVariables = [];
                jsVarPatterns.forEach(pattern => {
                    let match;
                    while ((match = pattern.exec(data)) !== null) {
                        results.jsVariables.push({
                            variable: match[1],
                            value: match[2]
                        });
                    }
                });
                
                // Look for form actions that might be used for image requests
                const formPatterns = [
                    /<form[^>]*action="([^"]*)"[^>]*>/gi,
                    /<form[^>]*method="([^"]*)"[^>]*>/gi
                ];
                
                results.forms = [];
                formPatterns.forEach(pattern => {
                    let match;
                    while ((match = pattern.exec(data)) !== null) {
                        results.forms.push(match[1]);
                    }
                });
                
                console.log('Found patterns:');
                Object.keys(results).forEach(key => {
                    if (results[key].length > 0) {
                        console.log(`- ${key}: ${results[key].length} items`);
                        if (results[key].length <= 5) {
                            console.log(`  ${results[key].join(', ')}`);
                        } else {
                            console.log(`  ${results[key].slice(0, 3).join(', ')} ... (${results[key].length} total)`);
                        }
                    }
                });
                
                resolve({
                    url,
                    patterns: results,
                    content: data
                });
            });
        });
        
        req.on('error', reject);
        req.setTimeout(15000, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
        
        req.end();
    });
}

async function main() {
    console.log('Starting detailed BVPB analysis...');
    
    const testUrl = 'https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=11000651';
    
    try {
        const result = await detailedAnalysis(testUrl);
        
        // Save the full HTML content for manual inspection
        fs.writeFileSync('.devkit/temp/bvpb-sample-page.html', result.content);
        
        // Save the analysis results
        fs.writeFileSync('.devkit/reports/bvpb-detailed-analysis.json', JSON.stringify(result.patterns, null, 2));
        
        console.log('\n=== DETAILED ANALYSIS COMPLETE ===');
        console.log('HTML content saved to .devkit/temp/bvpb-sample-page.html');
        console.log('Analysis results saved to .devkit/reports/bvpb-detailed-analysis.json');
        
    } catch (error) {
        console.error('Analysis failed:', error.message);
    }
}

main().catch(console.error);