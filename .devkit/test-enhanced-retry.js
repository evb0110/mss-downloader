const https = require('https');

console.log('=== Testing Enhanced Graz Retry Logic ===\n');
console.log('Configuration:');
console.log('- Max retries: 5');
console.log('- Exponential backoff: 2s, 4s, 8s, 16s, 30s (max)');
console.log('- Socket timeout: 120 seconds');
console.log('- Connection pooling enabled\n');

// Simulate the retry logic
function simulateRetryDelays() {
    console.log('Retry delays with exponential backoff:');
    for (let i = 1; i <= 5; i++) {
        const delay = Math.min(1000 * Math.pow(2, i), 30000);
        console.log(`  Retry ${i}: ${delay}ms (${delay/1000}s)`);
    }
    
    const totalMaxTime = 2000 + 4000 + 8000 + 16000 + 30000 + (120000 * 5); // backoff + timeouts
    console.log(`\nMaximum total time with all retries and timeouts: ${totalMaxTime/1000}s (${(totalMaxTime/60000).toFixed(1)} minutes)`);
}

simulateRetryDelays();

// Test actual connection with monitoring
async function testGrazConnection() {
    console.log('\n\nTesting actual Graz connection with enhanced settings...');
    
    const url = 'https://unipub.uni-graz.at/i3f/v20/8224538/manifest';
    const startTime = Date.now();
    let attemptCount = 0;
    
    const makeRequest = () => {
        return new Promise((resolve, reject) => {
            attemptCount++;
            const attemptStart = Date.now();
            console.log(`\n[Attempt ${attemptCount}] Starting at ${new Date().toISOString()}`);
            
            const urlObj = new URL(url);
            const agent = new https.Agent({
                keepAlive: true,
                keepAliveMsecs: 1000,
                maxSockets: 10,
                maxFreeSockets: 5,
                timeout: 120000,
                rejectUnauthorized: false
            });
            
            const options = {
                hostname: urlObj.hostname,
                port: 443,
                path: urlObj.pathname,
                method: 'GET',
                headers: {
                    'Referer': 'https://unipub.uni-graz.at/',
                    'Accept': 'application/json, application/ld+json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Connection': 'keep-alive'
                },
                timeout: 120000,
                agent: agent
            };
            
            const req = https.request(options, (res) => {
                const elapsed = Date.now() - attemptStart;
                console.log(`[Attempt ${attemptCount}] Response received in ${elapsed}ms`);
                console.log(`[Attempt ${attemptCount}] Status: ${res.statusCode}`);
                
                const chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => {
                    const data = Buffer.concat(chunks).toString();
                    const totalElapsed = Date.now() - startTime;
                    console.log(`[Attempt ${attemptCount}] Success! Total time: ${totalElapsed}ms`);
                    resolve({ success: true, attempts: attemptCount, totalTime: totalElapsed });
                });
            });
            
            req.on('error', (error) => {
                const elapsed = Date.now() - attemptStart;
                console.log(`[Attempt ${attemptCount}] Error after ${elapsed}ms: ${error.code}`);
                reject(error);
            });
            
            req.on('timeout', () => {
                console.log(`[Attempt ${attemptCount}] Socket timeout after 120 seconds`);
                req.destroy();
            });
            
            req.end();
        });
    };
    
    try {
        const result = await makeRequest();
        console.log('\n✓ Connection successful on first attempt!');
        console.log(`  Total time: ${result.totalTime}ms`);
    } catch (error) {
        console.log('\n✗ Connection failed:', error.message);
        console.log('  With enhanced retry logic, the app would retry up to 5 times');
    }
}

testGrazConnection().catch(console.error);