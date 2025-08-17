#!/usr/bin/env bun

/**
 * FOCUSED TILE INVESTIGATION - Issue #6 Bordeaux
 * 
 * The previous test found that pages exist but tile structure probing failed.
 * This suggests the issue might be in tile URL construction or manuscript processing.
 * 
 * FOCUS: Find the exact tile URLs and dimension calculations that cause "Invalid array length"
 */

import { promises as fs } from 'fs';
import https from 'https';

console.log('🔍 FOCUSED TILE INVESTIGATION - Issue #6');
console.log('========================================');
console.log('GOAL: Find exact tile URLs and dimension calculations');
console.log('');

/**
 * Enhanced HTTP fetch with full response
 */
function fetchUrlFull(url: string): Promise<{ ok: boolean; status: number; data?: Buffer; headers?: any }> {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const req = https.request({
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (res) => {
            const chunks: Buffer[] = [];
            
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                resolve({
                    ok: res.statusCode === 200,
                    status: res.statusCode || 0,
                    data: Buffer.concat(chunks),
                    headers: res.headers
                });
            });
            res.on('error', (error) => {
                resolve({ ok: false, status: 0 });
            });
        });
        
        req.on('error', () => {
            resolve({ ok: false, status: 0 });
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve({ ok: false, status: 0 });
        });
        
        req.end();
    });
}

/**
 * Test different tile URL patterns to find the working format
 */
