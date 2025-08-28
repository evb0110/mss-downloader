const { execSync } = require('child_process');
const fs = require('fs');

// Create a simple test using Node.js to test the Morgan loader
const testCode = `
// Mock the MorganLoader functionality
async function testMorganPattern() {
    const baseUrl = 'https://www.themorgan.org';
    const manuscriptId = 'gospel-book';
    const objectId = '143812';
    
    console.log('=== Testing Updated Morgan Pattern ===');
    
    // Step 1: Fetch first individual page
    const collectionPath = \`\${manuscriptId}/\${objectId}\`;
    const firstPageUrl = \`\${baseUrl}/collection/\${collectionPath}/1\`;
    console.log('Fetching:', firstPageUrl);
    
    try {
        const response = await fetch(firstPageUrl);
        if (!response.ok) {
            console.log('Failed to fetch first page:', response.status);
            return;
        }
        
        const html = await response.text();
        
        // Step 2: Extract manuscript code from iframe
        const iframeMatch = html.match(/host\\.themorgan\\.org\\/facsimile\\/([^\\/]+)\\/default\\.asp/);
        if (iframeMatch && iframeMatch[1]) {
            const manuscriptCode = iframeMatch[1];
            console.log('✅ Discovered manuscript code:', manuscriptCode);
            
            // Step 3: Test ZIF URL construction
            const testZifUrl = \`https://host.themorgan.org/facsimile/images/\${manuscriptCode}/143812v_0001.zif\`;
            console.log('Testing ZIF URL:', testZifUrl);
            
            const zifResponse = await fetch(testZifUrl, { method: 'HEAD' });
            console.log('ZIF Response:', zifResponse.status, zifResponse.statusText);
            
            if (zifResponse.ok) {
                const contentLength = zifResponse.headers.get('content-length');
                const sizeMB = contentLength ? (parseInt(contentLength) / 1024 / 1024).toFixed(2) : 'unknown';
                console.log(\`✅ ZIF SUCCESS: \${sizeMB}MB ultra-high resolution image\`);
                
                // Test a few more pages
                for (let i = 2; i <= 4; i++) {
                    const pageZifUrl = \`https://host.themorgan.org/facsimile/images/\${manuscriptCode}/143812v_000\${i}.zif\`;
                    const pageResp = await fetch(pageZifUrl, { method: 'HEAD' });
                    if (pageResp.ok) {
                        const pageSize = pageResp.headers.get('content-length');
                        const pageSizeMB = pageSize ? (parseInt(pageSize) / 1024 / 1024).toFixed(2) : 'unknown';
                        console.log(\`  Page \${i}: \${pageSizeMB}MB\`);
                    }
                }
                
            } else {
                console.log('❌ ZIF test failed');
            }
        } else {
            console.log('❌ Could not find manuscript code in iframe');
        }
        
    } catch (error) {
        console.log('❌ Error:', error.message);
    }
}

testMorganPattern();
`;

// Write and execute the test
fs.writeFileSync('/tmp/morgan-test.mjs', testCode);
execSync('node /tmp/morgan-test.mjs', { stdio: 'inherit' });