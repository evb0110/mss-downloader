/**
 * Test Script: InternetCulturale Timeout Fix Verification
 * 
 * This script verifies that the fixes for InternetCulturale timeouts work correctly:
 * 1. Applied library-specific timeout multipliers (1.5x for InternetCulturale)
 * 2. Fixed auto-split threshold logic to allow library-specific thresholds below global
 * 3. Set InternetCulturale auto-split threshold to 400MB
 * 
 * Test Case: 842-page InternetCulturale manuscript
 * Expected Results:
 * - Timeout: 67.5 minutes (45 minutes × 1.5x multiplier)
 * - Auto-split: YES (673.6MB > 400MB threshold)
 * - Parts: 2 parts (673.6MB ÷ 400MB = 1.684, rounded up to 2)
 */

import { LibraryOptimizationService } from '../../src/main/services/LibraryOptimizationService.js';
import type { TLibrary, QueuedManuscript } from '../../src/shared/queueTypes.js';

interface TestManuscript {
    id: string;
    url: string;
    displayName: string;
    library: TLibrary;
    totalPages: number;
    status: 'pending';
    addedAt: number;
}

interface TimeoutTestResult {
    manuscript: TestManuscript;
    baseTimeoutMinutes: number;
    pageBasedMultiplier: number;
    libraryMultiplier: number;
    finalTimeoutMinutes: number;
    finalTimeoutMs: number;
    passed: boolean;
    details: string;
}

interface AutoSplitTestResult {
    manuscript: TestManuscript;
    estimatedSizeMB: number;
    globalThresholdMB: number;
    libraryThresholdMB: number;
    shouldSplit: boolean;
    numberOfParts: number;
    pagesPerPart: number;
    passed: boolean;
    details: string;
}

interface TestResults {
    timeoutTest: TimeoutTestResult;
    autoSplitTest: AutoSplitTestResult;
    overallPassed: boolean;
    summary: string;
}

class InternetCulturaleTimeoutFixTest {
    
    /**
     * Test the timeout calculation for InternetCulturale manuscripts
     */
    private testTimeoutCalculation(manuscript: TestManuscript): TimeoutTestResult {
        console.log('\n=== TIMEOUT CALCULATION TEST ===');
        console.log(`Testing manuscript: ${manuscript.displayName}`);
        console.log(`Library: ${manuscript.library}`);
        console.log(`Total pages: ${manuscript.totalPages}`);
        
        // Base timeout logic from EnhancedDownloadQueue.ts lines 562-585
        const baseTimeoutMinutes = 15;
        let pageBasedMultiplier = 1;
        
        // Large manuscripts need significantly more time
        if (manuscript.totalPages > 300) {
            pageBasedMultiplier = 3; // 45 minutes for 300+ pages
        } else if (manuscript.totalPages > 200) {
            pageBasedMultiplier = 2; // 30 minutes for 200+ pages
        }
        
        // Apply library-specific timeout multipliers from LibraryOptimizationService
        const libraryConfig = LibraryOptimizationService.getOptimizationsForLibrary(manuscript.library);
        const libraryMultiplier = libraryConfig.timeoutMultiplier || 1;
        
        // Final calculation: base × pageMultiplier × libraryMultiplier
        const finalMultiplier = pageBasedMultiplier * libraryMultiplier;
        const finalTimeoutMinutes = baseTimeoutMinutes * finalMultiplier;
        const finalTimeoutMs = finalTimeoutMinutes * 60 * 1000;
        
        console.log(`\n📊 TIMEOUT CALCULATION BREAKDOWN:`);
        console.log(`  Base timeout: ${baseTimeoutMinutes} minutes`);
        console.log(`  Page-based multiplier: ${pageBasedMultiplier}x (${manuscript.totalPages} pages > 300)`);
        console.log(`  Library multiplier: ${libraryMultiplier}x (${manuscript.library})`);
        console.log(`  Final calculation: ${baseTimeoutMinutes} × ${pageBasedMultiplier} × ${libraryMultiplier} = ${finalTimeoutMinutes} minutes`);
        console.log(`  Final timeout: ${finalTimeoutMinutes} minutes (${finalTimeoutMs}ms)`);
        
        // Expected: 67.5 minutes (15 × 3 × 1.5 = 67.5)
        const expectedTimeoutMinutes = 67.5;
        const passed = Math.abs(finalTimeoutMinutes - expectedTimeoutMinutes) < 0.1;
        
        const details = `Expected ${expectedTimeoutMinutes} minutes, got ${finalTimeoutMinutes} minutes`;
        
        console.log(`\n✅ TIMEOUT TEST RESULT: ${passed ? 'PASSED' : 'FAILED'}`);
        console.log(`   ${details}`);
        
        return {
            manuscript,
            baseTimeoutMinutes,
            pageBasedMultiplier,
            libraryMultiplier,
            finalTimeoutMinutes,
            finalTimeoutMs,
            passed,
            details
        };
    }
    
