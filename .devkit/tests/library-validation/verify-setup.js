#!/usr/bin/env node

/**
 * Verify Test Setup Script
 * Checks that all dependencies and prerequisites are available
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Verifying Test Setup');
console.log('===================\n');

let allGood = true;

// Check Node.js version
console.log('1. Checking Node.js version...');
const nodeVersion = process.version;
console.log(`   Node.js version: ${nodeVersion}`);
const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
if (majorVersion >= 14) {
    console.log('   ✅ Node.js version is compatible\n');
} else {
    console.log('   ❌ Node.js version too old (need v14+)\n');
    allGood = false;
}

// Check poppler-utils
console.log('2. Checking poppler-utils (for PDF validation)...');
try {
    execSync('which pdfinfo', { stdio: 'pipe' });
    console.log('   ✅ poppler-utils is installed\n');
} catch (error) {
    console.log('   ❌ poppler-utils not found');
    console.log('   Install with: sudo apt-get install poppler-utils\n');
    allGood = false;
}

// Check required modules
console.log('3. Checking required npm packages...');
const requiredModules = [
    'pdf-lib',
    'sharp',
    'https',
    'crypto',
    'child_process'
];

for (const module of requiredModules) {
    try {
        if (module === 'https' || module === 'crypto' || module === 'child_process') {
            // Built-in modules
            console.log(`   ✅ ${module} (built-in)`);
        } else {
            require.resolve(module);
            console.log(`   ✅ ${module}`);
        }
    } catch (error) {
        console.log(`   ❌ ${module} not found`);
        allGood = false;
    }
}

// Check SharedManifestLoaders
console.log('\n4. Checking SharedManifestLoaders...');
const sharedManifestPath = path.join(__dirname, '../../../src/shared/SharedManifestLoaders.js');
if (fs.existsSync(sharedManifestPath)) {
    console.log('   ✅ SharedManifestLoaders.js found');
} else {
    console.log('   ❌ SharedManifestLoaders.js not found');
    allGood = false;
}

// Check EnhancedManuscriptDownloaderService
console.log('\n5. Checking EnhancedManuscriptDownloaderService...');
const downloaderPath = path.join(__dirname, '../../../src/main/services/EnhancedManuscriptDownloaderService.ts');
if (fs.existsSync(downloaderPath)) {
    console.log('   ✅ EnhancedManuscriptDownloaderService.ts found');
} else {
    console.log('   ❌ EnhancedManuscriptDownloaderService.ts not found');
    allGood = false;
}

// Check test scripts
console.log('\n6. Checking test scripts...');
const testScripts = [
    'run-all-tests.js',
    'test-nbm-verona.js',
    'test-morgan-library.js',
    'test-graz-university.js',
    'test-hhu-duesseldorf.js'
];

for (const script of testScripts) {
    const scriptPath = path.join(__dirname, script);
    if (fs.existsSync(scriptPath)) {
        const stats = fs.statSync(scriptPath);
        if (stats.mode & 0o100) {
            console.log(`   ✅ ${script} (executable)`);
        } else {
            console.log(`   ⚠️  ${script} (not executable)`);
        }
    } else {
        console.log(`   ❌ ${script} not found`);
        allGood = false;
    }
}

// Check output directory permissions
console.log('\n7. Checking output directory...');
const testResultsDir = path.join(__dirname, 'test-results');
try {
    if (!fs.existsSync(testResultsDir)) {
        fs.mkdirSync(testResultsDir, { recursive: true });
    }
    const testFile = path.join(testResultsDir, '.test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log('   ✅ Can write to test-results directory\n');
} catch (error) {
    console.log('   ❌ Cannot write to test-results directory');
    console.log(`   Error: ${error.message}\n`);
    allGood = false;
}

// Summary
console.log('===================');
if (allGood) {
    console.log('✅ All checks passed! Ready to run tests.');
    console.log('\nTo run all tests:');
    console.log('  node run-all-tests.js');
    console.log('\nTo run individual tests:');
    console.log('  node test-nbm-verona.js');
    console.log('  node test-morgan-library.js');
    console.log('  node test-graz-university.js');
    console.log('  node test-hhu-duesseldorf.js');
} else {
    console.log('❌ Some checks failed. Please fix the issues above before running tests.');
    process.exit(1);
}

console.log('\n===================\n');