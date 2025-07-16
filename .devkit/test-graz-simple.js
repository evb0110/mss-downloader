const https = require('https');

// Test the fixed ID extraction logic
function extractManuscriptId(grazUrl) {
    let manuscriptId;
    
    // Handle direct image download URL pattern
    if (grazUrl.includes('/download/webcache/')) {
        const webcacheMatch = grazUrl.match(/\/webcache\/\d+\/(\d+)$/);
        if (!webcacheMatch) {
            throw new Error('Could not extract manuscript ID from Graz webcache URL');
        }
        manuscriptId = webcacheMatch[1];
        // For webcache URLs, the ID is the page ID, we need to convert to titleinfo ID
        // Pattern: page ID - 2 = titleinfo ID (e.g., 8224544 -> 8224542)
        const pageId = parseInt(manuscriptId);
        const titleinfoId = (pageId - 2).toString();
        console.log(`Converting webcache page ID ${pageId} to titleinfo ID ${titleinfoId}`);
        manuscriptId = titleinfoId;
    } else {
        // Handle standard content URLs
        const manuscriptIdMatch = grazUrl.match(/\/(\d+)$/);
        if (!manuscriptIdMatch) {
            throw new Error('Could not extract manuscript ID from Graz URL');
        }
        
        manuscriptId = manuscriptIdMatch[1];
        
        // If this is a pageview URL, convert to titleinfo ID using known pattern
        // Pattern: pageview ID - 2 = titleinfo ID (e.g., 8224540 -> 8224538)
        if (grazUrl.includes('/pageview/')) {
            const pageviewId = parseInt(manuscriptId);
            const titleinfoId = (pageviewId - 2).toString();
            console.log(`Converting pageview ID ${pageviewId} to titleinfo ID ${titleinfoId}`);
            manuscriptId = titleinfoId;
        }
    }
    
    return manuscriptId;
}

// Test manifest fetch with the fixed logic
async function testManifestWithFix(url) {
    console.log(`\n📋 Testing URL: ${url}`);
    
    try {
        const manuscriptId = extractManuscriptId(url);
        const manifestUrl = `https://unipub.uni-graz.at/i3f/v20/${manuscriptId}/manifest`;
        
        console.log(`   Extracted ID: ${manuscriptId}`);
        console.log(`   Manifest URL: ${manifestUrl}`);
        
        return new Promise((resolve) => {
            https.get(manifestUrl, {
                timeout: 60000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'application/json'
                }
            }, (res) => {
                let data = '';
                
                console.log(`   Status: ${res.statusCode}`);
                
                if (res.statusCode !== 200) {
                    console.log(`   ❌ Failed with status ${res.statusCode}`);
                    resolve();
                    return;
                }
                
                res.on('data', chunk => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    console.log(`   ✅ Success! Downloaded ${data.length} bytes`);
                    
                    try {
                        const manifest = JSON.parse(data);
                        const sequences = manifest.sequences || [];
                        const canvases = sequences[0]?.canvases || [];
                        console.log(`   📄 Pages found: ${canvases.length}`);
                        
                        // Show the title
                        if (manifest.label) {
                            console.log(`   📚 Title: ${typeof manifest.label === 'string' ? manifest.label : JSON.stringify(manifest.label)}`);
                        }
                    } catch (e) {
                        console.log(`   ⚠️ Could not parse manifest JSON`);
                    }
                    
                    resolve();
                });
                
            }).on('error', (err) => {
                console.log(`   ❌ Error: ${err.message}`);
                resolve();
            });
        });
    } catch (error) {
        console.log(`   ❌ ID extraction error: ${error.message}`);
    }
}

// Run tests
async function runTests() {
    console.log('🧪 Testing University of Graz URL handling with fix...\n');
    
    const testUrls = [
        'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
        'https://unipub.uni-graz.at/obvugrscript/content/pageview/8224540', 
        'https://unipub.uni-graz.at/download/webcache/1504/8224544'
    ];
    
    for (const url of testUrls) {
        await testManifestWithFix(url);
    }
    
    console.log('\n✅ All tests completed');
}

runTests();