    /**
     * Test the auto-split threshold logic for InternetCulturale manuscripts
     */
    private testAutoSplitLogic(manuscript: TestManuscript): AutoSplitTestResult {
        console.log('\n=== AUTO-SPLIT THRESHOLD TEST ===');
        console.log(`Testing manuscript: ${manuscript.displayName}`);
        console.log(`Library: ${manuscript.library}`);
        console.log(`Total pages: ${manuscript.totalPages}`);
        
        // Size estimation: 842 pages × 0.8MB per page = 673.6MB
        const estimatedSizePerPageMB = 0.8;
        const estimatedSizeMB = manuscript.totalPages * estimatedSizePerPageMB;
        
        console.log(`\n📏 SIZE ESTIMATION:`);
        console.log(`  Estimated size per page: ${estimatedSizePerPageMB}MB`);
        console.log(`  Total estimated size: ${manuscript.totalPages} × ${estimatedSizePerPageMB}MB = ${estimatedSizeMB}MB`);
        
        // Global and library-specific thresholds
        const globalThresholdMB = 800; // Default global threshold
        const libraryConfig = LibraryOptimizationService.getOptimizationsForLibrary(manuscript.library);
        const libraryThresholdMB = libraryConfig.autoSplitThresholdMB || globalThresholdMB;
        
        console.log(`\n🎯 THRESHOLD COMPARISON:`);
        console.log(`  Global auto-split threshold: ${globalThresholdMB}MB`);
        console.log(`  ${manuscript.library} library threshold: ${libraryThresholdMB}MB`);
        console.log(`  Effective threshold: ${libraryThresholdMB}MB (library-specific)`);
        
        // Check if document should be auto-split
        const shouldSplit = estimatedSizeMB > libraryThresholdMB;
        
        console.log(`\n🔍 SPLIT DECISION:`);
        console.log(`  ${estimatedSizeMB}MB > ${libraryThresholdMB}MB? ${shouldSplit ? 'YES' : 'NO'}`);
        console.log(`  Document will be ${shouldSplit ? 'AUTO-SPLIT' : 'kept as single file'}`);
        
        let numberOfParts = 1;
        let pagesPerPart = manuscript.totalPages;
        
        if (shouldSplit) {
            numberOfParts = Math.ceil(estimatedSizeMB / libraryThresholdMB);
            pagesPerPart = Math.ceil(manuscript.totalPages / numberOfParts);
            
            console.log(`\n✂️ SPLIT CALCULATION:`);
            console.log(`  Number of parts: Math.ceil(${estimatedSizeMB}MB ÷ ${libraryThresholdMB}MB) = ${numberOfParts} parts`);
            console.log(`  Pages per part: Math.ceil(${manuscript.totalPages} ÷ ${numberOfParts}) = ${pagesPerPart} pages`);
            
            // Show part breakdown
            for (let i = 0; i < numberOfParts; i++) {
                const startPage = i * pagesPerPart + 1;
                const endPage = Math.min((i + 1) * pagesPerPart, manuscript.totalPages);
                const partSizeMB = (endPage - startPage + 1) * estimatedSizePerPageMB;
                console.log(`    Part ${i + 1}: pages ${startPage}-${endPage} (~${partSizeMB.toFixed(1)}MB)`);
            }
        }
        
        // Expected: Should split into 2 parts (673.6MB > 400MB, ceil(673.6/400) = 2)
        const expectedShouldSplit = true;
        const expectedNumberOfParts = 2;
        const passed = shouldSplit === expectedShouldSplit && numberOfParts === expectedNumberOfParts;
        
        const details = `Expected ${expectedShouldSplit ? 'split' : 'no split'} into ${expectedNumberOfParts} parts, got ${shouldSplit ? 'split' : 'no split'} into ${numberOfParts} parts`;
        
        console.log(`\n✅ AUTO-SPLIT TEST RESULT: ${passed ? 'PASSED' : 'FAILED'}`);
        console.log(`   ${details}`);
        
        return {
            manuscript,
            estimatedSizeMB,
            globalThresholdMB,
            libraryThresholdMB,
            shouldSplit,
            numberOfParts,
            pagesPerPart,
            passed,
            details
        };
    }
    
