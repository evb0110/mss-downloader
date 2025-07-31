#!/usr/bin/env node

/**
 * Debug Florence IIIF manifest to understand the structure
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');
const https = require('https');

const FLORENCE_URL = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/';

async function debugFlorenceManifest() {
    console.log('=== Florence Manifest Debug ===\n');
    
    try {
        // Get the actual IIIF manifest URL
        const manifestUrl = 'https://cdm21059.contentdm.oclc.org/iiif/info/plutei/317515/manifest.json';
        console.log('Testing manifest URL:', manifestUrl);
        
        // Fetch the raw manifest
        const manifestLoaders = new SharedManifestLoaders();
        const response = await manifestLoaders.fetchWithRetry(manifestUrl);
        
        if (response.ok) {
            const manifestText = await response.text();
            console.log('Raw manifest response:');
            console.log('Length:', manifestText.length);
            console.log('First 500 chars:');
            console.log(manifestText.substring(0, 500));
            
            try {
                const manifest = JSON.parse(manifestText);
                console.log('\n=== Parsed Manifest Analysis ===');
                console.log('Type:', manifest['@type'] || manifest.type);
                console.log('Context:', manifest['@context']);
                console.log('ID:', manifest['@id'] || manifest.id);
                
                if (manifest.sequences) {
                    console.log('\nSequences found:', manifest.sequences.length);
                    if (manifest.sequences[0] && manifest.sequences[0].canvases) {
                        console.log('Canvases in first sequence:', manifest.sequences[0].canvases.length);
                        
                        // Analyze each canvas
                        manifest.sequences[0].canvases.forEach((canvas, i) => {
                            console.log(`\nCanvas ${i + 1}:`);
                            console.log('  ID:', canvas['@id']);
                            console.log('  Label:', canvas.label);
                            if (canvas.images && canvas.images[0]) {
                                console.log('  Image resource:', canvas.images[0].resource['@id']);
                                if (canvas.images[0].resource.service) {
                                    console.log('  Service ID:', canvas.images[0].resource.service['@id']);
                                }
                            }
                        });
                    }
                }
                
                if (manifest.items) {
                    console.log('\nItems found (IIIF v3):', manifest.items.length);
                }
                
                // Check if this is a collection manifest
                if (manifest.manifests) {
                    console.log('\nSub-manifests found:', manifest.manifests.length);
                    manifest.manifests.forEach((subManifest, i) => {
                        console.log(`  ${i + 1}. ${subManifest['@id']} - ${subManifest.label}`);
                    });
                }
                
            } catch (parseError) {
                console.log('Failed to parse as JSON:', parseError.message);
            }
        } else {
            console.log('Failed to fetch manifest:', response.status);
        }
        
        // Also test the page itself for compound object detection
        console.log('\n=== Page Analysis ===');
        const pageUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515';
        const pageResponse = await manifestLoaders.fetchWithRetry(pageUrl);
        
        if (pageResponse.ok) {
            const html = await pageResponse.text();
            console.log('Page HTML length:', html.length);
            
            // Look for compound object indicators
            const patterns = [
                /(?:page|item)\s*(\d+)\s*of\s*(\d+)/i,
                /compound[^>]*object/i,
                /totalPages['"]\s*:\s*(\d+)/i,
                /pageCount['"]\s*:\s*(\d+)/i,
                /pageptr['"]\s*:\s*['"]*(\d+)/gi
            ];
            
            console.log('\nSearching for compound object patterns:');
            patterns.forEach((pattern, i) => {
                const matches = html.match(pattern);
                if (matches) {
                    console.log(`  Pattern ${i + 1}: ${matches[0]}`);
                    if (matches[1]) console.log(`    Captured: ${matches[1]}`);
                    if (matches[2]) console.log(`    Total pages: ${matches[2]}`);
                }
            });
            
            // Look for navigation elements
            const navMatches = html.match(/<[^>]*(?:next|previous|page|nav)[^>]*>/gi);
            if (navMatches) {
                console.log('\nNavigation elements found:', navMatches.length);
                navMatches.slice(0, 5).forEach((match, i) => {
                    console.log(`  ${i + 1}. ${match}`);
                });
            }
            
        } else {
            console.log('Failed to fetch page:', pageResponse.status);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Run debug
debugFlorenceManifest();