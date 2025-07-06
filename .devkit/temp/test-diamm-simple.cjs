const { exec } = require('child_process');
const fs = require('fs');

// Test just the most promising resolution parameters
const testUrls = [
    { name: 'full/full', url: 'https://iiif.diamm.net/images/I-Rc-Ms-1907/I-Rc-Ms-1907_001r.tif/full/full/0/default.jpg' },
    { name: 'full/max', url: 'https://iiif.diamm.net/images/I-Rc-Ms-1907/I-Rc-Ms-1907_001r.tif/full/max/0/default.jpg' },
    { name: 'full/4000', url: 'https://iiif.diamm.net/images/I-Rc-Ms-1907/I-Rc-Ms-1907_001r.tif/full/4000,/0/default.jpg' }
];

console.log('Testing DIAMM resolution parameters (simple)...');

async function testOne(testCase) {
    console.log(`\nTesting ${testCase.name}...`);
    console.log(`URL: ${testCase.url}`);
    
    return new Promise((resolve) => {
        const tempFile = `/tmp/diamm_${testCase.name.replace('/', '_')}_${Date.now()}.jpg`;
        
        exec(`curl -s -L -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" "${testCase.url}" -o "${tempFile}" --max-time 30`, (error, stdout, stderr) => {
            if (error) {
                console.log(`❌ Error: ${error.message}`);
                resolve({ name: testCase.name, status: 'error', error: error.message });
                return;
            }
            
            if (fs.existsSync(tempFile)) {
                const stats = fs.statSync(tempFile);
                const sizeKB = Math.round(stats.size / 1024);
                
                // Use sips to get actual image dimensions on macOS
                exec(`sips -g pixelHeight -g pixelWidth "${tempFile}"`, (sipsError, sipsOutput) => {
                    let dimensions = 'unknown';
                    if (!sipsError) {
                        const widthMatch = sipsOutput.match(/pixelWidth:\s*(\d+)/);
                        const heightMatch = sipsOutput.match(/pixelHeight:\s*(\d+)/);
                        if (widthMatch && heightMatch) {
                            dimensions = `${widthMatch[1]}x${heightMatch[1]}`;
                        }
                    }
                    
                    const isValidImage = stats.size > 50000; // At least 50KB
                    const status = isValidImage ? '✅' : '⚠️';
                    
                    console.log(`${status} Result: ${sizeKB}KB, ${dimensions}`);
                    
                    // Clean up
                    fs.unlinkSync(tempFile);
                    
                    resolve({ 
                        name: testCase.name, 
                        status: isValidImage ? 'success' : 'warning', 
                        size: stats.size, 
                        sizeKB, 
                        dimensions 
                    });
                });
            } else {
                console.log(`❌ No file created`);
                resolve({ name: testCase.name, status: 'no_file' });
            }
        });
    });
}

async function runTests() {
    const results = [];
    
    for (const testCase of testUrls) {
        const result = await testOne(testCase);
        results.push(result);
    }
    
    console.log('\n=== SUMMARY ===');
    const validResults = results.filter(r => r.status === 'success');
    validResults.sort((a, b) => (b.size || 0) - (a.size || 0));
    
    validResults.forEach(r => {
        console.log(`${r.name}: ${r.sizeKB}KB (${r.dimensions})`);
    });
    
    const largest = validResults[0];
    if (largest) {
        console.log(`\n🎯 BEST RESOLUTION: ${largest.name}`);
        console.log(`   Size: ${largest.sizeKB}KB`);
        console.log(`   Dimensions: ${largest.dimensions}`);
    }
    
    // Save results
    fs.writeFileSync('/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/temp/diamm-simple-test-results.json', JSON.stringify(results, null, 2));
    console.log('\n📊 Results saved to: .devkit/temp/diamm-simple-test-results.json');
}

runTests().catch(console.error);