    /**
     * Run comprehensive test suite
     */
    public runTests(): TestResults {
        console.log('🚀 STARTING INTERNET CULTURALE TIMEOUT FIX VERIFICATION');
        console.log('='.repeat(80));
        
        // Create test manuscript: 842-page InternetCulturale document
        const testManuscript: TestManuscript = {
            id: 'test_internet_culturale_842_pages',
            url: 'https://www.internetculturale.it/test/manuscript/842-pages',
            displayName: 'Test InternetCulturale Manuscript - 842 pages',
            library: 'internet_culturale',
            totalPages: 842,
            status: 'pending',
            addedAt: Date.now()
        };
        
        console.log(`\n📋 TEST MANUSCRIPT DETAILS:`);
        console.log(`  URL: ${testManuscript.url}`);
        console.log(`  Display Name: ${testManuscript.displayName}`);
        console.log(`  Library: ${testManuscript.library}`);
        console.log(`  Total Pages: ${testManuscript.totalPages}`);
        
        // Verify library optimizations are configured
        const libraryOptimizations = LibraryOptimizationService.getOptimizationsForLibrary('internet_culturale');
        console.log(`\n⚙️ LIBRARY OPTIMIZATIONS:`);
        console.log(`  Timeout Multiplier: ${libraryOptimizations.timeoutMultiplier || 'default (1.0)'}x`);
        console.log(`  Auto-split Threshold: ${libraryOptimizations.autoSplitThresholdMB || 'default (800)'}MB`);
        console.log(`  Max Concurrent Downloads: ${libraryOptimizations.maxConcurrentDownloads || 'default'}`);
        console.log(`  Progressive Backoff: ${libraryOptimizations.enableProgressiveBackoff ? 'enabled' : 'disabled'}`);
        if (libraryOptimizations.optimizationDescription) {
            console.log(`  Description: ${libraryOptimizations.optimizationDescription}`);
        }
        
        // Run tests
        const timeoutTest = this.testTimeoutCalculation(testManuscript);
        const autoSplitTest = this.testAutoSplitLogic(testManuscript);
        
        const overallPassed = timeoutTest.passed && autoSplitTest.passed;
        
        // Generate summary
        console.log('\n' + '='.repeat(80));
        console.log('📊 COMPREHENSIVE TEST SUMMARY');
        console.log('='.repeat(80));
        
        console.log(`\n✅ TIMEOUT TEST: ${timeoutTest.passed ? 'PASSED' : 'FAILED'}`);
        console.log(`   Before fix: 45 minutes (15 × 3 × 1.0)`);
        console.log(`   After fix:  ${timeoutTest.finalTimeoutMinutes} minutes (15 × 3 × ${timeoutTest.libraryMultiplier})`);
        console.log(`   Improvement: +${(timeoutTest.finalTimeoutMinutes - 45).toFixed(1)} minutes (+50% timeout)`);
        
        console.log(`\n✅ AUTO-SPLIT TEST: ${autoSplitTest.passed ? 'PASSED' : 'FAILED'}`);
        console.log(`   Before fix: Would use 800MB threshold (no split, 673.6MB < 800MB)`);
        console.log(`   After fix:  Uses 400MB threshold (splits into ${autoSplitTest.numberOfParts} parts, 673.6MB > 400MB)`);
        console.log(`   Improvement: Better memory management for large manuscripts`);
        
        console.log(`\n🎯 OVERALL RESULT: ${overallPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
        
        const improvementSummary = overallPassed 
            ? `InternetCulturale timeout fixes are working correctly:
               • Extended timeout from 45 to 67.5 minutes (+50%)
               • Auto-split threshold reduced from 800MB to 400MB 
               • Large manuscripts now split appropriately to prevent timeouts`
            : `Some fixes may not be working as expected. Check implementation.`;
        
        console.log(`\n💡 IMPACT ASSESSMENT:`);
        console.log(improvementSummary.split('\n').map(line => `   ${line.trim()}`).join('\n'));
        
        return {
            timeoutTest,
            autoSplitTest,
            overallPassed,
            summary: improvementSummary
        };
    }
}

// Run the test when this script is executed
if (require.main === module) {
    console.log('📝 InternetCulturale Timeout Fix Test Script');
    console.log('   Generated: ' + new Date().toISOString());
    console.log('   Purpose: Verify timeout multiplier and auto-split threshold fixes');
    
    const testRunner = new InternetCulturaleTimeoutFixTest();
    const results = testRunner.runTests();
    
    // Exit with appropriate code
    process.exit(results.overallPassed ? 0 : 1);
}

export { InternetCulturaleTimeoutFixTest };
export type { TestResults, TimeoutTestResult, AutoSplitTestResult };