const { exec } = require('child_process');
const fs = require('fs');

const baseUrl = 'https://iiif.diamm.net/images/I-Rc-Ms-1907/I-Rc-Ms-1907_001r.tif';

const testUrls = [
    { name: 'full/full', url: `${baseUrl}/full/full/0/default.jpg` },
    { name: 'full/max', url: `${baseUrl}/full/max/0/default.jpg` },
    { name: 'full/2000', url: `${baseUrl}/full/2000,/0/default.jpg` },
    { name: 'full/4000', url: `${baseUrl}/full/4000,/0/default.jpg` },
    { name: 'full/6000', url: `${baseUrl}/full/6000,/0/default.jpg` },
    { name: 'full/8000', url: `${baseUrl}/full/8000,/0/default.jpg` },
    { name: 'full/1000', url: `${baseUrl}/full/1000,/0/default.jpg` }
];

console.log('Testing DIAMM resolution parameters...');
console.log('Base URL:', baseUrl);
console.log('');

async function testResolution(testCase) {
    return new Promise((resolve) => {
        const tempFile = `/tmp/diamm_test_${Date.now()}.jpg`;
        
        exec(`curl -s -L -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" "${testCase.url}" -o "${tempFile}"`, (error, stdout, stderr) => {
            if (error) {
                console.log(`❌ ${testCase.name}: Error - ${error.message}`);
                resolve({ name: testCase.name, status: 'error', error: error.message });
                return;
            }
            
            // Check if file was created and get its size
            if (fs.existsSync(tempFile)) {
                const stats = fs.statSync(tempFile);
                const sizeKB = Math.round(stats.size / 1024);
                
                // Get image dimensions using file command
                exec(`file "${tempFile}"`, (fileError, fileOutput) => {
                    let dimensions = 'unknown';
                    if (!fileError && fileOutput.includes('JPEG')) {
                        const dimMatch = fileOutput.match(/(\d+)x(\d+)/);
                        if (dimMatch) {
                            dimensions = `${dimMatch[1]}x${dimMatch[2]}`;
                        }
                    }
                    
                    // Check if it's a valid image (not error page)
                    const isValidImage = stats.size > 50000; // At least 50KB for a valid manuscript image
                    const status = isValidImage ? '✅' : '⚠️';
                    
                    console.log(`${status} ${testCase.name}: ${sizeKB}KB, ${dimensions}`);
                    
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
                console.log(`❌ ${testCase.name}: No file created`);
                resolve({ name: testCase.name, status: 'no_file' });
            }
        });
    });
}

async function runTests() {
    const results = [];
    
    for (const testCase of testUrls) {
        const result = await testResolution(testCase);
        results.push(result);
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n=== SUMMARY ===');
    console.log('Results sorted by file size:');
    
    const validResults = results.filter(r => r.status === 'success' || r.status === 'warning');
    validResults.sort((a, b) => (b.size || 0) - (a.size || 0));
    
    validResults.forEach(r => {
        console.log(`${r.name}: ${r.sizeKB}KB (${r.dimensions})`);
    });
    
    const largest = validResults[0];
    if (largest) {
        console.log(`\n🎯 BEST RESOLUTION: ${largest.name}`);
        console.log(`   Size: ${largest.sizeKB}KB`);
        console.log(`   Dimensions: ${largest.dimensions}`);
        console.log(`   URL pattern: /full/${largest.name.split('/')[1]}/0/default.jpg`);
    }
    
    // Save results
    fs.writeFileSync('.devkit/temp/diamm-resolution-test-results.json', JSON.stringify(results, null, 2));
    console.log('\n📊 Results saved to: .devkit/temp/diamm-resolution-test-results.json');
}

runTests().catch(console.error);