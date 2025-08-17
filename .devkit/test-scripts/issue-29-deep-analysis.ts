#!/usr/bin/env bun

/**
 * DEEP ANALYSIS: Issue #29 - Infinite Loop Problem
 * Tests the exact URLs reported by user with detailed analysis
 */

import { SharedManifestLoaders } from '../../src/shared/SharedManifestLoaders';

const PROBLEMATIC_URLS = [
    {
        name: 'Linz - Breviarium monasticum',
        url: 'https://digi.landesbibliothek.at/viewer/image/116/',
        expectedPages: 758,
        userReport: 'зацикливание сохраняется, при загрузке видно перебирание кадров, но над строкой написано downloading 0 of 1330'
    },
    {
        name: 'e-rara - Zurich manuscript', 
        url: 'https://www.e-rara.ch/zuz/content/titleinfo/8325160',
        expectedPages: 1330,
        userReport: 'создаются 3 пдфки, хотя деление на части не указывалось, суммарный вес скачавшихся пдф меньше'
    }
];

class InfiniteLoopAnalyzer {
    private manifestLoaders: SharedManifestLoaders;

    constructor() {
        this.manifestLoaders = new SharedManifestLoaders();
    }

    async analyzeManifestLoading(testCase: any) {
        console.log(`\n🔍 DEEP ANALYSIS: ${testCase.name}`);
        console.log(`📋 URL: ${testCase.url}`);
        console.log(`👤 User Report: ${testCase.userReport}`);
        console.log(`📊 Expected Pages: ${testCase.expectedPages}`);
        
        const startTime = Date.now();
        
        try {
            console.log('\n📥 Step 1: Loading manifest with production code...');
            
            // Determine library
            let library = 'unknown';
            if (testCase.url.includes('digi.landesbibliothek.at')) library = 'linz';
            if (testCase.url.includes('e-rara.ch')) library = 'e_rara';
            
            console.log(`🏛️ Detected library: ${library}`);
            
            // Load manifest 
            const manifest = await this.manifestLoaders.getManifestForLibrary(library, testCase.url);
            const loadTime = Date.now() - startTime;
            
            console.log(`✅ Manifest loaded in ${loadTime}ms`);
            
            // Analyze manifest structure
            if (Array.isArray(manifest)) {
                console.log(`📊 Manifest type: Array with ${manifest.length} items`);
                
                if (manifest.length !== testCase.expectedPages) {
                    console.log(`⚠️ PAGE COUNT MISMATCH:`);
                    console.log(`   Expected: ${testCase.expectedPages} pages`);
                    console.log(`   Actual: ${manifest.length} pages`);
                    console.log(`   Difference: ${Math.abs(manifest.length - testCase.expectedPages)} pages`);
                }
                
                // Check image quality/resolution
                if (manifest.length > 0) {
                    const firstImage = manifest[0];
                    console.log(`\n🖼️ FIRST IMAGE ANALYSIS:`);
                    console.log(`   URL: ${firstImage.url}`);
                    
                    // Check if it's a low-res thumbnail
                    if (firstImage.url.includes('!400,400') || firstImage.url.includes('thumbnail') || firstImage.url.includes('small')) {
                        console.log(`❌ THUMBNAIL DETECTED: Images are low resolution!`);
                        console.log(`   This explains why PDFs are smaller than expected`);
                    } else if (firstImage.url.includes('/full/') || firstImage.url.includes('max')) {
                        console.log(`✅ FULL RESOLUTION: Images should be high quality`);
                    } else {
                        console.log(`❓ UNKNOWN RESOLUTION: Need to investigate URL pattern`);
                    }
                    
                    // Sample additional images
                    if (manifest.length >= 3) {
                        console.log(`\n📋 SAMPLING ADDITIONAL IMAGES:`);
                        const midIndex = Math.floor(manifest.length / 2);
                        const lastIndex = manifest.length - 1;
                        
                        console.log(`   Middle image (${midIndex}): ${manifest[midIndex].url}`);
                        console.log(`   Last image (${lastIndex}): ${manifest[lastIndex].url}`);
                        
                        // Check for proper sequencing
                        const firstPageNum = this.extractPageNumber(manifest[0].url);
                        const midPageNum = this.extractPageNumber(manifest[midIndex].url);
                        const lastPageNum = this.extractPageNumber(manifest[lastIndex].url);
                        
                        console.log(`\n🔢 PAGE SEQUENCING:`);
                        console.log(`   First: page ${firstPageNum || 'unknown'}`);
                        console.log(`   Middle: page ${midPageNum || 'unknown'}`);
                        console.log(`   Last: page ${lastPageNum || 'unknown'}`);
                        
                        if (firstPageNum && midPageNum && lastPageNum) {
                            if (firstPageNum < midPageNum && midPageNum < lastPageNum) {
                                console.log(`   ✅ Proper ascending sequence`);
                            } else {
                                console.log(`   ❌ IMPROPER SEQUENCE - May cause download issues`);
                            }
                        }
                    }
                }
                
            } else if (manifest && typeof manifest === 'object' && 'images' in manifest) {
                const images = (manifest as any).images;
                console.log(`📊 Manifest type: Object with ${images?.length || 0} images`);
            } else {
                console.log(`📊 Manifest type: ${typeof manifest}`);
                console.log(`📊 Manifest keys: ${manifest && typeof manifest === 'object' ? Object.keys(manifest).join(', ') : 'none'}`);
            }
            
            return {
                success: true,
                loadTime,
                manifest,
                pageCount: Array.isArray(manifest) ? manifest.length : (manifest as any)?.images?.length || 0
            };
            
        } catch (error) {
            const errorTime = Date.now() - startTime;
            console.log(`❌ FAILED after ${errorTime}ms: ${error instanceof Error ? error.message : String(error)}`);
            
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                loadTime: errorTime
            };
        }
    }
    
    private extractPageNumber(url: string): number | null {
        // Try to extract page number from various URL patterns
        const patterns = [
            /\/(\d+)\.jpg/, // /123.jpg
            /\/(\d+)\//, // /123/
            /page[_-]?(\d+)/i, // page123, page_123, page-123
            /_(\d+)\./  // name_123.jpg
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return parseInt(match[1], 10);
            }
        }
        
        return null;
    }
    
    async runCompleteAnalysis() {
        console.log('🔥 ISSUE #29 INFINITE LOOP DEEP ANALYSIS');
        console.log('=' .repeat(80));
        console.log('Testing exact URLs from user reports with detailed diagnostics\n');
        
        const results = [];
        
        for (const testCase of PROBLEMATIC_URLS) {
            const result = await this.analyzeManifestLoading(testCase);
            results.push({ testCase, result });
            
            // Wait between tests
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Summary
        console.log('\n' + '=' .repeat(80));
        console.log('📊 COMPREHENSIVE ANALYSIS SUMMARY');
        console.log('=' .repeat(80));
        
        for (const { testCase, result } of results) {
            console.log(`\n${testCase.name}:`);
            console.log(`  Status: ${result.success ? '✅ Success' : '❌ Failed'}`);
            console.log(`  Load time: ${result.loadTime}ms`);
            
            if (result.success) {
                console.log(`  Pages found: ${result.pageCount}`);
                
                if (result.pageCount !== testCase.expectedPages) {
                    console.log(`  ⚠️ Page count mismatch: expected ${testCase.expectedPages}, got ${result.pageCount}`);
                }
                
                // Analyze potential infinite loop causes
                console.log(`\n  🔍 INFINITE LOOP ANALYSIS:`);
                
                if (result.pageCount === 0) {
                    console.log(`    ❌ No pages found - would cause "downloading 0 of X" display`);
                } else if (result.pageCount < testCase.expectedPages * 0.5) {
                    console.log(`    ⚠️ Significantly fewer pages than expected - partial loading issue`);
                } else {
                    console.log(`    ✅ Page count looks reasonable`);
                }
                
            } else {
                console.log(`  Error: ${result.error}`);
            }
        }
        
        return results;
    }
}

// Main execution
async function main() {
    const analyzer = new InfiniteLoopAnalyzer();
    await analyzer.runCompleteAnalysis();
}

if (import.meta.main) {
    main().catch(console.error);
}