const https = require('https');

async function testBneWithNodeAgent() {
    console.log('=== Testing BNE with Node.js HTTPS Agent ===');
    
    const manuscriptId = '0000007619';
    const testUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=1&jpeg=true`;
    
    console.log(`Testing URL: ${testUrl}`);
    
    // Test with SSL bypass (like the actual implementation)
    const agent = new https.Agent({
        rejectUnauthorized: false
    });
    
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };
    
    console.log('\n1. Testing with SSL bypass agent...');
    
    try {
        const response = await fetch(testUrl, {
            method: 'HEAD',
            headers,
            agent
        });
        
        console.log(`Status: ${response.status}`);
        console.log(`Content-Type: ${response.headers.get('content-type')}`);
        console.log(`Content-Length: ${response.headers.get('content-length')}`);
        
        if (response.ok && response.headers.get('content-type')?.includes('image')) {
            console.log('✓ BNE endpoint is accessible with SSL bypass');
        } else {
            console.log('✗ BNE endpoint is not returning valid image');
        }
        
    } catch (error) {
        console.log(`✗ Error with SSL bypass: ${error.message}`);
    }
    
    // Test without SSL bypass
    console.log('\n2. Testing without SSL bypass...');
    
    try {
        const response = await fetch(testUrl, {
            method: 'HEAD',
            headers
        });
        
        console.log(`Status: ${response.status}`);
        console.log(`Content-Type: ${response.headers.get('content-type')}`);
        console.log(`Content-Length: ${response.headers.get('content-length')}`);
        
        if (response.ok && response.headers.get('content-type')?.includes('image')) {
            console.log('✓ BNE endpoint is accessible without SSL bypass');
        } else {
            console.log('✗ BNE endpoint is not returning valid image');
        }
        
    } catch (error) {
        console.log(`✗ Error without SSL bypass: ${error.message}`);
    }
    
    // Test multiple pages
    console.log('\n3. Testing multiple pages...');
    
    for (let page = 1; page <= 5; page++) {
        const pageUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=${page}&jpeg=true`;
        
        try {
            const response = await fetch(pageUrl, {
                method: 'HEAD',
                headers,
                agent
            });
            
            console.log(`Page ${page}: Status ${response.status}, Content-Type: ${response.headers.get('content-type')}`);
            
            if (response.ok && response.headers.get('content-type')?.includes('image')) {
                console.log(`  ✓ Page ${page} is valid`);
            } else {
                console.log(`  ✗ Page ${page} is not valid`);
            }
            
        } catch (error) {
            console.log(`  ✗ Page ${page}: ${error.message}`);
        }
    }
    
    console.log('\n=== Test Complete ===');
}

testBneWithNodeAgent().catch(console.error);