#!/usr/bin/env node

/**
 * Debug script to test Morgan, Bordeaux, and Florence library implementations
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders');

async function testMorgan() {
    console.log('\n=== Testing Morgan Library ===');
    const loader = new SharedManifestLoaders();
    
    const testUrl = 'https://www.themorgan.org/manuscript/76854';
    console.log(`Testing URL: ${testUrl}`);
    
    try {
        const manifest = await loader.getMorganManifest(testUrl);
        console.log(`✅ Morgan manifest loaded successfully`);
        console.log(`   Display name: ${manifest.displayName}`);
        console.log(`   Image count: ${manifest.images?.length || 0}`);
        
        if (manifest.images && manifest.images.length > 0) {
            console.log(`   First image URL: ${manifest.images[0].url}`);
            console.log(`   Image label: ${manifest.images[0].label}`);
        } else {
            console.log(`❌ No images found in manifest`);
        }
    } catch (error) {
        console.error(`❌ Morgan test failed: ${error.message}`);
        console.error(error.stack);
    }
}

async function testBordeaux() {
    console.log('\n=== Testing Bordeaux Library ===');
    const loader = new SharedManifestLoaders();
    
    const testUrl = 'https://bibliotheque.bordeaux.fr/in/faces/details.xhtml?id=h::REPRO1_000011556&REPRODUCTION_ID=11556';
    console.log(`Testing URL: ${testUrl}`);
    
    try {
        const manifest = await loader.getBordeauxManifest(testUrl);
        console.log(`✅ Bordeaux manifest loaded successfully`);
        console.log(`   Type: ${manifest.type}`);
        console.log(`   Base ID: ${manifest.baseId}`);
        console.log(`   Public ID: ${manifest.publicId}`);
        console.log(`   Start page: ${manifest.startPage}`);
        console.log(`   Requires tile processor: ${manifest.requiresTileProcessor}`);
        
        if (manifest.images && manifest.images.length > 0) {
            console.log(`   Image count: ${manifest.images.length}`);
            console.log(`   First image URL: ${manifest.images[0].url}`);
        } else if (manifest.requiresTileProcessor) {
            console.log(`   ℹ️ This manifest requires tile processor for image extraction`);
        }
    } catch (error) {
        console.error(`❌ Bordeaux test failed: ${error.message}`);
        console.error(error.stack);
    }
}

async function testFlorence() {
    console.log('\n=== Testing Florence Library ===');
    const loader = new SharedManifestLoaders();
    
    const testUrls = [
        'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/',
        'https://cdm21059.contentdm.oclc.org/s/itBMLO0000000000/item/174871'
    ];
    
    for (const testUrl of testUrls) {
        console.log(`\nTesting URL: ${testUrl}`);
        
        try {
            const manifest = await loader.getFlorenceManifest(testUrl);
            console.log(`✅ Florence manifest loaded successfully`);
            console.log(`   Image count: ${manifest.images?.length || 0}`);
            
            if (manifest.images && manifest.images.length > 0) {
                console.log(`   First image URL: ${manifest.images[0].url}`);
                console.log(`   Image label: ${manifest.images[0].label}`);
                
                // Check if we're getting multiple pages
                if (manifest.images.length > 1) {
                    console.log(`   ✅ Multiple pages detected (${manifest.images.length} total)`);
                } else {
                    console.log(`   ⚠️ Only single page found - may need compound object handling`);
                }
            } else {
                console.log(`❌ No images found in manifest`);
            }
        } catch (error) {
            console.error(`❌ Florence test failed: ${error.message}`);
            console.error(error.stack);
        }
    }
}

async function testMorganHTMLParsing() {
    console.log('\n=== Testing Morgan HTML Parsing ===');
    const loader = new SharedManifestLoaders();
    
    // Simulate fetching the page
    const testUrl = 'https://www.themorgan.org/manuscript/76854';
    console.log(`Fetching HTML from: ${testUrl}`);
    
    try {
        const response = await loader.fetchWithRetry(testUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch page: ${response.status}`);
        }
        
        const html = await response.text();
        console.log(`✅ HTML fetched successfully (${html.length} bytes)`);
        
        // Check for various image patterns
        const patterns = [
            { name: 'ZIF pattern', regex: /\/images\/collection\/([^"'?]+)\.jpg/g },
            { name: 'Facsimile pattern', regex: /\/sites\/default\/files\/facsimile\/[^"']+\.jpg/g },
            { name: 'Full-size pattern', regex: /\/sites\/default\/files\/images\/collection\/[^"'?]+\.jpg/g },
            { name: 'Styled pattern', regex: /\/sites\/default\/files\/styles\/[^"']*\/public\/images\/collection\/[^"'?]+\.jpg/g },
            { name: 'Thumbnail links', regex: /\/collection\/76854\/(\d+)/g }
        ];
        
        for (const pattern of patterns) {
            const matches = [...html.matchAll(pattern.regex)];
            console.log(`   ${pattern.name}: ${matches.length} matches found`);
            if (matches.length > 0 && matches.length <= 3) {
                matches.forEach((match, i) => {
                    console.log(`     Match ${i + 1}: ${match[0]}`);
                });
            }
        }
        
        // Check for title
        const titleMatch = html.match(/<title[^>]*>([^<]+)</);
        if (titleMatch) {
            console.log(`   Page title: ${titleMatch[1]}`);
        }
        
    } catch (error) {
        console.error(`❌ Morgan HTML parsing test failed: ${error.message}`);
    }
}

async function main() {
    console.log('Starting library debug tests...');
    
    await testMorgan();
    await testMorganHTMLParsing();
    await testBordeaux();
    await testFlorence();
    
    console.log('\n✅ Debug tests completed');
}

main().catch(console.error);