async function investigateTileUrls(): Promise<void> {
    console.log('🔍 INVESTIGATING TILE URL PATTERNS');
    console.log('----------------------------------');
    
    const baseId = '330636101_MS0778';
    const baseUrl = 'https://selene.bordeaux.fr/in/dz';
    
    // Test different tile patterns based on actual Bordeaux structure
    const patterns = [
        // Pattern 1: Direct baseId
        `${baseUrl}/${baseId}`,
        // Pattern 2: With page number
        `${baseUrl}/${baseId}_0010`,
        `${baseUrl}/${baseId}_0001`,
        // Pattern 3: Different variations
        `${baseUrl}/330636101_MS_0778_0010`, // Using original publicId format
        `${baseUrl}/330636101_MS_0778_0001`,
    ];
    
    for (const pattern of patterns) {
        console.log(`\nTesting pattern: ${pattern}`);
        
        // Test different levels and tiles
        const testUrls = [
            `${pattern}_files/0/0_0.jpg`,
            `${pattern}_files/1/0_0.jpg`,
            `${pattern}_files/10/0_0.jpg`,
            `${pattern}_files/13/0_0.jpg`,
            `${pattern}.dzi`,
        ];
        
        for (const testUrl of testUrls) {
            try {
                const result = await fetchUrlFull(testUrl);
                if (result.ok) {
                    console.log(`  ✅ FOUND: ${testUrl}`);
                    console.log(`    Status: ${result.status}`);
                    console.log(`    Size: ${result.data?.length || 0} bytes`);
                    
                    // If it's a DZI file, try to parse it
                    if (testUrl.endsWith('.dzi') && result.data) {
                        console.log(`    DZI Content: ${result.data.toString('utf8').substring(0, 200)}...`);
                    }
                } else {
                    console.log(`  ❌ ${testUrl} (${result.status})`);
                }
            } catch (error) {
                console.log(`  ❌ ${testUrl} (error)`);
            }
            
            // Small delay
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }
}

/**
 * Test specific working tile structure
 */
async function analyzeWorkingTileStructure(): Promise<void> {
    console.log('\n🎯 ANALYZING WORKING TILE STRUCTURE');
    console.log('-----------------------------------');
    
    // Based on working pages found in previous test, use page 10
    const baseId = '330636101_MS0778';
    const pageId = `${baseId}_0010`;
    const baseUrl = `https://selene.bordeaux.fr/in/dz/${pageId}`;
    
    console.log(`Analyzing: ${baseUrl}`);
    
    // Find maximum level
    console.log('\n1. Finding maximum zoom level...');
    let maxLevel = 0;
    for (let level = 20; level >= 0; level--) {
        const testUrl = `${baseUrl}_files/${level}/0_0.jpg`;
        try {
            const result = await fetchUrlFull(testUrl);
            if (result.ok) {
                maxLevel = level;
                console.log(`  ✅ Max level found: ${level}`);
                console.log(`    Tile size: ${result.data?.length || 0} bytes`);
                break;
            }
        } catch {
            // Continue
        }
    }
    
    if (maxLevel === 0) {
        console.log('  ❌ No valid tiles found');
        return;
    }
    
    // Analyze grid size at max level
    console.log('\n2. Analyzing grid size at max level...');
    
    // Test grid size
    let maxCol = 0, maxRow = 0;
    
    // Find max column
    console.log('  Finding max column...');
    for (let col = 0; col < 500; col++) {
        const testUrl = `${baseUrl}_files/${maxLevel}/${col}_0.jpg`;
        try {
            const result = await fetchUrlFull(testUrl);
            if (result.ok) {
                maxCol = col;
                if (col % 20 === 0) { // Log every 20th
                    console.log(`    Column ${col}: ✅`);
                }
            } else {
                break;
            }
        } catch {
            break;
        }
        
        // Small delay every 10 requests
        if (col % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }
    
    // Find max row
    console.log('  Finding max row...');
    for (let row = 0; row < 500; row++) {
        const testUrl = `${baseUrl}_files/${maxLevel}/0_${row}.jpg`;
        try {
            const result = await fetchUrlFull(testUrl);
            if (result.ok) {
                maxRow = row;
                if (row % 20 === 0) { // Log every 20th
                    console.log(`    Row ${row}: ✅`);
                }
            } else {
                break;
            }
        } catch {
            break;
        }
        
        // Small delay every 10 requests
        if (row % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }
    
    console.log(`  Grid size at level ${maxLevel}: ${maxCol + 1} x ${maxRow + 1} tiles`);
    
    // Calculate dimensions
    console.log('\n3. Calculating dimensions...');
    const tileSize = 256;
    const scale = Math.pow(2, maxLevel);
    const levelWidth = (maxCol + 1) * tileSize;
    const levelHeight = (maxRow + 1) * tileSize;
    
    // The key calculation from DirectTileProcessor.ts lines 147-150
    let estimatedWidth = Math.ceil(levelWidth * scale / Math.pow(2, maxLevel));
    let estimatedHeight = Math.ceil(levelHeight * scale / Math.pow(2, maxLevel));
    
    console.log(`  Level width: ${levelWidth}px`);
    console.log(`  Level height: ${levelHeight}px`);
    console.log(`  Scale factor: ${scale}`);
    console.log(`  Estimated dimensions: ${estimatedWidth}x${estimatedHeight}px`);
    
    // Memory analysis
    const pixelCount = estimatedWidth * estimatedHeight;
    const estimatedMemory = pixelCount * 4; // 4 bytes per RGBA pixel
    const memoryMB = estimatedMemory / (1024 * 1024);
    const memoryGB = memoryMB / 1024;
    
    console.log(`  Pixel count: ${pixelCount.toLocaleString()}`);
    console.log(`  Memory needed: ${memoryMB.toFixed(2)} MB (${memoryGB.toFixed(3)} GB)`);
    
    // Critical analysis
    const MAX_SAFE_MEMORY = 1024 * 1024 * 1024; // 1GB JavaScript limit
    const exceedsLimit = estimatedMemory > MAX_SAFE_MEMORY;
    
    console.log(`  Exceeds 1GB limit: ${exceedsLimit ? '🚨 YES - WILL CAUSE RangeError!' : '✅ NO'}`);
    
    if (exceedsLimit) {
        console.log('\n🚨 CRITICAL ISSUE FOUND:');
        console.log(`  The estimated dimensions ${estimatedWidth}x${estimatedHeight} would require ${memoryGB.toFixed(3)}GB`);
        console.log(`  This exceeds JavaScript's ~1GB array size limit`);
        console.log(`  This WILL cause "RangeError: Invalid array length" in Canvas.createCanvas()`);
        
        // Test the current fix
        console.log('\n🛠️  Testing current memory validation fix...');
        if (estimatedMemory > MAX_SAFE_MEMORY) {
            const scaleFactor = Math.sqrt(MAX_SAFE_MEMORY / estimatedMemory);
            const scaledWidth = Math.floor(estimatedWidth * scaleFactor);
            const scaledHeight = Math.floor(estimatedHeight * scaleFactor);
            console.log(`  Scale factor: ${scaleFactor.toFixed(4)}`);
            console.log(`  Scaled dimensions: ${scaledWidth}x${scaledHeight}`);
            console.log(`  ✅ Memory validation should prevent the error`);
        }
        
        // Test MAX_CANVAS_SIZE limit
        const MAX_CANVAS_SIZE = 16384;
        const limitedWidth = Math.min(estimatedWidth, MAX_CANVAS_SIZE);
        const limitedHeight = Math.min(estimatedHeight, MAX_CANVAS_SIZE);
        console.log(`  MAX_CANVAS_SIZE limit: ${limitedWidth}x${limitedHeight}`);
        console.log(`  ✅ Canvas size limit should also prevent the error`);
    }
    
    // Save analysis
    const analysis = {
        timestamp: new Date().toISOString(),
        pageId,
        maxLevel,
        gridSize: { cols: maxCol + 1, rows: maxRow + 1 },
        dimensions: {
            level: { width: levelWidth, height: levelHeight },
            estimated: { width: estimatedWidth, height: estimatedHeight }
        },
        memory: {
            pixelCount,
            estimatedMemory,
            memoryMB,
            memoryGB,
            exceedsLimit
        },
        tileStructure: {
            tileSize,
            scale,
            totalTiles: (maxCol + 1) * (maxRow + 1)
        }
    };
    
    await fs.writeFile(
        '/home/evb/WebstormProjects/mss-downloader/.devkit/ultra-priority/issue-6/tile-structure-analysis.json',
        JSON.stringify(analysis, null, 2)
    );
    
    console.log('\n📄 Detailed analysis saved to tile-structure-analysis.json');
}

/**
 * Test edge cases that might bypass validation
 */
async function testEdgeCases(): Promise<void> {
    console.log('\n🔬 TESTING EDGE CASES');
    console.log('--------------------');
    
    // Test dimension calculations that might produce invalid values
    const edgeCases = [
        { name: 'Zero scale', scale: 0, level: 10, cols: 100, rows: 100 },
        { name: 'Negative scale', scale: -1, level: 10, cols: 100, rows: 100 },
        { name: 'Infinity scale', scale: Infinity, level: 10, cols: 100, rows: 100 },
        { name: 'NaN scale', scale: NaN, level: 10, cols: 100, rows: 100 },
        { name: 'Very large scale', scale: 1000000, level: 20, cols: 1000, rows: 1000 },
        { name: 'Division by zero', scale: 1, level: 0, cols: 100, rows: 100 },
    ];
    
    for (const testCase of edgeCases) {
        console.log(`\nTesting: ${testCase.name}`);
        
        const tileSize = 256;
        const levelWidth = testCase.cols * tileSize;
        const levelHeight = testCase.rows * tileSize;
        
        // The potentially problematic calculation
        let estimatedWidth, estimatedHeight;
        
        try {
            estimatedWidth = Math.ceil(levelWidth * testCase.scale / Math.pow(2, testCase.level));
            estimatedHeight = Math.ceil(levelHeight * testCase.scale / Math.pow(2, testCase.level));
            
            console.log(`  Scale: ${testCase.scale}, Level: ${testCase.level}`);
            console.log(`  Level dimensions: ${levelWidth}x${levelHeight}`);
            console.log(`  Estimated dimensions: ${estimatedWidth}x${estimatedHeight}`);
            
            // Check for invalid values
            const isValidWidth = Number.isFinite(estimatedWidth) && estimatedWidth > 0 && Number.isInteger(estimatedWidth);
            const isValidHeight = Number.isFinite(estimatedHeight) && estimatedHeight > 0 && Number.isInteger(estimatedHeight);
            
            console.log(`  Valid width: ${isValidWidth ? '✅' : '❌'}`);
            console.log(`  Valid height: ${isValidHeight ? '✅' : '❌'}`);
            
            if (!isValidWidth || !isValidHeight) {
                console.log(`  🚨 INVALID DIMENSIONS FOUND!`);
                console.log(`    This could bypass validation and cause "Invalid array length"`);
                
                // Test current validation
                if (!Number.isFinite(estimatedWidth) || estimatedWidth <= 0) {
                    console.log(`    Current fix: width fallback to 1000`);
                }
                if (!Number.isFinite(estimatedHeight) || estimatedHeight <= 0) {
                    console.log(`    Current fix: height fallback to 1000`);
                }
            }
            
        } catch (error: any) {
            console.log(`  ❌ Calculation error: ${error.message}`);
        }
    }
}

/**
 * Main execution
 */
async function main() {
    try {
        await investigateTileUrls();
        await analyzeWorkingTileStructure();
        await testEdgeCases();
        
        console.log('\n🎯 INVESTIGATION COMPLETE');
        console.log('=========================');
        console.log('Check tile-structure-analysis.json for detailed findings');
        
    } catch (error) {
        console.error('❌ Investigation failed:', error);
        process.exit(1);
    }
}

main();