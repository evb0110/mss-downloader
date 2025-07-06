const { exec } = require('child_process');

// Test DIAMM image URLs with HEAD requests to check file sizes without downloading
const baseUrl = 'https://iiif.diamm.net/images/I-Rc-Ms-1907/I-Rc-Ms-1907_001r.tif';

const testUrls = [
    { name: 'full/full', url: `${baseUrl}/full/full/0/default.jpg` },
    { name: 'full/max', url: `${baseUrl}/full/max/0/default.jpg` },
    { name: 'full/2000', url: `${baseUrl}/full/2000,/0/default.jpg` },
    { name: 'full/1000', url: `${baseUrl}/full/1000,/0/default.jpg` },
    { name: 'full/500', url: `${baseUrl}/full/500,/0/default.jpg` }
];

console.log('Testing DIAMM resolution parameters with HEAD requests...');

async function testHeadRequest(testCase) {
    console.log(`\nTesting ${testCase.name}...`);
    
    return new Promise((resolve) => {
        const cmd = `curl -I -s -L -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" "${testCase.url}" --max-time 10`;
        
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.log(`❌ Error: ${error.message}`);
                resolve({ name: testCase.name, status: 'error', error: error.message });
                return;
            }
            
            console.log(`Headers response:\n${stdout}`);
            
            // Parse headers
            const headers = {};
            const lines = stdout.split('\n');
            let httpStatus = '';
            
            for (const line of lines) {
                if (line.startsWith('HTTP/')) {
                    httpStatus = line.trim();
                } else if (line.includes(':')) {
                    const [key, value] = line.split(':').map(s => s.trim());
                    if (key && value) {
                        headers[key.toLowerCase()] = value;
                    }
                }
            }
            
            const contentLength = headers['content-length'];
            const contentType = headers['content-type'];
            
            console.log(`Status: ${httpStatus}`);
            console.log(`Content-Type: ${contentType}`);
            console.log(`Content-Length: ${contentLength} bytes`);
            
            if (contentLength) {
                const sizeKB = Math.round(parseInt(contentLength) / 1024);
                console.log(`Size: ${sizeKB}KB`);
            }
            
            const isValidImage = httpStatus.includes('200') && contentType && contentType.includes('image');
            const status = isValidImage ? '✅' : '⚠️';
            
            console.log(`${status} Result: ${isValidImage ? 'Valid' : 'Invalid'}`);
            
            resolve({ 
                name: testCase.name, 
                status: isValidImage ? 'success' : 'warning',
                httpStatus,
                contentType,
                contentLength: contentLength ? parseInt(contentLength) : 0,
                sizeKB: contentLength ? Math.round(parseInt(contentLength) / 1024) : 0
            });
        });
    });
}

async function runTests() {
    const results = [];
    
    for (const testCase of testUrls) {
        const result = await testHeadRequest(testCase);
        results.push(result);
    }
    
    console.log('\n=== SUMMARY ===');
    console.log('Valid results sorted by size:');
    
    const validResults = results.filter(r => r.status === 'success');
    validResults.sort((a, b) => (b.contentLength || 0) - (a.contentLength || 0));
    
    validResults.forEach(r => {
        console.log(`${r.name}: ${r.sizeKB}KB (${r.contentType})`);
    });
    
    const largest = validResults[0];
    if (largest) {
        console.log(`\n🎯 BEST RESOLUTION: ${largest.name}`);
        console.log(`   Size: ${largest.sizeKB}KB`);
        console.log(`   Content-Type: ${largest.contentType}`);
        console.log(`   URL pattern: /full/${largest.name.split('/')[1]}/0/default.jpg`);
    }
    
    // Show all results
    console.log('\n=== ALL RESULTS ===');
    results.forEach(r => {
        console.log(`${r.name}: ${r.status} (${r.sizeKB}KB)`);
    });
}

runTests().catch(console.error);