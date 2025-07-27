#!/usr/bin/env node

/**
 * Comprehensive Library Validation Test Suite
 * Tests all recent library fixes to ensure they work correctly before version bump
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_RESULTS_DIR = path.join(__dirname, 'test-results');
const TIMESTAMP = new Date().toISOString().replace(/[:]/g, '-').split('.')[0];

// Create results directory
if (!fs.existsSync(TEST_RESULTS_DIR)) {
    fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });
}

const TESTS = [
    {
        name: 'NBM Italy (Verona)',
        script: './test-nbm-verona.js',
        description: 'Tests NBM Verona library with multiple manuscripts including codice=15'
    },
    {
        name: 'Morgan Library',
        script: './test-morgan-library.js',
        description: 'Tests Morgan Library page extraction for Lindau Gospels and other manuscripts'
    },
    {
        name: 'University of Graz',
        script: './test-graz-university.js',
        description: 'Tests University of Graz timeout handling and large manuscript downloads'
    },
    {
        name: 'HHU Düsseldorf',
        script: './test-hhu-duesseldorf.js',
        description: 'Tests HHU Düsseldorf high-resolution image downloads and error handling'
    }
];

console.log('========================================');
console.log('Library Validation Test Suite');
console.log(`Started at: ${new Date().toLocaleString()}`);
console.log('========================================\n');

const results = [];
let allPassed = true;

// Run each test
for (const test of TESTS) {
    console.log(`\n📚 Running test: ${test.name}`);
    console.log(`   ${test.description}`);
    console.log('   ' + '='.repeat(60));
    
    const startTime = Date.now();
    let passed = false;
    let error = null;
    
    try {
        // Make script executable
        execSync(`chmod +x ${test.script}`, { cwd: __dirname });
        
        // Run test with output
        execSync(`node ${test.script}`, {
            cwd: __dirname,
            stdio: 'inherit',
            env: { ...process.env, TEST_RESULTS_DIR }
        });
        
        passed = true;
        console.log(`\n   ✅ ${test.name} - PASSED`);
    } catch (err) {
        error = err.message || err.toString();
        console.error(`\n   ❌ ${test.name} - FAILED`);
        console.error(`   Error: ${error}`);
        allPassed = false;
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    results.push({
        name: test.name,
        script: test.script,
        passed,
        error,
        duration: `${duration}s`
    });
}

// Generate summary report
console.log('\n\n========================================');
console.log('TEST SUMMARY');
console.log('========================================');

results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${result.name} (${result.duration})`);
    if (result.error) {
        console.log(`     Error: ${result.error.substring(0, 100)}...`);
    }
});

console.log('\n========================================');
console.log(`Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
console.log(`Total Tests: ${results.length}`);
console.log(`Passed: ${results.filter(r => r.passed).length}`);
console.log(`Failed: ${results.filter(r => !r.passed).length}`);
console.log('========================================');

// Save results to JSON
const reportPath = path.join(TEST_RESULTS_DIR, `test-report-${TIMESTAMP}.json`);
fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    allPassed,
    totalTests: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    results
}, null, 2));

console.log(`\nDetailed report saved to: ${reportPath}`);

// Check for validation PDFs
const validationDir = path.join(TEST_RESULTS_DIR, TIMESTAMP);
if (fs.existsSync(validationDir)) {
    const pdfFiles = fs.readdirSync(validationDir).filter(f => f.endsWith('.pdf'));
    if (pdfFiles.length > 0) {
        console.log(`\nValidation PDFs created in: ${validationDir}`);
        console.log('PDFs generated:');
        pdfFiles.forEach(pdf => {
            const stats = fs.statSync(path.join(validationDir, pdf));
            const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
            console.log(`  - ${pdf} (${sizeMB} MB)`);
        });
    }
}

console.log('\n========================================');
console.log('NEXT STEPS:');
console.log('========================================');
if (allPassed) {
    console.log('1. Review the generated PDFs in the test-results directory');
    console.log('2. Verify that all manuscripts contain proper content');
    console.log('3. Check that multi-page manuscripts have all pages (not stuck on page 1)');
    console.log('4. Confirm high-resolution images are being downloaded');
    console.log('5. If all looks good, proceed with version bump');
} else {
    console.log('1. Review the error logs for failed tests');
    console.log('2. Fix the issues in the main codebase');
    console.log('3. Re-run the failed tests individually');
    console.log('4. Once all tests pass, re-run the full suite');
}

// Exit with appropriate code
process.exit(allPassed ? 0 : 1);