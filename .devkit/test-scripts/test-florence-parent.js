#!/usr/bin/env node

/**
 * Test Florence parent page directly
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function testFlorenceParent() {
    console.log('=== Test Florence Parent Page ===\n');
    
    try {
        const manifestLoaders = new SharedManifestLoaders();
        
        // Test parent page directly
        const parentUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317539';
        console.log('Fetching parent page:', parentUrl);
        
        const parentResponse = await manifestLoaders.fetchWithRetry(parentUrl);
        
        if (parentResponse.ok) {
            const parentHtml = await parentResponse.text();
            console.log('Parent page HTML length:', parentHtml.length);
            
            // Test children patterns
            const childrenPatterns = [
                /"children":\s*\[([\s\S]*?)\]/,
                /"children":\s*\[([^\]]+)\]/,
                /"children":\[([^\]]+)\]/
            ];
            
            console.log('\nTesting children patterns:');
            for (let i = 0; i < childrenPatterns.length; i++) {
                const pattern = childrenPatterns[i];
                const match = parentHtml.match(pattern);
                if (match) {
                    console.log(`✅ Pattern ${i + 1} matched!`);
                    console.log('Children data length:', match[1].length);
                    
                    // Count IDs
                    const idMatches = [...match[1].matchAll(/"id":(\d+)/g)];
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
                            return { success: true, childCount: idMatches.length };
                        } else {
                            console.log('❌ Child URL failed:', result.status);
                        }
                    }
                    break;
                } else {
                    console.log(`❌ Pattern ${i + 1} no match`);
                }
            }
            
            // If no patterns worked, let's see what children structure actually looks like
            console.log('\nSearching for any "children" occurrence...');
            const childrenIndex = parentHtml.indexOf('"children"');
            if (childrenIndex >= 0) {
                console.log('Found "children" at index:', childrenIndex);
                const context = parentHtml.substring(childrenIndex, childrenIndex + 200);
                console.log('Context:', context);
            } else {
                console.log('No "children" found in parent HTML');
            }
            
        } else {
            console.log('❌ Failed to fetch parent page:', parentResponse.status);
        }
        
        return { success: false };
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        return { success: false, error: error.message };
    }
}

// Run test
testFlorenceParent().then(result => {
    console.log('\n=== Final Result ===');
    console.log(result);
});