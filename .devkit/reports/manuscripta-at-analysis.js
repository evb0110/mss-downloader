import fs from 'fs';
import https from 'https';

// Test the specific URL that has infinite loading
const testUrl = 'https://manuscripta.at/diglit/AT5000-588/0001';
const manifestUrl = 'https://manuscripta.at/diglit/iiif/AT5000-588/manifest.json';

async function analyzeManuscriptaIssue() {
    console.log('=== Manuscripta.at Issue Analysis ===\n');
    
    // Test 1: Check the IIIF manifest directly
    console.log('1. Testing IIIF Manifest Access...');
    try {
        const manifestResponse = await fetch(manifestUrl);
        console.log(`   Status: ${manifestResponse.status}`);
        console.log(`   Headers: ${JSON.stringify(Object.fromEntries(manifestResponse.headers), null, 2)}`);
        
        if (manifestResponse.ok) {
            const manifestData = await manifestResponse.json();
            console.log(`   Manifest loaded successfully`);
            console.log(`   Canvas count: ${manifestData.sequences?.[0]?.canvases?.length || 'unknown'}`);
            console.log(`   First canvas: ${manifestData.sequences?.[0]?.canvases?.[0]?.['@id'] || 'unknown'}`);
        } else {
            console.log(`   Failed to load manifest: ${manifestResponse.statusText}`);
        }
    } catch (error) {
        console.log(`   Error: ${error.message}`);
    }
    
    console.log('\n2. Testing Page Access Pattern...');
    
    // Test 2: Check the page access pattern that our code uses
    const baseUrl = 'https://manuscripta.at/diglit/AT5000-588';
    
    for (let pageNum = 1; pageNum <= 5; pageNum++) {
        const pageUrl = `${baseUrl}/${pageNum.toString().padStart(4, '0')}`;
        console.log(`   Testing page ${pageNum}: ${pageUrl}`);
        
        try {
            const pageResponse = await fetch(pageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            
            console.log(`     Status: ${pageResponse.status}`);
            
            if (pageResponse.ok) {
                const html = await pageResponse.text();
                
                // Check for the img_max_url pattern our code looks for
                const imgMaxMatch = html.match(/"img_max_url":"([^"]+)"/);
                if (imgMaxMatch) {
                    console.log(`     ✓ Found img_max_url: ${imgMaxMatch[1]}`);
                } else {
                    console.log(`     ✗ No img_max_url found`);
                }
                
                // Check for empty pageInfo (end condition)
                const pageInfoEmptyMatch = html.match(/const pageInfo = {};/);
                if (pageInfoEmptyMatch) {
                    console.log(`     ✗ Empty pageInfo found - would signal end`);
                } else {
                    console.log(`     ✓ PageInfo contains data`);
                }
                
                // Look for any obvious blocking patterns
                if (html.includes('cloudflare') || html.includes('ddos-guard') || html.includes('captcha')) {
                    console.log(`     ⚠️  Potential blocking detected`);
                }
                
                console.log(`     Page size: ${html.length} characters`);
            } else {
                console.log(`     ✗ HTTP ${pageResponse.status}: ${pageResponse.statusText}`);
                if (pageNum === 1) {
                    console.log(`     This would cause our code to break immediately`);
                }
            }
        } catch (error) {
            console.log(`     ✗ Error: ${error.message}`);
        }
        
        // Add delay to avoid hitting rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n3. Testing Rate Limiting Behavior...');
    
    // Test 3: Rapid requests to detect rate limiting
    const requests = [];
    for (let i = 0; i < 10; i++) {
        requests.push(
            fetch(`${baseUrl}/0001`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            }).then(response => ({
                attempt: i + 1,
                status: response.status,
                time: Date.now()
            })).catch(error => ({
                attempt: i + 1,
                error: error.message,
                time: Date.now()
            }))
        );
    }
    
    const startTime = Date.now();
    const results = await Promise.all(requests);
    const endTime = Date.now();
    
    console.log(`   Made 10 requests in ${endTime - startTime}ms`);
    results.forEach(result => {
        if (result.error) {
            console.log(`     Request ${result.attempt}: ERROR - ${result.error}`);
        } else {
            console.log(`     Request ${result.attempt}: HTTP ${result.status}`);
        }
    });
    
    console.log('\n4. Analysis Summary...');
    
    const failedRequests = results.filter(r => r.error || (r.status && r.status >= 400));
    if (failedRequests.length > 0) {
        console.log(`   ⚠️  ${failedRequests.length}/10 requests failed - possible rate limiting`);
    } else {
        console.log(`   ✓ All rapid requests succeeded - no obvious rate limiting`);
    }
    
    console.log('\n=== Analysis Complete ===');
}

// Run the analysis
analyzeManuscriptaIssue().catch(console.error);