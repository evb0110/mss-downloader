const https = require('https');
const zlib = require('zlib');

// The zoomData appears to be base64 encoded and possibly compressed
const zoomData = 'eNpLtDK0qs60MrROtDKyqi4G8pQKlKyLrYyBDH1HfUN9U30LfUt9EyBpqm9cMAS6YBRvYKAPUgZUlaZknWRlYF1bC1wwuzYSCg,,';

console.log('Analyzing Belgica KBR zoomData...\n');

// Try to decode
try {
    // Remove trailing commas
    const cleanData = zoomData.replace(/,+$/, '');
    
    // Base64 decode
    const decoded = Buffer.from(cleanData, 'base64');
    console.log('Base64 decoded (raw bytes):', decoded);
    console.log('Base64 decoded (hex):', decoded.toString('hex'));
    
    // Try to decompress as zlib
    try {
        const decompressed = zlib.inflateSync(decoded);
        console.log('\nDecompressed data:', decompressed.toString());
    } catch (e) {
        console.log('\nNot zlib compressed or different compression');
    }
} catch (error) {
    console.log('Error decoding:', error.message);
}

// Let's also check the map parameter pattern
const mapParam = 'A/1/5/8/9/4/8/5/0000-00-00_00/';
console.log('\n\nAnalyzing map parameter:', mapParam);
console.log('This appears to be a hierarchical path structure');

// Test direct image access patterns
async function testImagePatterns() {
    console.log('\n\nTesting potential image URL patterns...\n');
    
    const baseUrls = [
        'https://viewerd.kbr.be/',
        'https://belgica.kbr.be/'
    ];
    
    const patterns = [
        'pic/zoom/A/1/5/8/9/4/8/5/0000-00-00_00/image_1.jpg',
        'images/A/1/5/8/9/4/8/5/0000-00-00_00/page_1.jpg',
        'A/1/5/8/9/4/8/5/0000-00-00_00/1.jpg',
        'gallery/A/1/5/8/9/4/8/5/0000-00-00_00/001.jpg',
        'map/A/1/5/8/9/4/8/5/0000-00-00_00/page001.jpg'
    ];
    
    for (const baseUrl of baseUrls) {
        for (const pattern of patterns) {
            const testUrl = baseUrl + pattern;
            try {
                const response = await fetchWithHTTPS(testUrl);
                if (response.status === 200) {
                    console.log(`✓ Found working pattern: ${testUrl}`);
                } else {
                    console.log(`✗ ${response.status} - ${pattern}`);
                }
            } catch (error) {
                console.log(`✗ Error - ${pattern}`);
            }
        }
    }
}

async function fetchWithHTTPS(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        https.get({
            hostname: urlObj.hostname,
            path: urlObj.pathname,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            rejectUnauthorized: false
        }, (res) => {
            resolve({ status: res.statusCode });
        }).on('error', reject);
    });
}

testImagePatterns();