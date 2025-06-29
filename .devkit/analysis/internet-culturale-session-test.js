#!/usr/bin/env node

/**
 * Internet Culturale Session Management Test
 * 
 * This script tests session management and authentication behavior for Internet Culturale
 * to identify potential causes of library pages being returned instead of manuscript images.
 */

import https from 'https';
import http from 'http';

// Test URLs based on the Internet Culturale implementation
const TEST_MANUSCRIPT_URL = 'https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Abncf.firenze.sbn.it%3A21%3AFI0098%3AManoscrittiInRete%3AB.R.231&mode=all&teca=Bncf';
const TEST_OAI_ID = 'oai:bncf.firenze.sbn.it:21:FI0098:ManoscrittiInRete:B.R.231';
const TEST_TECA = 'Bncf';

/**
 * Make HTTP request with cookie tracking
 */
function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const client = isHttps ? https : http;
        
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/xml, application/xml, */*; q=0.01',
                'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
                'Referer': TEST_MANUSCRIPT_URL,
                'X-Requested-With': 'XMLHttpRequest',
                ...options.headers
            }
        };
        
        console.log(`Making request to: ${url}`);
        console.log(`Headers:`, JSON.stringify(requestOptions.headers, null, 2));
        
        const req = client.request(requestOptions, (res) => {
            let data = '';
            
            console.log(`Response status: ${res.statusCode}`);
            console.log(`Response headers:`, JSON.stringify(res.headers, null, 2));
            
            // Track cookies from response
            const cookies = res.headers['set-cookie'];
            if (cookies) {
                console.log(`Cookies received:`, cookies);
            }
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: data,
                    cookies: cookies || []
                });
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

/**
 * Test session behavior
 */
