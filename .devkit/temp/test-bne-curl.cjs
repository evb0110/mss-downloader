const { execSync } = require('child_process');

async function testBneWithCurl() {
    console.log('=== BNE Diagnostic with curl ===');
    
    const manuscriptId = '0000007619';
    
    // Test URLs with curl
    const testUrls = [
        `https://bdh-rd.bne.es/viewer.vm?id=${manuscriptId}&page=1`,
        `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=1&jpeg=true`,
        `https://bdh-rd.bne.es/image.raw?query=id:${manuscriptId}&page=1`,
        `https://bdh-rd.bne.es/jpeg.raw?query=id:${manuscriptId}&page=1`,
    ];
    
    for (const url of testUrls) {
        console.log(`\nTesting: ${url}`);
        
        try {
            // Test with HEAD request first
            const headResult = execSync(`curl -I -s -k "${url}"`, { encoding: 'utf8', timeout: 10000 });
            console.log('HEAD response:');
            console.log(headResult);
            
            // If HEAD works, try a partial GET to check content
            if (headResult.includes('200 OK') || headResult.includes('Content-Type')) {
                console.log('Trying partial GET...');
                const getResult = execSync(`curl -s -k -r 0-1023 "${url}" | head -c 100`, { encoding: 'utf8', timeout: 10000 });
                console.log('Partial content:', getResult.substring(0, 100));
            }
        } catch (error) {
            console.log(`curl error: ${error.message}`);
        }
    }
    
    // Test with different user agents
    console.log('\n=== Testing with different User-Agents ===');
    
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    ];
    
    const testUrl = `https://bdh-rd.bne.es/viewer.vm?id=${manuscriptId}&page=1`;
    
    for (const userAgent of userAgents) {
        console.log(`\nTesting with User-Agent: ${userAgent.substring(0, 50)}...`);
        
        try {
            const result = execSync(`curl -I -s -k -H "User-Agent: ${userAgent}" "${testUrl}"`, { encoding: 'utf8', timeout: 10000 });
            console.log('Response:');
            console.log(result);
        } catch (error) {
            console.log(`curl error: ${error.message}`);
        }
    }
    
    // Test basic connectivity
    console.log('\n=== Testing basic connectivity ===');
    
    try {
        const result = execSync('curl -I -s -k https://bdh-rd.bne.es/', { encoding: 'utf8', timeout: 10000 });
        console.log('BNE homepage response:');
        console.log(result);
    } catch (error) {
        console.log(`Connectivity error: ${error.message}`);
    }
    
    console.log('\n=== BNE curl diagnostic complete ===');
}

testBneWithCurl().catch(console.error);