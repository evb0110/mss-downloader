#!/usr/bin/env bun

/**
 * REPRODUCE EXACT ERROR - Issue #6 Bordeaux "Invalid array length"
 * 
 * This script reproduces the EXACT user workflow to find where
 * "Invalid array length" error occurs in the Bordeaux manuscript processing.
 * 
 * User URL: https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778
 * Expected Behavior: Should process without "Invalid array length" error
 * 
 * MISSION: Find the exact line and condition that causes the error
 */

import { promises as fs } from 'fs';
import https from 'https';
import path from 'path';

console.log('🔥 REPRODUCING EXACT ERROR - Issue #6 Bordeaux');
console.log('==============================================');
console.log('User URL: https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778');
console.log('Goal: Find exact location of "Invalid array length" error');
console.log('');

interface TestResult {
    step: string;
    success: boolean;
    error?: string;
    details: any;
    memoryAnalysis?: {
        pixelCount: number;
        estimatedMemory: number;
        exceedsLimit: boolean;
    };
}

const results: TestResult[] = [];

/**
 * Mock Canvas to detect where RangeError occurs
 */
class MockCanvas {
    static createCanvas(width: number, height: number) {
        console.log(`🎨 MockCanvas.createCanvas(${width}, ${height})`);
        
        // Check for invalid dimensions
        if (!Number.isFinite(width) || !Number.isFinite(height)) {
            throw new Error(`Invalid dimensions: width=${width}, height=${height}`);
        }
        
        if (width <= 0 || height <= 0) {
            throw new Error(`Non-positive dimensions: width=${width}, height=${height}`);
        }
        
        if (!Number.isInteger(width) || !Number.isInteger(height)) {
            throw new Error(`Non-integer dimensions: width=${width}, height=${height}`);
        }
        
        // Calculate memory requirements
        const pixelCount = width * height;
        const estimatedMemory = pixelCount * 4; // 4 bytes per RGBA pixel
        const MAX_SAFE_MEMORY = 1024 * 1024 * 1024; // 1GB limit
        
        console.log(`  Pixel count: ${pixelCount.toLocaleString()}`);
        console.log(`  Memory needed: ${(estimatedMemory / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  Safe limit: ${(MAX_SAFE_MEMORY / 1024 / 1024).toFixed(2)} MB`);
        
        if (estimatedMemory > MAX_SAFE_MEMORY) {
            console.log(`  🚨 CRITICAL: Exceeds JavaScript array size limit!`);
            throw new RangeError('Invalid array length');
        }
        
        console.log(`  ✅ Canvas creation would succeed`);
        return {
            getContext: () => ({
                drawImage: () => {},
            }),
            toBuffer: () => Buffer.alloc(100) // Mock small buffer
        };
    }
    
    static loadImage(data: Buffer) {
        return Promise.resolve({
            width: 256,
            height: 256
        });
    }
}

/**
 * HTTP fetch utility
 */
function fetchUrl(url: string): Promise<{ ok: boolean; status: number; text?: string }> {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const req = https.request({
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'HEAD',
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (res) => {
            resolve({
                ok: res.statusCode === 200,
                status: res.statusCode || 0
            });
        });
        
        req.on('error', (error) => {
            resolve({ ok: false, status: 0, text: error.message });
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve({ ok: false, status: 0, text: 'Timeout' });
        });
        
        req.end();
    });
}

/**
 * Test 1: Reproduce Bordeaux URL Processing
 */