async function testSessionBehavior() {
    console.log('=== Internet Culturale Session Management Test ===\n');
    
    try {
        // Step 1: Get the XML manifest (like the loadInternetCulturaleManifest function)
        const apiUrl = `https://www.internetculturale.it/jmms/magparser?id=${encodeURIComponent(TEST_OAI_ID)}&teca=${encodeURIComponent(TEST_TECA)}&mode=all&fulltext=0`;
        
        console.log('Step 1: Fetching XML manifest from magparser API...');
        const manifestResponse = await makeRequest(apiUrl);
        
        if (manifestResponse.statusCode !== 200) {
            throw new Error(`Failed to get manifest: HTTP ${manifestResponse.statusCode}`);
        }
        
        console.log(`Manifest XML length: ${manifestResponse.data.length} bytes`);
        
        // Extract page URLs from XML (simplified version)
        const pageRegex = /<page[^>]+src="([^"]+)"[^>]*>/g;
        const pageUrls = [];
        let match;
        
        while ((match = pageRegex.exec(manifestResponse.data)) !== null) {
            let relativePath = match[1];
            
            // Fix Florence URL issue: use 'web' instead of 'normal' for working images
            if (relativePath.includes('cacheman/normal/')) {
                relativePath = relativePath.replace('cacheman/normal/', 'cacheman/web/');
            }
            
            const imageUrl = `https://www.internetculturale.it/jmms/${relativePath}`;
            pageUrls.push(imageUrl);
        }
        
        console.log(`Found ${pageUrls.length} page URLs`);
        
        if (pageUrls.length === 0) {
            console.log('XML Response sample:', manifestResponse.data.substring(0, 1000));
            throw new Error('No page URLs found in manifest');
        }
        
        // Step 2: Test downloading multiple images in sequence to check for session issues
        console.log('\nStep 2: Testing sequential image downloads...');
        
        let sessionCookies = manifestResponse.cookies.join('; ') || '';
        console.log(`Using session cookies: ${sessionCookies}`);
        
        const testUrls = pageUrls.slice(0, Math.min(5, pageUrls.length)); // Test first 5 images
        
        for (let i = 0; i < testUrls.length; i++) {
            const imageUrl = testUrls[i];
            console.log(`\nDownloading image ${i + 1}/${testUrls.length}: ${imageUrl}`);
            
            const headers = {
                'Cookie': sessionCookies,
                'Referer': 'https://www.internetculturale.it/',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            };
            
            try {
                const imageResponse = await makeRequest(imageUrl, { headers });
                
                console.log(`Image response status: ${imageResponse.statusCode}`);
                console.log(`Content-Type: ${imageResponse.headers['content-type']}`);
                console.log(`Content-Length: ${imageResponse.headers['content-length']}`);
                
                // Check if we got an actual image vs an error page
                if (imageResponse.headers['content-type']) {
                    const contentType = imageResponse.headers['content-type'].toLowerCase();
                    if (contentType.includes('image/')) {
                        console.log(`✓ Received valid image (${contentType})`);
                    } else if (contentType.includes('text/html')) {
                        console.log(`✗ Received HTML page instead of image - potential session issue!`);
                        console.log(`HTML content sample:`, imageResponse.data.substring(0, 500));
                    } else {
                        console.log(`? Received unexpected content type: ${contentType}`);
                    }
                } else {
                    console.log(`? No content-type header in response`);
                }
                
                // Update session cookies if new ones are provided
                if (imageResponse.cookies.length > 0) {
                    console.log(`Updated session cookies:`, imageResponse.cookies);
                    sessionCookies = imageResponse.cookies.join('; ');
                }
                
            } catch (error) {
                console.log(`✗ Error downloading image: ${error.message}`);
            }
            
            // Add delay between requests to simulate real usage
            if (i < testUrls.length - 1) {
                console.log('Waiting 2 seconds before next request...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        // Step 3: Test concurrent downloads to check for session conflicts
        console.log('\nStep 3: Testing concurrent image downloads...');
        
        const concurrentUrls = pageUrls.slice(5, Math.min(10, pageUrls.length)); // Test next 5 images
        
        if (concurrentUrls.length > 0) {
            const concurrentPromises = concurrentUrls.map(async (imageUrl, index) => {
                console.log(`Starting concurrent download ${index + 1}: ${imageUrl}`);
                
                const headers = {
                    'Cookie': sessionCookies,
                    'Referer': 'https://www.internetculturale.it/',
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                    'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                };
                
                try {
                    const imageResponse = await makeRequest(imageUrl, { headers });
                    
                    const result = {
                        index: index + 1,
                        url: imageUrl,
                        status: imageResponse.statusCode,
                        contentType: imageResponse.headers['content-type'] || 'unknown',
                        isImage: imageResponse.headers['content-type'] && 
                                imageResponse.headers['content-type'].toLowerCase().includes('image/'),
                        isHtml: imageResponse.headers['content-type'] && 
                               imageResponse.headers['content-type'].toLowerCase().includes('text/html')
                    };
                    
                    console.log(`Concurrent download ${index + 1} result:`, result);
                    return result;
                    
                } catch (error) {
                    console.log(`Concurrent download ${index + 1} failed: ${error.message}`);
                    return {
                        index: index + 1,
                        url: imageUrl,
                        error: error.message
                    };
                }
            });
            
            const concurrentResults = await Promise.all(concurrentPromises);
            
            console.log('\nConcurrent download summary:');
            const imageCount = concurrentResults.filter(r => r.isImage).length;
            const htmlCount = concurrentResults.filter(r => r.isHtml).length;
            const errorCount = concurrentResults.filter(r => r.error).length;
            
            console.log(`- Valid images: ${imageCount}/${concurrentResults.length}`);
            console.log(`- HTML responses: ${htmlCount}/${concurrentResults.length}`);
            console.log(`- Errors: ${errorCount}/${concurrentResults.length}`);
            
            if (htmlCount > 0) {
                console.log('⚠️  HTML responses detected in concurrent downloads - session management issue likely!');
            }
        }
        
        console.log('\n=== Test completed ===');
        
    } catch (error) {
        console.error('Test failed:', error.message);
        process.exit(1);
    }
}

// Run the test
testSessionBehavior().catch(console.error);