#!/usr/bin/env node

/**
 * Extract Florence children from the debug output we saw earlier
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

const FLORENCE_URL = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/';

async function extractFlorenceChildren() {
    console.log('=== Extract Florence Children ===\n');
    
    try {
        const manifestLoaders = new SharedManifestLoaders();
        
        // Get the page content  
        const pageUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515';
        const pageResponse = await manifestLoaders.fetchWithRetry(pageUrl);
        
        if (pageResponse.ok) {
            const html = await pageResponse.text();
            
            // From our earlier debug, we know the parent object exists
            // Let's look for it in the JSON data structure
            
            // Look for the item data structure 
            const itemMatch = html.match(/"item":\s*{[\s\S]*?}/);
            if (itemMatch) {
                console.log('Found item object');
                console.log('Item object length:', itemMatch[0].length);
                
                // Look specifically for parentId in the item
                const parentIdMatch = itemMatch[0].match(/"parentId":(\d+)/);
                if (parentIdMatch) {
                    const parentId = parentIdMatch[1];
                    console.log('Parent ID:', parentId);
                    
                    // Now look for children in the same HTML where parent.children exists
                    // Let's search for a specific pattern based on the debug output we saw
                    const childrenPattern = new RegExp(`"children":\\s*\\[([^\\]]+)\\]`);
                    const childrenMatch = html.match(childrenPattern);
                    
                    if (childrenMatch) {
                        console.log('Found children array');
                        const childrenData = childrenMatch[1];
                        console.log('Children data length:', childrenData.length);
                        
                        // Extract child IDs 
                        const childIdMatches = [...childrenData.matchAll(/"id":(\d+)/g)];
                        console.log(`Found ${childIdMatches.length} child IDs`);
                        
                        if (childIdMatches.length > 0) {
                            console.log('First 10 child IDs:');
                            childIdMatches.slice(0, 10).forEach((match, i) => {
                                console.log(`  ${i + 1}. ${match[1]}`);
                            });
                            
                            // Create IIIF URLs and test one
                            const firstChildId = childIdMatches[0][1];
                            const testUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${firstChildId}/full/max/0/default.jpg`;
                            console.log('\nTesting first child image:', testUrl);
                            
                            const https = require('https');
                            const testResult = await new Promise((resolve) => {
                                https.get(testUrl, (response) => {
                                    resolve({ 
                                        success: response.statusCode === 200,
                                        status: response.statusCode
                                    });
                                }).on('error', () => resolve({ success: false }));
                            });
                            
                            if (testResult.success) {
                                console.log('✅ Child image is accessible');
                                return {
                                    success: true,
                                    childCount: childIdMatches.length,
                                    message: `Found ${childIdMatches.length} child pages`
                                };
                            } else {
                                console.log(`❌ Child image not accessible: ${testResult.status}`);
                            }
                        }
                    } else {
                        console.log('No children array found');
                    }
                } else {
                    console.log('No parentId found in item');
                }
            } else {
                console.log('No item object found');
            }
            
            return { success: false, message: 'Could not extract children' };
            
        } else {
            console.log('Failed to fetch page:', pageResponse.status);
            return { success: false, message: 'Failed to fetch page' };
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        return { success: false, error: error.message };
    }
}

// Run extraction
extractFlorenceChildren().then(result => {
    console.log('\n=== Result ===');
    console.log(result);
});