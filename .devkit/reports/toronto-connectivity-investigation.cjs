#!/usr/bin/env node

/**
 * University of Toronto Library - Connectivity Investigation
 * 
 * This script investigates the connectivity issues discovered in the comprehensive test
 * and attempts to find working endpoints or alternative access methods.
 */

const https = require('https');
const { URL } = require('url');

const TEST_ITEM_ID = 'fisher2:F6521';

// Enhanced fetch with different user agents and headers
async function fetchWithOptions(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': options.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': options.accept || 'application/json,text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Upgrade-Insecure-Requests': '1',
                ...options.headers
            },
            timeout: options.timeout || 30000,
            rejectUnauthorized: false
        };
        
        const req = https.request(requestOptions, (res) => {
            const chunks = [];
            
            res.on('data', (chunk) => {
                chunks.push(chunk);
            });
            
            res.on('end', () => {
                const body = Buffer.concat(chunks);
                resolve({
                    statusCode: res.statusCode,
                    statusMessage: res.statusMessage,
                    headers: res.headers,
                    body: body.toString()
                });
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

// Test basic connectivity to University of Toronto
async function testBasicConnectivity() {
    console.log('🔍 Testing basic connectivity to University of Toronto...\n');
    
    const endpoints = [
        'https://collections.library.utoronto.ca',
        'https://iiif.library.utoronto.ca',
        'https://library.utoronto.ca',
        'https://www.library.utoronto.ca'
    ];
    
    for (const endpoint of endpoints) {
        console.log(`Testing: ${endpoint}`);
        
        try {
            const response = await fetchWithOptions(endpoint, { timeout: 15000 });
            console.log(`  Status: ${response.statusCode} ✓`);
            console.log(`  Content-Type: ${response.headers['content-type']}`);
            
            if (response.body.length > 0) {
                console.log(`  Content Length: ${response.body.length} bytes`);
                if (response.body.toLowerCase().includes('university of toronto')) {
                    console.log(`  Contains UofT content: ✓`);
                }
            }
            
        } catch (error) {
            console.log(`  Error: ${error.message} ❌`);
        }
        
        console.log('');
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

// Test alternative manifest URL patterns with different approaches
async function testAlternativeManifestPatterns() {
    console.log('🔍 Testing alternative manifest URL patterns...\n');
    
    const itemId = TEST_ITEM_ID;
    const patterns = [
        // Direct IIIF patterns
        `https://iiif.library.utoronto.ca/presentation/${itemId}/manifest`,
        `https://iiif.library.utoronto.ca/presentation/${itemId}/manifest.json`,
        `https://iiif.library.utoronto.ca/presentation/v2/${itemId}/manifest`,
        `https://iiif.library.utoronto.ca/presentation/v3/${itemId}/manifest`,
        
        // URL encoded patterns
        `https://iiif.library.utoronto.ca/presentation/${itemId.replace(':', '%3A')}/manifest`,
        `https://iiif.library.utoronto.ca/presentation/v2/${itemId.replace(':', '%3A')}/manifest`,
        
        // Collections API patterns
        `https://collections.library.utoronto.ca/iiif/${itemId}/manifest`,
        `https://collections.library.utoronto.ca/api/iiif/${itemId}/manifest`,
        `https://collections.library.utoronto.ca/manifest/${itemId}`,
        `https://collections.library.utoronto.ca/manifest/${itemId}.json`,
        
        // Alternative patterns
        `https://collections.library.utoronto.ca/rest/presentation/${itemId}/manifest`,
        `https://digital.library.utoronto.ca/iiif/${itemId}/manifest`
    ];
    
    const userAgents = [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
    
    let workingPattern = null;
    
    for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i];
        const userAgent = userAgents[i % userAgents.length];
        
        console.log(`${i + 1}. Testing: ${pattern}`);
        console.log(`   User-Agent: ${userAgent.substring(0, 50)}...`);
        
        try {
            const response = await fetchWithOptions(pattern, {
                timeout: 25000,
                userAgent,
                accept: 'application/json,application/ld+json,text/json,*/*',
                headers: {
                    'Referer': 'https://collections.library.utoronto.ca/'
                }
            });
            
            console.log(`   Status: ${response.statusCode}`);
            console.log(`   Content-Type: ${response.headers['content-type'] || 'Not specified'}`);
            
            if (response.statusCode === 200) {
                const contentType = response.headers['content-type'] || '';
                const body = response.body;
                
                if (contentType.includes('json') || body.includes('"@context"')) {
                    console.log(`   ✓ JSON/IIIF content detected`);
                    
                    try {
                        const manifest = JSON.parse(body);
                        if (manifest['@context'] && (manifest['@type'] || manifest.type)) {
                            console.log(`   ✓ Valid IIIF manifest found!`);
                            workingPattern = { url: pattern, manifest, userAgent };
                            break;
                        }
                    } catch {
                        console.log(`   ⚠️  JSON parsing failed`);
                    }
                } else {
                    console.log(`   ⚠️  Non-JSON response: ${body.substring(0, 100)}...`);
                }
            } else if (response.statusCode === 404) {
                console.log(`   ❌ Not found`);
            } else if (response.statusCode >= 500) {
                console.log(`   ❌ Server error`);
            } else {
                console.log(`   ⚠️  Unexpected status`);
            }
            
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
        
        console.log('');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Longer delay to be respectful
    }
    
    return workingPattern;
}

// Test the collections page to find manifest links
async function testCollectionsPageAnalysis() {
    console.log('🔍 Analyzing collections page for manifest discovery...\n');
    
    const collectionsUrl = `https://collections.library.utoronto.ca/view/${TEST_ITEM_ID}`;
    
    try {
        console.log(`Fetching: ${collectionsUrl}`);
        
        const response = await fetchWithOptions(collectionsUrl, {
            timeout: 30000,
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        });
        
        console.log(`Status: ${response.statusCode}`);
        
        if (response.statusCode === 200) {
            const html = response.body;
            console.log(`Page content length: ${html.length} characters`);
            
            // Look for IIIF manifest references
            const manifestPatterns = [
                /manifest[\"']?\\s*:\\s*[\"']([^\"']+)[\"']/gi,
                /manifest[\"']?\\s*=\\s*[\"']([^\"']+)[\"']/gi,
                /iiif[^\"']*manifest[^\"']*[\"']([^\"']+)[\"']/gi,
                /[\"']([^\"']*iiif[^\"']*manifest[^\"']*)[\"']/gi,
                /src\\s*=\\s*[\"']([^\"']*manifest[^\"']*)[\"']/gi
            ];
            
            const foundManifests = [];
            
            manifestPatterns.forEach((pattern, index) => {
                const matches = [...html.matchAll(pattern)];
                matches.forEach(match => {
                    if (match[1] && match[1].includes('iiif')) {
                        foundManifests.push(match[1]);
                    }
                });
            });
            
            if (foundManifests.length > 0) {
                console.log(`Found ${foundManifests.length} potential manifest URLs:`);
                foundManifests.forEach((url, index) => {
                    console.log(`  ${index + 1}. ${url}`);
                });
                return foundManifests;
            } else {
                console.log('No manifest URLs found in page source');
                
                // Look for other IIIF-related content
                const iiifMatches = [...html.matchAll(/iiif[^\\s<>\"']{10,}/gi)];
                if (iiifMatches.length > 0) {
                    console.log('Found IIIF-related content:');
                    iiifMatches.slice(0, 5).forEach((match, index) => {
                        console.log(`  ${index + 1}. ${match[0]}`);
                    });
                }
            }
        } else {
            console.log(`Failed to fetch collections page: HTTP ${response.statusCode}`);
        }
        
    } catch (error) {
        console.log(`Error fetching collections page: ${error.message}`);
    }
    
    return [];
}

// Test with curl as a fallback
async function testWithCurl() {
    console.log('🔍 Testing with curl as fallback...\n');
    
    const { spawn } = require('child_process');
    
    const testUrls = [
        `https://iiif.library.utoronto.ca/presentation/v2/${TEST_ITEM_ID}/manifest`,
        `https://collections.library.utoronto.ca/view/${TEST_ITEM_ID}`
    ];
    
    for (const url of testUrls) {
        console.log(`Testing with curl: ${url}`);
        
        try {
            await new Promise((resolve, reject) => {
                const curl = spawn('curl', [
                    '-s', '-L', '-k', // silent, follow redirects, ignore SSL errors
                    '--connect-timeout', '30',
                    '--max-time', '60',
                    '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    '-H', 'Accept: application/json,text/html,*/*',
                    '-w', '\\nHTTP_CODE:%{http_code}\\nREDIRECT_URL:%{redirect_url}\\n',
                    url
                ]);
                
                let output = '';
                let errorOutput = '';
                
                curl.stdout.on('data', (data) => {
                    output += data.toString();
                });
                
                curl.stderr.on('data', (data) => {
                    errorOutput += data.toString();
                });
                
                curl.on('close', (code) => {
                    console.log(`  Exit code: ${code}`);
                    
                    if (output) {
                        const lines = output.split('\\n');
                        const httpCode = lines.find(line => line.startsWith('HTTP_CODE:'))?.split(':')[1];
                        const redirectUrl = lines.find(line => line.startsWith('REDIRECT_URL:'))?.split(':')[1];
                        
                        console.log(`  HTTP Code: ${httpCode || 'Unknown'}`);
                        if (redirectUrl) {
                            console.log(`  Redirect URL: ${redirectUrl}`);
                        }
                        
                        const content = lines.slice(0, -3).join('\\n'); // Remove status lines
                        if (content.length > 0) {
                            console.log(`  Content length: ${content.length} characters`);
                            if (content.includes('"@context"')) {
                                console.log(`  ✓ IIIF manifest content detected`);
                            } else if (content.includes('University of Toronto')) {
                                console.log(`  ✓ UofT page content detected`);
                            }
                        }
                    }
                    
                    if (errorOutput) {
                        console.log(`  Curl error: ${errorOutput.trim()}`);
                    }
                    
                    resolve();
                });
                
                curl.on('error', (error) => {
                    console.log(`  Spawn error: ${error.message}`);
                    resolve();
                });
            });
            
        } catch (error) {
            console.log(`  Error: ${error.message}`);
        }
        
        console.log('');
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

// Main investigation
async function runConnectivityInvestigation() {
    console.log('🔬 UNIVERSITY OF TORONTO LIBRARY - CONNECTIVITY INVESTIGATION');
    console.log('==============================================================');
    console.log(`Target Item: ${TEST_ITEM_ID}`);
    console.log('==============================================================\\n');
    
    try {
        // Test 1: Basic connectivity
        await testBasicConnectivity();
        
        // Test 2: Alternative manifest patterns
        const workingPattern = await testAlternativeManifestPatterns();
        
        // Test 3: Collections page analysis
        const manifestsFromPage = await testCollectionsPageAnalysis();
        
        // Test 4: Curl fallback
        await testWithCurl();
        
        // Summary
        console.log('\\n==============================================================');
        console.log('📊 INVESTIGATION SUMMARY');
        console.log('==============================================================');
        
        if (workingPattern) {
            console.log('✅ SUCCESS: Found working manifest pattern!');
            console.log(`   URL: ${workingPattern.url}`);
            console.log(`   User-Agent: ${workingPattern.userAgent}`);
            console.log('\\nThis can be used to fix the implementation.');
        } else {
            console.log('❌ No working manifest patterns found');
            console.log('\\nPossible issues:');
            console.log('- Geographic access restrictions');
            console.log('- University network-only access');
            console.log('- Temporary server issues');
            console.log('- Authentication requirements');
            console.log('- API endpoint changes');
        }
        
        if (manifestsFromPage.length > 0) {
            console.log('\\n📋 Alternative manifest URLs from collections page:');
            manifestsFromPage.forEach((url, index) => {
                console.log(`   ${index + 1}. ${url}`);
            });
        }
        
        console.log('\\n==============================================================');
        
    } catch (error) {
        console.error(`Investigation failed: ${error.message}`);
        process.exit(1);
    }
}

// Execute if run directly
if (require.main === module) {
    runConnectivityInvestigation()
        .then(() => {
            console.log('Investigation completed.');
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { runConnectivityInvestigation };