const https = require('https');
const fs = require('fs');
const path = require('path');

// Test configuration
const BASE_URL = 'https://viewerd.kbr.be/display/A/1/5/8/9/4/8/5/0000-00-00_00/zoomtiles/BE-KBR00_A-1589485_0000-00-00_00_0001/';
const VIEWER_URL = 'https://www.heritage-visualisation.org/belgica/document/10745220';
const DOCUMENT_URL = 'https://viewerd.kbr.be/display/A/1/5/8/9/4/8/5/0000-00-00_00/';
const TEST_DIR = '.devkit/reports/belgica-tiles-samples/';

// HTTP request function with proper referrer
function downloadTileWithReferrer(url, filename, referrer) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Referer': referrer,
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'cross-site',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            timeout: 15000
        }, (res) => {
            if (res.statusCode === 200) {
                const fileStream = fs.createWriteStream(filename);
                res.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    const stats = fs.statSync(filename);
                    resolve({ 
                        success: true, 
                        statusCode: res.statusCode, 
                        contentType: res.headers['content-type'],
                        size: stats.size,
                        headers: res.headers
                    });
                });
            } else {
                resolve({ 
                    success: false, 
                    statusCode: res.statusCode, 
                    error: `HTTP ${res.statusCode}`,
                    headers: res.headers
                });
            }
        });
        
        req.on('error', (err) => {
            resolve({ success: false, error: err.message });
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve({ success: false, error: 'Request timeout' });
        });
    });
}

// Get HTML content from URL
function getPageContent(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 15000
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({
                    success: true,
                    statusCode: res.statusCode,
                    content: data,
                    headers: res.headers
                });
            });
        });
        
        req.on('error', (err) => {
            resolve({ success: false, error: err.message });
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve({ success: false, error: 'Request timeout' });
        });
    });
}

