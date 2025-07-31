#!/usr/bin/env node

/**
 * Verify the parent ID extraction
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

async function verifyParentId() {
    console.log('=== Verify Parent ID ===\n');
    
    try {
        const manifestLoaders = new SharedManifestLoaders();
        
        const pageUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515';
        const pageResponse = await manifestLoaders.fetchWithRetry(pageUrl);
        
        if (pageResponse.ok) {
            const html = await pageResponse.text();
            
            console.log('Page HTML length:', html.length);
            
            // Look for parentId with different patterns
            const patterns = [
                /"parentId":(\d+)/,
                /"parentId":\s*(\d+)/,
                /parentId['"]\s*:\s*(\d+)/,
                /parentId.*?(\d+)/
            ];
            
            console.log('Testing parentId patterns:');
            patterns.forEach((pattern, i) => {
                const match = html.match(pattern);
                if (match) {
                    console.log(`  Pattern ${i + 1}: Found parentId ${match[1]}`);
                } else {
                    console.log(`  Pattern ${i + 1}: No match`);
                }
            });
            
            // Let's also search for the literal string "317539" that we saw in debug
            if (html.includes('317539')) {
                console.log('\n✅ HTML contains "317539"');
                
                // Find context around it
                const index = html.indexOf('317539');
                const context = html.substring(index - 50, index + 100);
                console.log('Context around 317539:');
                console.log(context);
                
                // Try to get the parent page directly
                console.log('\nTesting direct parent page access...');
                const parentUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317539';
                const parentResponse = await manifestLoaders.fetchWithRetry(parentUrl);
                
                if (parentResponse.ok) {
                    const parentHtml = await parentResponse.text();
                    console.log('✅ Parent page accessible, length:', parentHtml.length);
                    
                    // Look for children in parent
                    if (parentHtml.includes('children')) {
                        console.log('✅ Parent page contains "children"');
                        
                        const childrenMatch = parentHtml.match(/"children":\s*\[/);
                        if (childrenMatch) {
                            console.log('✅ Found children array start');
                            
                            // Count total children
                            const idMatches = [...parentHtml.matchAll(/"id":(\d+)/g)];
                            console.log(`Found ${idMatches.length} total IDs in parent page`);
                            
                            if (idMatches.length > 10) {
                                console.log('This looks like the compound object we need!');
                                return { success: true, parentId: '317539', childCount: idMatches.length };
                            }
                        }
                    }
                } else {
                    console.log('❌ Parent page not accessible:', parentResponse.status);
                }
            } else {
                console.log('❌ HTML does not contain "317539"');
            }
            
        } else {
            console.log('Failed to fetch page:', pageResponse.status);
        }
        
        return { success: false };
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        return { success: false, error: error.message };
    }
}

// Run verification
verifyParentId().then(result => {
    console.log('\n=== Result ===');
    console.log(result);
});