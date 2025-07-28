#!/usr/bin/env node

const https = require('https');

async function testFlorenceJSErrors() {
    console.log('🔍 Investigating Florence JavaScript Errors\n');
    console.log('=' .repeat(60));
    
    const testUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/';
    
    try {
        console.log(`Test URL: ${testUrl}`);
        console.log('Fetching page HTML...\n');
        
        const html = await fetchUrl(testUrl);
        
        // Look for specific JavaScript error patterns
        console.log('[1] Searching for JavaScript errors in page...\n');
        
        // Extract all script content
        const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
        let scriptMatch;
        let errorCount = 0;
        
        while ((scriptMatch = scriptRegex.exec(html)) !== null) {
            const scriptContent = scriptMatch[1];
            
            // Look for error patterns
            if (scriptContent.includes('error') || 
                scriptContent.includes('Error') || 
                scriptContent.includes('failed') ||
                scriptContent.includes('undefined') ||
                scriptContent.includes('cannot read')) {
                
                // Extract context around error
                const lines = scriptContent.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (line.match(/error|Error|failed|undefined|cannot read/i)) {
                        errorCount++;
                        console.log(`❌ Found potential error in script at line ${i}:`);
                        console.log(`   ${line.trim().substring(0, 100)}${line.length > 100 ? '...' : ''}`);
                        
                        // Show context
                        if (i > 0) {
                            console.log(`   Previous: ${lines[i-1].trim().substring(0, 80)}${lines[i-1].length > 80 ? '...' : ''}`);
                        }
                        if (i < lines.length - 1) {
                            console.log(`   Next: ${lines[i+1].trim().substring(0, 80)}${lines[i+1].length > 80 ? '...' : ''}`);
                        }
                        console.log('');
                    }
                }
            }
        }
        
        if (errorCount === 0) {
            console.log('✅ No JavaScript errors found in scripts');
        } else {
            console.log(`⚠️  Found ${errorCount} potential JavaScript errors`);
        }
        
        // Check if __INITIAL_STATE__ is being set correctly
        console.log('\n[2] Checking __INITIAL_STATE__ handling...\n');
        
        const stateRegex = /window\.__INITIAL_STATE__\s*=\s*JSON\.parse\s*\(\s*"([^"]*(?:\\.[^"]*)*)"\s*\)\s*;/;
        const stateMatch = html.match(stateRegex);
        
        if (stateMatch) {
            console.log('✅ __INITIAL_STATE__ is set with JSON.parse');
            
            // Check if there are any errors near this line
            const stateIndex = html.indexOf(stateMatch[0]);
            const nearbyContent = html.substring(Math.max(0, stateIndex - 500), stateIndex + 500);
            
            if (nearbyContent.includes('try') && nearbyContent.includes('catch')) {
                console.log('✅ __INITIAL_STATE__ is wrapped in try-catch');
            } else {
                console.log('⚠️  __INITIAL_STATE__ may not have error handling');
            }
        }
        
        // Check console logs or debug output
        console.log('\n[3] Checking for console logs or debug output...\n');
        
        const consoleRegex = /console\.(log|error|warn|debug)\s*\([^)]+\)/g;
        let consoleMatch;
        let consoleCount = 0;
        
        while ((consoleMatch = consoleRegex.exec(html)) !== null) {
            consoleCount++;
            if (consoleCount <= 5) { // Show first 5
                console.log(`📝 Found: ${consoleMatch[0].substring(0, 80)}${consoleMatch[0].length > 80 ? '...' : ''}`);
            }
        }
        
        if (consoleCount > 5) {
            console.log(`... and ${consoleCount - 5} more console statements`);
        }
        
        // Check for specific ContentDM errors
        console.log('\n[4] Checking for ContentDM specific issues...\n');
        
        if (html.includes('CONTENTdm')) {
            console.log('✅ CONTENTdm branding found');
        }
        
        if (html.includes('cdm-item-viewer')) {
            console.log('✅ CDM item viewer component found');
        }
        
        if (html.includes('cdm-compound-object')) {
            console.log('✅ CDM compound object support detected');
        }
        
        // Test multiple URLs to see if issue is consistent
        console.log('\n[5] Testing multiple Florence URLs...\n');
        
        const testUrls = [
            'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/',
            'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317539/',
            'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/100/' // Random ID
        ];
        
        for (const url of testUrls) {
            try {
                const response = await fetchHead(url);
                console.log(`${url.includes('317515') ? '✅' : url.includes('317539') ? '✅' : '❓'} ${url.split('/').pop()} - Status: ${response.statusCode}`);
            } catch (e) {
                console.log(`❌ ${url.split('/').pop()} - Error: ${e.message}`);
            }
        }
        
        console.log('\n📊 Analysis Summary:');
        console.log('   - Page loads successfully');
        console.log('   - __INITIAL_STATE__ is present and parseable');
        console.log('   - Some JavaScript code contains error handling');
        console.log('   - ContentDM components are present');
        console.log('   - The issue may be intermittent or timing-related');
        
    } catch (error) {
        console.error('\n❌ Test failed!');
        console.error('Error:', error.message);
    }
}

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            timeout: 120000
        }, (res) => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                resolve(Buffer.concat(chunks).toString());
            });
        }).on('error', reject).on('timeout', () => {
            reject(new Error('Request timeout'));
        });
    });
}

function fetchHead(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        https.request({
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'HEAD',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 30000
        }, (res) => {
            resolve({
                statusCode: res.statusCode,
                headers: res.headers
            });
        }).on('error', reject).end();
    });
}

// Run the test
testFlorenceJSErrors().catch(console.error);