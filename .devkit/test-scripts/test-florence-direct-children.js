#!/usr/bin/env node

/**
 * Test Florence direct children extraction from original page 
 * since that's where we saw the data in debug
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function testFlorenceDirectChildren() {
    console.log('=== Test Florence Direct Children ===\n');
    
    try {
        const manifestLoaders = new SharedManifestLoaders();
        
        // Get original page that we know has the children data
        const pageUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515';
        console.log('Fetching original page:', pageUrl);
        
        const pageResponse = await manifestLoaders.fetchWithRetry(pageUrl);
        
        if (pageResponse.ok) {
            const html = await pageResponse.text();
            console.log('Page HTML length:', html.length);
            
            // From the debug output, we saw that there are hundreds of children objects
            // Let's search more broadly for the data structure we saw
            
            console.log('\nSearching for children data...');
            
            // Look for the specific structure we saw in the debug
            if (html.includes('"children":[{')) {
                console.log('✅ Found children array with objects');
                
                const childrenStart = html.indexOf('"children":[{');
                let bracketCount = 0;
                let i = childrenStart + 12; // Skip to after "children":
                let childrenEnd = -1;
                
                // Find the end of the children array by counting brackets
                while (i < html.length) {
                    if (html[i] === '[') bracketCount++;
                    else if (html[i] === ']') {
                        bracketCount--;
                        if (bracketCount === 0) {
                            childrenEnd = i;
                            break;
                        }
                    }
                    i++;
                }
                
                if (childrenEnd > 0) {
                    const childrenData = html.substring(childrenStart + 12, childrenEnd);
                    console.log('Children data length:', childrenData.length);
                    
                    const idMatches = [...childrenData.matchAll(/"id":(\d+)/g)];
                    console.log(`Found ${idMatches.length} child IDs`);
                    
                    if (idMatches.length > 0) {
                        console.log('First 10 child IDs:', idMatches.slice(0, 10).map(m => m[1]));
                        
                        // Test first child URL
                        const firstId = idMatches[0][1];
                        const testUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${firstId}/full/max/0/default.jpg`;
                        console.log('\nTesting first child URL:', testUrl);
                        
                        const https = require('https');
                        const result = await new Promise((resolve) => {
                            https.get(testUrl, (response) => {
                                resolve({ success: response.statusCode === 200, status: response.statusCode });
                            }).on('error', () => resolve({ success: false }));
                        });
                        
                        if (result.success) {
                            console.log('✅ Child URL works!');
                            return { success: true, childCount: idMatches.length, childIds: idMatches.slice(0, 20).map(m => m[1]) };
                        } else {
                            console.log('❌ Child URL failed:', result.status);
                        }
                    }
                }
            } else {
                console.log('❌ No children array with objects found');
                
                // Let's search for any occurrence of multiple IDs
                console.log('\nSearching for ID patterns...');
                const allIdMatches = [...html.matchAll(/"id":(\d+)/g)];
                console.log(`Found ${allIdMatches.length} total IDs in the page`);
                
                if (allIdMatches.length > 10) {
                    console.log('This page has many IDs - might be the compound object');
                    console.log('First 20 IDs:', allIdMatches.slice(0, 20).map(m => m[1]));
                    
                    // Test a few to see if they're valid
                    for (let i = 0; i < Math.min(5, allIdMatches.length); i++) {
                        const testId = allIdMatches[i][1];
                        const testUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${testId}/full/max/0/default.jpg`;
                        
                        const https = require('https');
                        const result = await new Promise((resolve) => {
                            https.get(testUrl, (response) => {
                                resolve({ success: response.statusCode === 200, status: response.statusCode });
                            }).on('error', () => resolve({ success: false }));
                        });
                        
                        console.log(`ID ${testId}: ${result.success ? '✅' : '❌'} (${result.status})`);
                        
                        if (result.success && i === 0) {
                            // First one works, let's return success
                            return { success: true, childCount: allIdMatches.length, method: 'all_ids' };
                        }
                    }
                }
            }
            
        } else {
            console.log('❌ Failed to fetch page:', pageResponse.status);
        }
        
        return { success: false };
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        return { success: false, error: error.message };
    }
}

// Run test
testFlorenceDirectChildren().then(result => {
    console.log('\n=== Final Result ===');
    console.log(result);
});