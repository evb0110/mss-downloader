#!/usr/bin/env node

/**
 * Test Bodleian library structure
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

const BODLEIAN_URL = 'https://digital.bodleian.ox.ac.uk/objects/ce827512-d440-4833-bdba-f4f4f079d2cd/';

async function testBodleianStructure() {
    console.log('=== Bodleian Structure Test ===\n');
    
    try {
        const manifestLoaders = new SharedManifestLoaders();
        
        console.log('Testing Bodleian URL:', BODLEIAN_URL);
        
        // Fetch the page
        const response = await manifestLoaders.fetchWithRetry(BODLEIAN_URL);
        
        if (response.ok) {
            const html = await response.text();
            console.log('Page HTML length:', html.length);
            
            // Look for IIIF manifest URLs
            console.log('\nSearching for IIIF patterns...');
            
            const iiifPatterns = [
                /manifest\.json/gi,
                /iiif[^"'\s]*/gi,
                /presentation[^"'\s]*/gi,
                /"@context"[^}]*iiif/gi
            ];
            
            iiifPatterns.forEach((pattern, i) => {
                const matches = [...html.matchAll(pattern)];
                if (matches.length > 0) {
                    console.log(`Pattern ${i + 1}: Found ${matches.length} matches`);
                    matches.slice(0, 3).forEach((match, j) => {
                        console.log(`  ${j + 1}. ${match[0]}`);
                    });
                }
            });
            
            // Look for potential manifest URLs
            console.log('\nLooking for manifest URLs...');
            const urlPatterns = [
                /https?:\/\/[^"'\s]*manifest[^"'\s]*/gi,
                /https?:\/\/[^"'\s]*iiif[^"'\s]*/gi,
                /\/iiif\/[^"'\s]*/gi
            ];
            
            urlPatterns.forEach((pattern, i) => {
                const matches = [...html.matchAll(pattern)];
                if (matches.length > 0) {
                    console.log(`URL Pattern ${i + 1}: Found ${matches.length} matches`);
                    matches.slice(0, 5).forEach((match, j) => {
                        console.log(`  ${j + 1}. ${match[0]}`);
                    });
                }
            });
            
            // Try to construct likely IIIF manifest URLs
            console.log('\nTesting potential IIIF manifest URLs...');
            
            // Extract the object ID from URL
            const objectIdMatch = BODLEIAN_URL.match(/objects\/([^\/]+)/);
            if (objectIdMatch) {
                const objectId = objectIdMatch[1];
                console.log('Object ID:', objectId);
                
                const potentialManifests = [
                    `https://iiif.bodleian.ox.ac.uk/iiif/manifest/${objectId}.json`,
                    `https://digital.bodleian.ox.ac.uk/iiif/manifest/${objectId}.json`,
                    `https://iiif.bodleian.ox.ac.uk/iiif/manifest/${objectId}`,
                    `https://digital.bodleian.ox.ac.uk/objects/${objectId}/manifest.json`,
                    `https://digital.bodleian.ox.ac.uk/objects/${objectId}/manifest`,
                    `https://iiif.bodleian.ox.ac.uk/iiif/presentation/v2/${objectId}/manifest`,
                    `https://iiif.bodleian.ox.ac.uk/iiif/presentation/v3/${objectId}/manifest`
                ];
                
                for (const manifestUrl of potentialManifests) {
                    console.log(`\nTesting: ${manifestUrl}`);
                    
                    try {
                        const manifestResponse = await manifestLoaders.fetchWithRetry(manifestUrl, {}, 1);
                        console.log(`Status: ${manifestResponse.status}`);
                        
                        if (manifestResponse.ok) {
                            const manifestText = await manifestResponse.text();
                            console.log(`✅ SUCCESS! Manifest found (${manifestText.length} bytes)`);
                            
                            try {
                                const manifest = JSON.parse(manifestText);
                                console.log('Manifest type:', manifest['@type'] || manifest.type);
                                console.log('Context:', manifest['@context']);
                                
                                if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
                                    console.log(`Found ${manifest.sequences[0].canvases.length} canvases`);
                                    return { success: true, manifestUrl, canvases: manifest.sequences[0].canvases.length };
                                } else if (manifest.items) {
                                    console.log(`Found ${manifest.items.length} items (IIIF v3)`);
                                    return { success: true, manifestUrl, items: manifest.items.length };
                                }
                                
                            } catch (parseError) {
                                console.log('Failed to parse as JSON');
                            }
                        }
                    } catch (error) {
                        console.log(`Error: ${error.message}`);
                    }
                }
            }
            
        } else {
            console.log('Failed to fetch page:', response.status);
        }
        
        return { success: false };
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        return { success: false, error: error.message };
    }
}

// Run test
testBodleianStructure().then(result => {
    console.log('\n=== Final Result ===');
    console.log(result);
});