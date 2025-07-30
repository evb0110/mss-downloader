/**
 * Test script for Morgan, Bordeaux, and Florence libraries
 * Run with: node .devkit/test-three-libraries.js
 */

const { SharedManifestLoaders } = require('../src/shared/SharedManifestLoaders.js');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function testLibrary(loader, libraryName, url) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing ${libraryName} Library`);
    console.log(`URL: ${url}`);
    console.log(`${'='.repeat(60)}\n`);
    
    try {
        let manifest;
        
        // Call the appropriate method based on library
        switch(libraryName.toLowerCase()) {
            case 'morgan':
                manifest = await loader.getMorganManifest(url);
                break;
            case 'bordeaux':
                manifest = await loader.getBordeauxManifest(url);
                break;
            case 'florence':
                manifest = await loader.getFlorenceManifest(url);
                break;
            default:
                throw new Error(`Unknown library: ${libraryName}`);
        }
        
        console.log(`✅ Successfully fetched manifest`);
        
        if (manifest.requiresTileProcessor) {
            console.log(`📦 Library type: Deep Zoom Tiles (requires tile processor)`);
            console.log(`📄 Base ID: ${manifest.baseId}`);
            console.log(`📄 Public ID: ${manifest.publicId}`);
            console.log(`📄 Start page: ${manifest.startPage}`);
            console.log(`📄 Page count: ${manifest.pageCount}`);
            console.log(`📄 Tile base URL: ${manifest.tileBaseUrl}`);
        } else if (manifest.images) {
            console.log(`📄 Total images found: ${manifest.images.length}`);
            console.log(`📄 Display name: ${manifest.displayName || 'N/A'}`);
            
            // Show first 3 image URLs
            console.log(`\n📸 First ${Math.min(3, manifest.images.length)} image URLs:`);
            for (let i = 0; i < Math.min(3, manifest.images.length); i++) {
                console.log(`   ${i + 1}. ${manifest.images[i].url}`);
            }
            
            // Test downloading first image
            if (manifest.images.length > 0) {
                console.log(`\n🔍 Testing first image download...`);
                const firstImageUrl = manifest.images[0].url;
                try {
                    const response = await loader.fetchWithRetry(firstImageUrl);
                    if (response.ok) {
                        const buffer = await response.buffer();
                        console.log(`   ✅ Image downloaded successfully (${Math.round(buffer.length / 1024)} KB)`);
                    } else {
                        console.log(`   ❌ Failed to download image: ${response.status} ${response.statusText}`);
                    }
                } catch (error) {
                    console.log(`   ❌ Download error: ${error.message}`);
                }
            }
        }
        
        return { success: true, manifest };
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        console.log(`\n📋 Stack trace:`);
        console.log(error.stack);
        return { success: false, error: error.message };
    }
}

async function main() {
    const loader = new SharedManifestLoaders();
    
    // Test URLs from the user's request
    const tests = [
        {
            name: 'Morgan',
            url: 'https://www.themorgan.org/manuscript/76854'
        },
        {
            name: 'Bordeaux',
            url: 'https://1886.bordeaux.fr/items/viewer?REPRODUCTION_ID=11556'
        },
        {
            name: 'Florence',
            url: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/174871'
        }
    ];
    
    console.log('🚀 Starting library tests...\n');
    
    const results = [];
    for (const test of tests) {
        const result = await testLibrary(loader, test.name, test.url);
        results.push({ ...test, ...result });
    }
    
    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 Test Summary');
    console.log(`${'='.repeat(60)}\n`);
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    
    console.log('\nDetailed Results:');
    results.forEach(result => {
        console.log(`\n${result.name}: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
        if (!result.success) {
            console.log(`   Error: ${result.error}`);
        } else if (result.manifest) {
            if (result.manifest.images) {
                console.log(`   Images: ${result.manifest.images.length}`);
            } else if (result.manifest.requiresTileProcessor) {
                console.log(`   Type: Deep Zoom Tiles`);
            }
        }
    });
}

main().catch(console.error);