// Test different referrer sources
async function testReferrerVariations() {
    console.log('\n=== TESTING REFERRER VARIATIONS ===');
    
    const testTileUrl = `${BASE_URL}0-0-0.jpg`;
    const referrerTests = [
        { name: 'Heritage Visualisation', url: 'https://www.heritage-visualisation.org/' },
        { name: 'Belgica Document', url: VIEWER_URL },
        { name: 'KBR Display', url: DOCUMENT_URL },
        { name: 'KBR Base', url: 'https://viewerd.kbr.be/' },
        { name: 'Heritage Belgica', url: 'https://www.heritage-visualisation.org/belgica/' },
        { name: 'Heritage Belgica Document', url: 'https://www.heritage-visualisation.org/belgica/document/' },
        { name: 'Direct KBR', url: 'https://viewerd.kbr.be/display/' }
    ];
    
    const results = [];
    
    for (const test of referrerTests) {
        console.log(`Testing referrer: ${test.name} (${test.url})`);
        const filename = path.join(TEST_DIR, `referrer-test-${test.name.replace(/\s+/g, '-').toLowerCase()}.jpg`);
        
        const result = await downloadTileWithReferrer(testTileUrl, filename, test.url);
        results.push({
            referrer: test.name,
            referrerUrl: test.url,
            ...result
        });
        
        if (result.success) {
            console.log(`✓ ${test.name}: SUCCESS - ${result.size} bytes`);
        } else {
            console.log(`✗ ${test.name}: ${result.error || result.statusCode}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    return results;
}

// Analyze the viewer page structure
async function analyzeViewerPage() {
    console.log('\n=== ANALYZING VIEWER PAGE ===');
    
    console.log('Fetching Belgica viewer page...');
    const viewerResult = await getPageContent(VIEWER_URL);
    
    if (viewerResult.success) {
        const viewerFile = path.join(TEST_DIR, 'belgica-viewer-page.html');
        fs.writeFileSync(viewerFile, viewerResult.content);
        console.log(`✓ Viewer page saved to: ${viewerFile}`);
        
        // Look for viewer initialization and tile patterns
        const content = viewerResult.content;
        const viewerAnalysis = {
            hasAxZoom: content.includes('axZoom') || content.includes('ax-zoom'),
            hasOpenSeadragon: content.includes('OpenSeadragon') || content.includes('openseadragon'),
            hasLeaflet: content.includes('Leaflet') || content.includes('leaflet'),
            hasZoomify: content.includes('Zoomify') || content.includes('zoomify'),
            hasIIIF: content.includes('IIIF') || content.includes('iiif'),
            tileUrls: extractTileUrls(content),
            configPatterns: extractConfigPatterns(content),
            scripts: extractScripts(content)
        };
        
        console.log('Viewer analysis:');
        console.log(`- AxZoom: ${viewerAnalysis.hasAxZoom}`);
        console.log(`- OpenSeadragon: ${viewerAnalysis.hasOpenSeadragon}`);
        console.log(`- Leaflet: ${viewerAnalysis.hasLeaflet}`);
        console.log(`- Zoomify: ${viewerAnalysis.hasZoomify}`);
        console.log(`- IIIF: ${viewerAnalysis.hasIIIF}`);
        console.log(`- Tile URLs found: ${viewerAnalysis.tileUrls.length}`);
        console.log(`- Config patterns: ${viewerAnalysis.configPatterns.length}`);
        
        return viewerAnalysis;
    } else {
        console.log(`✗ Failed to fetch viewer page: ${viewerResult.error}`);
        return null;
    }
}

// Extract tile URLs from HTML content
function extractTileUrls(content) {
    const tilePatterns = [
        /https?:\/\/[^"'\s]+zoomtiles[^"'\s]*/g,
        /https?:\/\/[^"'\s]+\/\d+-\d+-\d+\.jpg/g,
        /https?:\/\/viewerd\.kbr\.be[^"'\s]*/g
    ];
    
    const urls = [];
    for (const pattern of tilePatterns) {
        const matches = content.match(pattern);
        if (matches) {
            urls.push(...matches);
        }
    }
    
    return [...new Set(urls)];
}

// Extract configuration patterns
function extractConfigPatterns(content) {
    const configPatterns = [
        /zoom.*?config.*?{[^}]*}/gi,
        /tile.*?config.*?{[^}]*}/gi,
        /axZoom.*?{[^}]*}/gi,
        /OpenSeadragon.*?{[^}]*}/gi,
        /new.*?Viewer.*?\([^)]*\)/gi
    ];
    
    const configs = [];
    for (const pattern of configPatterns) {
        const matches = content.match(pattern);
        if (matches) {
            configs.push(...matches);
        }
    }
    
    return configs;
}

// Extract script sources
function extractScripts(content) {
    const scriptPattern = /<script[^>]*src=["']([^"']*)[^>]*>/gi;
    const scripts = [];
    let match;
    
    while ((match = scriptPattern.exec(content)) !== null) {
        scripts.push(match[1]);
    }
    
    return scripts;
}

// Test with session cookies
async function testWithCookies() {
    console.log('\n=== TESTING WITH COOKIES ===');
    
    // First, visit the viewer page to get session cookies
    const viewerResult = await getPageContent(VIEWER_URL);
    
    if (viewerResult.success && viewerResult.headers['set-cookie']) {
        const cookies = viewerResult.headers['set-cookie'];
        console.log('Cookies received:', cookies);
        
        // Try to use the cookies for tile access
        const testTileUrl = `${BASE_URL}0-0-0.jpg`;
        const filename = path.join(TEST_DIR, 'cookie-test.jpg');
        
        const result = await downloadTileWithCookies(testTileUrl, filename, cookies, VIEWER_URL);
        
        if (result.success) {
            console.log(`✓ Cookie access successful: ${result.size} bytes`);
        } else {
            console.log(`✗ Cookie access failed: ${result.error || result.statusCode}`);
        }
        
        return result;
    } else {
        console.log('No cookies received from viewer page');
        return null;
    }
}

// Download tile with cookies
function downloadTileWithCookies(url, filename, cookies, referrer) {
    return new Promise((resolve, reject) => {
        const cookieString = Array.isArray(cookies) ? cookies.join('; ') : cookies;
        
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Referer': referrer,
                'Cookie': cookieString,
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'cross-site',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            timeout: 15000
        }, (res) => {
            if (res.statusCode === 200) {
                const fileStream = fs.createWriteStream(filename);
                res.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    const stats = fs.statSync(filename);
                    resolve({ 
                        success: true, 
                        statusCode: res.statusCode, 
                        contentType: res.headers['content-type'],
                        size: stats.size,
                        headers: res.headers
                    });
                });
            } else {
                resolve({ 
                    success: false, 
                    statusCode: res.statusCode, 
                    error: `HTTP ${res.statusCode}`,
                    headers: res.headers
                });
            }
        });
        
        req.on('error', (err) => {
            resolve({ success: false, error: err.message });
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve({ success: false, error: 'Request timeout' });
        });
    });
}

// Main investigation function
async function investigateBelgicaAuth() {
    console.log('🔍 BELGICA KBR AUTHENTICATION INVESTIGATION');
    console.log('=========================================');
    
    const investigation = {
        timestamp: new Date().toISOString(),
        testDirectory: TEST_DIR
    };
    
    try {
        // Test referrer variations
        investigation.referrerTests = await testReferrerVariations();
        
        // Analyze viewer page
        investigation.viewerAnalysis = await analyzeViewerPage();
        
        // Test with cookies
        investigation.cookieTest = await testWithCookies();
        
        // Save investigation results
        const resultsFile = path.join(TEST_DIR, 'auth-investigation-results.json');
        fs.writeFileSync(resultsFile, JSON.stringify(investigation, null, 2));
        
        console.log('\n✅ AUTHENTICATION INVESTIGATION COMPLETE');
        console.log(`Results saved to: ${resultsFile}`);
        
        // Find successful tests
        const successfulReferrers = investigation.referrerTests.filter(t => t.success);
        if (successfulReferrers.length > 0) {
            console.log('\n🎉 SUCCESS! Working referrers found:');
            successfulReferrers.forEach(test => {
                console.log(`✓ ${test.referrer}: ${test.referrerUrl}`);
            });
        } else {
            console.log('\n❌ No successful referrers found');
        }
        
        return investigation;
        
    } catch (error) {
        console.error('❌ Investigation failed:', error);
        throw error;
    }
}

// Run the investigation
if (require.main === module) {
    investigateBelgicaAuth().catch(console.error);
}

module.exports = { investigateBelgicaAuth };