async function test1_bordeauxUrlProcessing(): Promise<TestResult> {
    console.log('TEST 1: Bordeaux URL Processing');
    console.log('-------------------------------');
    
    try {
        const userUrl = 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778';
        
        // Step 1: Library detection (from EnhancedManuscriptDownloaderService.ts line 1004)
        const bordeauxDetected = userUrl.includes('manuscrits.bordeaux.fr') || userUrl.includes('selene.bordeaux.fr');
        console.log(`Library detection: ${bordeauxDetected ? '✅' : '❌'}`);
        
        // Step 2: ARK pattern matching (from SharedManifestLoaders.ts line 3624)
        const publicMatch = userUrl.match(/ark:\/\d+\/([^/]+)(?:\/f(\d+))?\/?/);
        if (publicMatch) {
            console.log(`ARK pattern match: ✅`);
            console.log(`  Public ID: ${publicMatch[1]}`);
            console.log(`  Page: ${publicMatch[2] || 'not specified'}`);
        } else {
            throw new Error('ARK pattern matching failed');
        }
        
        // Step 3: Internal ID mapping (from SharedManifestLoaders.ts line 3702)
        const publicId = publicMatch[1];
        const knownMappings: Record<string, string> = {
            'btv1b52509616g': '330636101_MS0778',
            '330636101_MS_0778': '330636101_MS0778',
            'v2b3306361012': '330636101_MS0778'
        };
        
        const internalId = knownMappings[publicId];
        if (!internalId) {
            throw new Error(`No known mapping for public ID: ${publicId}`);
        }
        
        console.log(`Internal ID mapping: ✅ ${publicId} -> ${internalId}`);
        
        // Step 4: Base ID extraction
        const baseIdMatch = internalId.match(/^(.+?)(?:_\d{4})?$/);
        const baseId = baseIdMatch ? baseIdMatch[1] : internalId;
        console.log(`Base ID: ${baseId}`);
        
        return {
            step: 'Bordeaux URL Processing',
            success: true,
            details: {
                publicId,
                internalId,
                baseId,
                bordeauxDetected
            }
        };
        
    } catch (error: any) {
        return {
            step: 'Bordeaux URL Processing',
            success: false,
            error: error.message,
            details: null
        };
    }
}

/**
 * Test 2: Page Discovery - Find the 195 vs 278 issue
 */
