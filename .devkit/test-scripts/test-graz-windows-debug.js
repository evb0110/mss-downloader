const https = require('https');
const http = require('http');
const fs = require('fs');

// Test URL from the error
const testUrl = 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538';
const manifestUrl = 'https://unipub.uni-graz.at/i3f/v20/8224538/manifest';

console.log('Testing University of Graz JSON parsing issue on Windows...\n');

// First, let's check what the titleinfo page returns
function testTitleInfoPage() {
    console.log('1. Testing titleinfo page:', testUrl);
    
    https.get(testUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }
    }, (res) => {
        console.log('   Status:', res.statusCode);
        console.log('   Headers:', res.headers);
        console.log('   Content-Type:', res.headers['content-type']);
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log('   Response length:', data.length);
            console.log('   First 200 chars:', data.substring(0, 200));
            console.log('   Is HTML?', data.trim().startsWith('<'));
            console.log('');
            
            // Test manifest URL next
            testManifestUrl();
        });
    }).on('error', err => {
        console.error('   Error:', err.message);
        testManifestUrl();
    });
}

// Test the IIIF manifest URL
function testManifestUrl() {
    console.log('2. Testing IIIF manifest URL:', manifestUrl);
    
    https.get(manifestUrl, {
        headers: {
            'Accept': 'application/json, application/ld+json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    }, (res) => {
        console.log('   Status:', res.statusCode);
        console.log('   Headers:', res.headers);
        console.log('   Content-Type:', res.headers['content-type']);
        console.log('   Content-Encoding:', res.headers['content-encoding']);
        
        let chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            console.log('   Response size (bytes):', buffer.length);
            
            // Check if response is gzipped
            if (res.headers['content-encoding'] === 'gzip') {
                console.log('   Response is gzipped, decompressing...');
                const zlib = require('zlib');
                try {
                    const decompressed = zlib.gunzipSync(buffer);
                    console.log('   Decompressed size:', decompressed.length);
                    console.log('   First 200 chars:', decompressed.toString().substring(0, 200));
                    
                    // Try to parse as JSON
                    try {
                        const json = JSON.parse(decompressed.toString());
                        console.log('   ✓ Successfully parsed as JSON');
                        console.log('   JSON type:', json['@type'] || 'unknown');
                        console.log('   Canvas count:', json.sequences?.[0]?.canvases?.length || 0);
                    } catch (parseErr) {
                        console.log('   ✗ JSON parse error:', parseErr.message);
                    }
                } catch (decompressErr) {
                    console.log('   ✗ Decompression error:', decompressErr.message);
                }
            } else {
                // Not gzipped, try direct parsing
                const text = buffer.toString();
                console.log('   First 200 chars:', text.substring(0, 200));
                
                // Check if it's binary data
                const isBinary = buffer.some(byte => byte === 0 || byte > 127);
                console.log('   Contains binary data?', isBinary);
                
                if (!isBinary) {
                    try {
                        const json = JSON.parse(text);
                        console.log('   ✓ Successfully parsed as JSON');
                        console.log('   JSON type:', json['@type'] || 'unknown');
                        console.log('   Canvas count:', json.sequences?.[0]?.canvases?.length || 0);
                    } catch (parseErr) {
                        console.log('   ✗ JSON parse error:', parseErr.message);
                        console.log('   Actual content type:', detectContentType(text));
                    }
                } else {
                    console.log('   ✗ Response contains binary data, not JSON');
                    // Save binary data for analysis
                    fs.writeFileSync('graz-binary-response.bin', buffer);
                    console.log('   Binary data saved to graz-binary-response.bin');
                }
            }
            
            console.log('');
            testWithNodeFetch();
        });
    }).on('error', err => {
        console.error('   Error:', err.message);
        testWithNodeFetch();
    });
}

// Test with node-fetch to see if it handles things differently
async function testWithNodeFetch() {
    console.log('3. Testing with fetch (like Electron uses)...');
    
    try {
        // Dynamic import for node-fetch
        const fetch = (await import('node-fetch')).default;
        
        const response = await fetch(manifestUrl, {
            headers: {
                'Accept': 'application/json, application/ld+json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        console.log('   Status:', response.status);
        console.log('   Headers:', Object.fromEntries(response.headers));
        console.log('   Content-Type:', response.headers.get('content-type'));
        
        // Get response as buffer first
        const buffer = await response.buffer();
        console.log('   Response size:', buffer.length);
        
        // Try to get as text
        const text = buffer.toString();
        console.log('   First 200 chars:', text.substring(0, 200));
        
        // Try JSON parsing
        try {
            const json = JSON.parse(text);
            console.log('   ✓ Successfully parsed as JSON with fetch');
            console.log('   Canvas count:', json.sequences?.[0]?.canvases?.length || 0);
        } catch (parseErr) {
            console.log('   ✗ JSON parse error with fetch:', parseErr.message);
        }
        
    } catch (err) {
        console.log('   node-fetch not available, skipping this test');
        console.log('   Error:', err.message);
    }
    
    console.log('\n4. Testing with custom HTTPS implementation (like fetchWithHTTPS)...');
    testWithCustomHTTPS();
}

// Test with a custom HTTPS implementation similar to fetchWithHTTPS
function testWithCustomHTTPS() {
    const url = new URL(manifestUrl);
    
    const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
            'Accept': 'application/json, application/ld+json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept-Encoding': 'gzip, deflate'  // Explicitly support compression
        },
        rejectUnauthorized: false  // For SSL issues
    };
    
    const req = https.request(options, (res) => {
        console.log('   Status:', res.statusCode);
        console.log('   Headers:', res.headers);
        
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            console.log('   Redirect to:', res.headers.location);
            return;
        }
        
        let chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            
            // Handle compression
            if (res.headers['content-encoding'] === 'gzip') {
                const zlib = require('zlib');
                try {
                    const decompressed = zlib.gunzipSync(buffer);
                    const text = decompressed.toString();
                    console.log('   ✓ Successfully decompressed gzip response');
                    console.log('   Decompressed size:', text.length);
                    
                    try {
                        const json = JSON.parse(text);
                        console.log('   ✓ Successfully parsed as JSON');
                        console.log('   Canvas count:', json.sequences?.[0]?.canvases?.length || 0);
                    } catch (parseErr) {
                        console.log('   ✗ JSON parse error:', parseErr.message);
                    }
                } catch (decompressErr) {
                    console.log('   ✗ Decompression error:', decompressErr.message);
                }
            } else {
                const text = buffer.toString();
                console.log('   Response size:', text.length);
                console.log('   First 200 chars:', text.substring(0, 200));
                
                try {
                    const json = JSON.parse(text);
                    console.log('   ✓ Successfully parsed as JSON');
                } catch (parseErr) {
                    console.log('   ✗ JSON parse error:', parseErr.message);
                }
            }
        });
    });
    
    req.on('error', err => {
        console.error('   Request error:', err.message);
    });
    
    req.end();
}

// Helper to detect content type
function detectContentType(content) {
    if (content.trim().startsWith('{') || content.trim().startsWith('[')) return 'JSON';
    if (content.trim().startsWith('<')) return 'HTML/XML';
    if (content.includes('PDF')) return 'PDF';
    return 'Unknown';
}

// Start tests
testTitleInfoPage();