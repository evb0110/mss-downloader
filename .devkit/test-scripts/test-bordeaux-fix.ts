#!/usr/bin/env bun
// Test the Bordeaux fix with both Jimp constructor and high-res tile processing

import { SharedManifestLoaders } from '../../src/shared/SharedManifestLoaders';
import { DirectTileProcessor } from '../../src/main/services/DirectTileProcessor';
import * as fs from 'fs';

async function testBordeauxFix() {
    console.log('Testing Bordeaux fix...');
    
    const loader = new SharedManifestLoaders();
    const processor = new DirectTileProcessor();
    
    try {
        // Test manifest loading
        console.log('1. Testing manifest loading...');
        const result = await loader.getBordeauxManifest('https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778');
        
        console.log('Result type:', Array.isArray(result) ? 'array' : 'object');
        console.log('Page count:', Array.isArray(result) ? result.length : result.images?.length);
        
        if (!Array.isArray(result)) {
            console.log('Requires tile processor:', result.requiresTileProcessor);
            console.log('First image URL:', result.images?.[0]?.url);
            console.log('First image requiresTileProcessor:', result.images?.[0]?.requiresTileProcessor);
            
            // Test DirectTileProcessor with the first page
            if (result.images?.[0]?.requiresTileProcessor) {
                console.log('\n2. Testing DirectTileProcessor...');
                try {
                    const baseUrl = result.images[0].url;
                    console.log('Testing tile structure probe for:', baseUrl);
                    
                    // Test probe 
                    const tileInfo = await processor.probeTileStructure(baseUrl);
                    console.log('Tile structure:', {
                        maxLevel: tileInfo.maxLevel,
                        gridSize: tileInfo.gridSize,
                        estimatedDimensions: tileInfo.estimatedDimensions
                    });
                    
                    // Test full image processing for first page only
                    console.log('\n3. Testing full image processing...');
                    const outputPath = '/Users/evb/WebstormProjects/mss-downloader/.devkit/validation/READY-FOR-USER/bordeaux-fix-test.jpg';
                    
                    const processResult = await processor.processPage(
                        result.tileConfig?.baseId || '330636101_MS0778',
                        6, // Page 6 (0006)
                        outputPath,
                        (downloaded, total) => {
                            console.log(`Progress: ${downloaded}/${total} tiles (${Math.round(downloaded/total*100)}%)`);
                        },
                        result.tileBaseUrl
                    );
                    
                    if (processResult.success) {
                        // Check file size
                        const stats = fs.statSync(outputPath);
                        console.log(`Success! Image saved: ${(stats.size / 1024).toFixed(1)}KB`);
                        
                        if (stats.size > 50000) { // > 50KB indicates high resolution
                            console.log('✅ HIGH RESOLUTION: File size indicates high-quality image');
                        } else {
                            console.log('⚠️  LOW RESOLUTION: File size suggests thumbnail quality');
                        }
                    } else {
                        console.log('❌ Processing failed:', processResult.error);
                    }
                    
                } catch (tileError) {
                    console.log('❌ DirectTileProcessor error:', tileError);
                }
            } else {
                console.log('⚠️  Image does not require tile processor - may be using direct URLs');
            }
        }
        
    } catch (error) {
        console.log('❌ Test failed:', error);
    }
}

testBordeauxFix();