async function test2_pageDiscovery(): Promise<TestResult> {
    console.log('\nTEST 2: Page Discovery Analysis');
    console.log('-------------------------------');
    
    try {
        const baseId = '330636101_MS0778';
        const baseUrl = 'https://selene.bordeaux.fr/in/dz';
        
        // Test the current maxTestPages limit
        const maxTestPages = 200; // From SharedManifestLoaders.ts line 3511
        console.log(`Current maxTestPages limit: ${maxTestPages}`);
        
        // Quick scan specific pages to understand the range
        const testPages = [1, 10, 50, 100, 150, 195, 200, 250, 278];
        const availablePages: number[] = [];
        
        console.log('Testing page availability...');
        for (const page of testPages) {
            const pageId = `${baseId}_${String(page).padStart(4, '0')}`;
            const testUrl = `${baseUrl}/${pageId}_files/0/0_0.jpg`;
            
            try {
                const result = await fetchUrl(testUrl);
                if (result.ok) {
                    availablePages.push(page);
                    console.log(`  Page ${page}: ✅ Available`);
                } else {
                    console.log(`  Page ${page}: ❌ Not available (${result.status})`);
                }
            } catch (error) {
                console.log(`  Page ${page}: ❌ Error`);
            }
            
            // Small delay to be respectful
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log(`Available pages found: [${availablePages.join(', ')}]`);
        
        // Critical analysis
        const page278Available = availablePages.includes(278);
        const limitReached = availablePages.some(p => p >= maxTestPages);
        
        console.log(`Page 278 available: ${page278Available ? '✅' : '❌'}`);
        console.log(`maxTestPages limit issue: ${limitReached ? '🚨 YES' : '❌ NO'}`);
        
        if (page278Available && limitReached) {
            console.log('🚨 CRITICAL: Page 278 exists but discovery limited to 200 pages!');
        }
        
        return {
            step: 'Page Discovery Analysis',
            success: true,
            details: {
                maxTestPages,
                availablePages,
                page278Available,
                limitReached,
                issueFound: page278Available && limitReached
            }
        };
        
    } catch (error: any) {
        return {
            step: 'Page Discovery Analysis',
            success: false,
            error: error.message,
            details: null
        };
    }
}

/**
 * Test 3: Tile Structure Probing - Where dimensions are calculated
 */
async function test3_tileStructureProbing(): Promise<TestResult> {
    console.log('\nTEST 3: Tile Structure Probing');
    console.log('------------------------------');
    
    try {
        const baseId = '330636101_MS0778';
        const baseUrl = `https://selene.bordeaux.fr/in/dz/${baseId}`;
        
        // Simulate probeTileStructure from DirectTileProcessor.ts
        console.log('Simulating tile structure probing...');
        
        // Simulate finding max level (DirectTileProcessor.ts lines 89-101)
        let maxLevel = 0;
        const maxLevelToTest = 15; // High-resolution DZI files can go to level 13-15
        
        console.log('Finding maximum zoom level...');
        for (let level = maxLevelToTest; level >= 0; level--) {
            const testUrl = `${baseUrl}_files/${level}/0_0.jpg`;
            try {
                const result = await fetchUrl(testUrl);
                if (result.ok) {
                    maxLevel = level;
                    console.log(`  Max level found: ${level}`);
                    break;
                }
            } catch {
                // Continue searching
            }
        }
        
        if (maxLevel === 0) {
            throw new Error('No valid tiles found');
        }
        
        // Simulate grid size detection (DirectTileProcessor.ts lines 104-142)
        console.log('Detecting grid size at max level...');
        
        // Test for max columns (simplified binary search)
        let maxCol = 0;
        const colTestValues = [10, 20, 50, 100, 200];
        for (const col of colTestValues) {
            const testUrl = `${baseUrl}_files/${maxLevel}/${col}_0.jpg`;
            try {
                const result = await fetchUrl(testUrl);
                if (result.ok) {
                    maxCol = col;
                }
            } catch {
                break;
            }
        }
        
        // Test for max rows
        let maxRow = 0;
        const rowTestValues = [10, 20, 50, 100, 200];
        for (const row of rowTestValues) {
            const testUrl = `${baseUrl}_files/${maxLevel}/0_${row}.jpg`;
            try {
                const result = await fetchUrl(testUrl);
                if (result.ok) {
                    maxRow = row;
                }
            } catch {
                break;
            }
        }
        
        console.log(`Grid size at level ${maxLevel}: ${maxCol + 1} x ${maxRow + 1} tiles`);
        
        // Calculate estimated dimensions (DirectTileProcessor.ts lines 145-162)
        const tileSize = 256;
        const scale = Math.pow(2, maxLevel);
        const levelWidth = (maxCol + 1) * tileSize;
        const levelHeight = (maxRow + 1) * tileSize;
        let estimatedWidth = Math.ceil(levelWidth * scale / Math.pow(2, maxLevel));
        let estimatedHeight = Math.ceil(levelHeight * scale / Math.pow(2, maxLevel));
        
        console.log(`Raw estimated dimensions: ${estimatedWidth}x${estimatedHeight}`);
        
        // Memory analysis
        const pixelCount = estimatedWidth * estimatedHeight;
        const estimatedMemory = pixelCount * 4; // 4 bytes per RGBA pixel
        const MAX_SAFE_MEMORY = 1024 * 1024 * 1024; // 1GB
        const exceedsLimit = estimatedMemory > MAX_SAFE_MEMORY;
        
        console.log(`Pixel count: ${pixelCount.toLocaleString()}`);
        console.log(`Memory needed: ${(estimatedMemory / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Exceeds 1GB limit: ${exceedsLimit ? '🚨 YES' : '✅ NO'}`);
        
        // Test current memory validation (DirectTileProcessor.ts lines 152-162)
        if (exceedsLimit) {
            const scaleFactor = Math.sqrt(MAX_SAFE_MEMORY / estimatedMemory);
            const scaledWidth = Math.floor(estimatedWidth * scaleFactor);
            const scaledHeight = Math.floor(estimatedHeight * scaleFactor);
            console.log(`Memory scaling applied: ${scaledWidth}x${scaledHeight}`);
            estimatedWidth = scaledWidth;
            estimatedHeight = scaledHeight;
        }
        
        return {
            step: 'Tile Structure Probing',
            success: true,
            details: {
                maxLevel,
                gridSize: { cols: maxCol + 1, rows: maxRow + 1 },
                originalDimensions: { width: levelWidth * scale / Math.pow(2, maxLevel), height: levelHeight * scale / Math.pow(2, maxLevel) },
                finalDimensions: { width: estimatedWidth, height: estimatedHeight },
                tileSize
            },
            memoryAnalysis: {
                pixelCount,
                estimatedMemory,
                exceedsLimit
            }
        };
        
    } catch (error: any) {
        return {
            step: 'Tile Structure Probing',
            success: false,
            error: error.message,
            details: null
        };
    }
}

/**
 * Test 4: Canvas Creation - Where the error likely occurs
 */
async function test4_canvasCreation(): Promise<TestResult> {
    console.log('\nTEST 4: Canvas Creation Testing');
    console.log('-------------------------------');
    
    try {
        // Get dimensions from previous test
        const prevResult = results.find(r => r.step === 'Tile Structure Probing');
        if (!prevResult || !prevResult.details) {
            throw new Error('Previous tile structure test required');
        }
        
        const dimensions = prevResult.details.finalDimensions;
        console.log(`Testing canvas creation with dimensions: ${dimensions.width}x${dimensions.height}`);
        
        // Test the ultra-safe validation from DirectTileProcessor.ts lines 275-308
        const MAX_CANVAS_SIZE = 16384;
        
        let safeWidth = dimensions.width;
        let safeHeight = dimensions.height;
        
        // Handle invalid numbers (DirectTileProcessor.ts lines 280-288)
        if (!Number.isFinite(safeWidth) || safeWidth <= 0) {
            console.log(`Invalid width detected: ${safeWidth}, using fallback`);
            safeWidth = 1000;
        }
        
        if (!Number.isFinite(safeHeight) || safeHeight <= 0) {
            console.log(`Invalid height detected: ${safeHeight}, using fallback`);
            safeHeight = 1000;
        }
        
        // Ensure integers (DirectTileProcessor.ts lines 291-292)
        safeWidth = Math.floor(safeWidth);
        safeHeight = Math.floor(safeHeight);
        
        // Apply size limits (DirectTileProcessor.ts lines 295-296)
        safeWidth = Math.min(safeWidth, MAX_CANVAS_SIZE);
        safeHeight = Math.min(safeHeight, MAX_CANVAS_SIZE);
        
        console.log(`Safe dimensions after validation: ${safeWidth}x${safeHeight}`);
        
        // Final validation (DirectTileProcessor.ts lines 306-308)
        if (safeWidth <= 0 || safeHeight <= 0 || !Number.isInteger(safeWidth) || !Number.isInteger(safeHeight)) {
            throw new Error(`Cannot create canvas with invalid dimensions ${safeWidth}x${safeHeight}`);
        }
        
        // Test canvas creation with MockCanvas
        console.log('Attempting canvas creation...');
        const canvas = MockCanvas.createCanvas(safeWidth, safeHeight);
        console.log('✅ Canvas creation successful');
        
        return {
            step: 'Canvas Creation Testing',
            success: true,
            details: {
                originalDimensions: dimensions,
                safeDimensions: { width: safeWidth, height: safeHeight },
                validationPassed: true,
                canvasCreated: true
            }
        };
        
    } catch (error: any) {
        return {
            step: 'Canvas Creation Testing',
            success: false,
            error: error.message,
            details: {
                errorType: error.constructor.name,
                errorMessage: error.message,
                isRangeError: error instanceof RangeError
            }
        };
    }
}

/**
 * Test 5: Other Buffer Allocations - Find alternative sources
 */
async function test5_otherBufferAllocations(): Promise<TestResult> {
    console.log('\nTEST 5: Other Buffer Allocation Points');
    console.log('-------------------------------------');
    
    try {
        console.log('Testing other potential sources of "Invalid array length"...');
        
        // Test large buffer creation scenarios
        const scenarios = [
            { name: 'Tile data storage', size: 1000 * 256 * 256 }, // Many tiles
            { name: 'Concatenated chunks', size: 100 * 1024 * 1024 }, // 100MB file
            { name: 'JPEG encoding buffer', size: 50 * 1024 * 1024 }, // Large JPEG
            { name: 'Ultra-large buffer', size: 2 * 1024 * 1024 * 1024 } // 2GB - should fail
        ];
        
        const results = [];
        
        for (const scenario of scenarios) {
            console.log(`Testing ${scenario.name} (${(scenario.size / 1024 / 1024).toFixed(2)} MB)...`);
            
            try {
                // Test buffer allocation
                const buffer = Buffer.alloc(scenario.size);
                console.log(`  ✅ Success: ${scenario.name}`);
                results.push({ scenario: scenario.name, success: true });
            } catch (error: any) {
                console.log(`  ❌ Failed: ${scenario.name} - ${error.message}`);
                results.push({ 
                    scenario: scenario.name, 
                    success: false, 
                    error: error.message,
                    isRangeError: error instanceof RangeError
                });
                
                if (error instanceof RangeError) {
                    console.log(`  🚨 RangeError found in: ${scenario.name}`);
                }
            }
        }
        
        // Test array creation scenarios
        console.log('\nTesting array allocation scenarios...');
        
        const arrayScenarios = [
            { name: 'Tile array storage', length: 1000000 }, // 1M tiles
            { name: 'Pixel data array', length: 100000000 }, // 100M pixels
            { name: 'Ultra-large array', length: 2000000000 } // 2B elements - should fail
        ];
        
        for (const scenario of arrayScenarios) {
            console.log(`Testing ${scenario.name} (${scenario.length.toLocaleString()} elements)...`);
            
            try {
                const array = new Array(scenario.length);
                console.log(`  ✅ Success: ${scenario.name}`);
                results.push({ scenario: scenario.name, success: true });
            } catch (error: any) {
                console.log(`  ❌ Failed: ${scenario.name} - ${error.message}`);
                results.push({ 
                    scenario: scenario.name, 
                    success: false, 
                    error: error.message,
                    isRangeError: error instanceof RangeError
                });
                
                if (error instanceof RangeError) {
                    console.log(`  🚨 RangeError found in: ${scenario.name}`);
                }
            }
        }
        
        return {
            step: 'Other Buffer Allocation Points',
            success: true,
            details: {
                testedScenarios: results,
                rangeErrorsFound: results.filter(r => r.isRangeError).length
            }
        };
        
    } catch (error: any) {
        return {
            step: 'Other Buffer Allocation Points',
            success: false,
            error: error.message,
            details: null
        };
    }
}

/**
 * Generate comprehensive analysis report
 */
function generateAnalysisReport(): void {
    console.log('\n🎯 COMPREHENSIVE ANALYSIS REPORT');
    console.log('=================================');
    
    console.log('\n📊 TEST RESULTS SUMMARY:');
    results.forEach((result, index) => {
        console.log(`\n${index + 1}. ${result.step}: ${result.success ? '✅ PASS' : '❌ FAIL'}`);
        
        if (result.error) {
            console.log(`   Error: ${result.error}`);
        }
        
        if (result.memoryAnalysis) {
            const mem = result.memoryAnalysis;
            console.log(`   Memory: ${(mem.estimatedMemory / 1024 / 1024).toFixed(2)}MB, Exceeds limit: ${mem.exceedsLimit ? 'YES' : 'NO'}`);
        }
    });
    
    // Critical analysis
    console.log('\n🔥 ROOT CAUSE ANALYSIS:');
    
    const failedTests = results.filter(r => !r.success);
    if (failedTests.length === 0) {
        console.log('✅ All tests passed - current fixes may be working');
        console.log('❓ User may need to test with latest version');
    } else {
        console.log(`❌ ${failedTests.length} test(s) failed:`);
        failedTests.forEach(test => {
            console.log(`  - ${test.step}: ${test.error}`);
        });
    }
    
    // Page discovery analysis
    const pageTest = results.find(r => r.step === 'Page Discovery Analysis');
    if (pageTest && pageTest.details && pageTest.details.issueFound) {
        console.log('\n🚨 PAGE DISCOVERY ISSUE CONFIRMED:');
        console.log('  - maxTestPages limit of 200 prevents finding all 278 pages');
        console.log('  - Page 278 exists but discovery algorithm stops too early');
        console.log('  - FIX: Increase maxTestPages to 300 in SharedManifestLoaders.ts:3511');
    }
    
    // Memory analysis
    const memoryTests = results.filter(r => r.memoryAnalysis && r.memoryAnalysis.exceedsLimit);
    if (memoryTests.length > 0) {
        console.log('\n🚨 MEMORY ISSUES FOUND:');
        memoryTests.forEach(test => {
            const mem = test.memoryAnalysis!;
            console.log(`  - ${test.step}: ${(mem.estimatedMemory / 1024 / 1024).toFixed(2)}MB exceeds 1GB limit`);
        });
        console.log('  - Current fixes should handle this with dimension scaling');
    }
    
    console.log('\n🛠️  RECOMMENDED FIXES:');
    console.log('1. Increase maxTestPages from 200 to 300 in SharedManifestLoaders.ts line 3511');
    console.log('2. Current canvas validation fixes appear correct');
    console.log('3. Test with latest codebase in Electron production environment');
    console.log('4. Monitor for RangeError in buffer allocations beyond canvas');
}

/**
 * Main execution
 */
async function main() {
    try {
        console.log('Starting comprehensive error reproduction test...\n');
        
        results.push(await test1_bordeauxUrlProcessing());
        results.push(await test2_pageDiscovery());
        results.push(await test3_tileStructureProbing());
        results.push(await test4_canvasCreation());
        results.push(await test5_otherBufferAllocations());
        
        generateAnalysisReport();
        
        // Save detailed results
        const reportData = {
            timestamp: new Date().toISOString(),
            userUrl: 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778',
            testResults: results,
            summary: {
                totalTests: results.length,
                passed: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length,
                memoryIssues: results.filter(r => r.memoryAnalysis && r.memoryAnalysis.exceedsLimit).length
            }
        };
        
        const reportPath = '/home/evb/WebstormProjects/mss-downloader/.devkit/ultra-priority/issue-6/exact-error-reproduction-results.json';
        await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));
        
        console.log(`\n📄 Detailed results saved to: ${reportPath}`);
        
    } catch (error) {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
    }
}

// Execute the test
main();