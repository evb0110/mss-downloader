#!/usr/bin/env node

/**
 * Debug Florence children extraction specifically
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

const FLORENCE_URL = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/';

async function debugFlorenceChildren() {
    console.log('=== Debug Florence Children ===\n');
    
    try {
        const manifestLoaders = new SharedManifestLoaders();
        
        // Get the page content
        const pageUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515';
        const pageResponse = await manifestLoaders.fetchWithRetry(pageUrl);
        
        if (pageResponse.ok) {
            const html = await pageResponse.text();
            
            console.log('Searching for parent object patterns...\n');
            
            // Look for different parent/children patterns
            const patterns = [
                /"parent":\s*{[^}]*"children":\s*\[([^\]]+)\]/,
                /"parent":\s*{[\s\S]*?"children":\s*\[([^\]]+)\]/,
                /"children":\s*\[([^\]]+)\]/,
                /"children":\s*\[([\s\S]*?)\]/
            ];
            
            patterns.forEach((pattern, i) => {
                const match = html.match(pattern);
                if (match) {
                    console.log(`Pattern ${i + 1} MATCHED:`);
                    console.log('Full match length:', match[0].length);
                    console.log('First 200 chars:', match[0].substring(0, 200));
                    console.log('Children data length:', match[1]?.length || 0);
                    if (match[1]) {
                        console.log('First 200 chars of children:', match[1].substring(0, 200));
                        
                        // Count IDs in children data
                        const idMatches = [...match[1].matchAll(/"id":(\d+)/g)];
                        console.log(`Found ${idMatches.length} child IDs`);
                        if (idMatches.length > 0) {
                            console.log('First 5 IDs:', idMatches.slice(0, 5).map(m => m[1]));
                        }
                    }
                    console.log('');
                }
            });
            
            // Look for parent ID
            const parentIdMatch = html.match(/"parentId":(\d+)/);
            if (parentIdMatch) {
                console.log('Found parentId:', parentIdMatch[1]);
                
                // Try to get parent object
                try {
                    const parentUrl = `https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/${parentIdMatch[1]}`;
                    console.log('\nTrying parent URL:', parentUrl);
                    
                    const parentResponse = await manifestLoaders.fetchWithRetry(parentUrl);
                    if (parentResponse.ok) {
                        const parentHtml = await parentResponse.text();
                        
                        // Look for children in parent page
                        const parentChildrenMatch = parentHtml.match(/"children":\s*\[([\s\S]*?)\]/);
                        if (parentChildrenMatch) {
                            console.log('Found children in parent page');
                            const childIdMatches = [...parentChildrenMatch[1].matchAll(/"id":(\d+)/g)];
                            console.log(`Parent has ${childIdMatches.length} children`);
                            if (childIdMatches.length > 0) {
                                console.log('First 10 child IDs:', childIdMatches.slice(0, 10).map(m => m[1]));
                            }
                        } else {
                            console.log('No children found in parent page');
                        }
                    }
                } catch (error) {
                    console.log('Failed to fetch parent page:', error.message);
                }
            }
            
            // Look for direct item structure
            const itemMatch = html.match(/"item":\s*{[\s\S]*?"parent":\s*{[\s\S]*?"children":\s*\[([\s\S]*?)\]/);
            if (itemMatch) {
                console.log('\nFound item.parent.children structure');
                const childIdMatches = [...itemMatch[1].matchAll(/"id":(\d+)/g)];
                console.log(`Found ${childIdMatches.length} children in item structure`);
            }
            
        } else {
            console.log('Failed to fetch page:', pageResponse.status);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Run debug
debugFlorenceChildren();