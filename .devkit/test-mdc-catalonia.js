const https = require('https');
const http = require('http');

// Test URL
const testUrl = 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1';

console.log('🧪 Testing MDC Catalonia fetch issue...\n');

// Extract collection and ID
const urlMatch = testUrl.match(/mdc\.csuc\.cat\/digital\/collection\/([^/]+)\/id\/(\d+)/);
const collection = urlMatch[1];
const itemId = urlMatch[2];

console.log(`Collection: ${collection}`);
console.log(`Item ID: ${itemId}\n`);

// Test 1: Direct HTTPS request to XML
async function testCompoundXml() {
    const xmlUrl = `https://mdc.csuc.cat/digital/bl/api/collection/${collection}/getCpdItemInfo/${itemId}`;
    
    console.log('1️⃣ Testing compound XML URL...');
    console.log(`   URL: ${xmlUrl}`);
    
    return new Promise((resolve) => {
        const startTime = Date.now();
        
        https.get(xmlUrl, { 
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/xml, text/xml, */*'
            }
        }, (res) => {
            const duration = Date.now() - startTime;
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   Response time: ${duration}ms`);
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`   Content length: ${data.length} bytes`);
                
                // Try to extract pages from XML
                const pageMatches = data.match(/<page>.*?<\/page>/gs);
                if (pageMatches) {
                    console.log(`   📄 Pages found in XML: ${pageMatches.length}`);
                    
                    // Extract first page info
                    const firstPageMatch = pageMatches[0].match(/<pageptr>(\d+)<\/pageptr>/);
                    if (firstPageMatch) {
                        console.log(`   First page ID: ${firstPageMatch[1]}`);
                    }
                }
                
                console.log(`   ✅ XML loaded successfully\n`);
                resolve({ success: true, pageCount: pageMatches ? pageMatches.length : 0 });
            });
        }).on('error', (err) => {
            const duration = Date.now() - startTime;
            console.log(`   ❌ Error after ${duration}ms: ${err.message}\n`);
            resolve({ success: false, error: err.message });
        }).on('timeout', () => {
            console.log(`   ❌ Timeout after 30 seconds\n`);
            resolve({ success: false, error: 'timeout' });
        });
    });
}

// Test 2: IIIF Image URL
async function testIiifImage() {
    // Test with a sample page ID (we'll get the real one from XML)
    const samplePageId = '175332'; // Common pattern: itemId + 1
    const iiifUrl = `https://mdc.csuc.cat/digital/iiif/incunableBC/${samplePageId}/full/full/0/default.jpg`;
    
    console.log('2️⃣ Testing IIIF image URL...');
    console.log(`   URL: ${iiifUrl}`);
    
    return new Promise((resolve) => {
        const startTime = Date.now();
        
        https.get(iiifUrl, { 
            method: 'HEAD',
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        }, (res) => {
            const duration = Date.now() - startTime;
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   Response time: ${duration}ms`);
            
            if (res.statusCode === 200) {
                console.log(`   Content-Type: ${res.headers['content-type']}`);
                console.log(`   Content-Length: ${res.headers['content-length']} bytes`);
                console.log(`   ✅ IIIF image accessible\n`);
            } else if (res.statusCode >= 300 && res.statusCode < 400) {
                console.log(`   Redirect to: ${res.headers.location}`);
                console.log(`   ⚠️ IIIF URL redirects\n`);
            } else {
                console.log(`   ❌ IIIF image not accessible\n`);
            }
            resolve();
        }).on('error', (err) => {
            const duration = Date.now() - startTime;
            console.log(`   ❌ Error after ${duration}ms: ${err.message}\n`);
            resolve();
        });
    });
}

// Test 3: Try curl command fallback
async function testCurlFallback() {
    const xmlUrl = `https://mdc.csuc.cat/digital/bl/api/collection/${collection}/getCpdItemInfo/${itemId}`;
    
    console.log('3️⃣ Testing curl command fallback...');
    
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
        const { stdout, stderr } = await execAsync(`curl -s "${xmlUrl}" | head -c 1000`);
        
        if (stdout) {
            console.log(`   ✅ Curl command works`);
            console.log(`   Response preview: ${stdout.substring(0, 200)}...`);
            
            const pageCount = (stdout.match(/<page>/g) || []).length;
            console.log(`   Pages detected: ${pageCount}`);
        }
        
        if (stderr) {
            console.log(`   ⚠️ Curl errors: ${stderr}`);
        }
    } catch (error) {
        console.log(`   ❌ Curl command failed: ${error.message}`);
    }
}

// Run all tests
async function runTests() {
    const xmlResult = await testCompoundXml();
    await testIiifImage();
    await testCurlFallback();
    
    console.log('\n📊 Summary:');
    if (xmlResult.success) {
        console.log(`✅ MDC Catalonia API is accessible`);
        console.log(`📄 Found ${xmlResult.pageCount} pages in manuscript`);
        console.log(`\nThe implementation should work correctly.`);
    } else {
        console.log(`❌ MDC Catalonia API access failed: ${xmlResult.error}`);
        console.log(`\nThis appears to be a network/SSL issue.`);
    }
}

runTests().catch(console.error);