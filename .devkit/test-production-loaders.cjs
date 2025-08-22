#!/usr/bin/env node

/**
 * Production Code Test Framework v3.0
 * Tests ACTUAL production code, not isolated scripts
 * Tests with EXACT user-reported URLs
 */

const fs = require('fs');
const path = require('path');

// Load test cases from extracted URLs
const testCases = JSON.parse(fs.readFileSync('.devkit/issue-test-cases.json', 'utf8'));

// Import ACTUAL production code - the SharedManifestLoaders
const sharedLoaderPath = path.join(__dirname, '..', 'src', 'shared', 'SharedManifestLoaders.ts');

console.log('=== PRODUCTION CODE LOADER TEST ===\n');
console.log('Testing manifest loading with EXACT user URLs...\n');

// Since we can't directly import TypeScript in Node, we'll test via the build
const { execSync } = require('child_process');

// Test each issue
const results = {};

for (const [key, testCase] of Object.entries(testCases)) {
    if (!testCase.primaryUrl) {
        console.log(`Issue #${testCase.number} (${testCase.title}): No URL provided - SKIP`);
        results[key] = { status: 'no_url' };
        continue;
    }
    
    console.log(`\nTesting Issue #${testCase.number} (${testCase.title}):`);
    console.log(`  URL: ${testCase.primaryUrl}`);
    
    try {
        // Create a test script that uses the actual production code
        const testScript = `
import { SharedManifestLoaders } from '../src/shared/SharedManifestLoaders';

async function test() {
    const loader = new SharedManifestLoaders();
    const url = '${testCase.primaryUrl}';
    
    try {
        // Detect library from URL (production logic)
        const libraryType = await loader.detectLibraryFromUrl(url);
        console.log('Library detected:', libraryType);
        
        // Load manifest using production code
        const manifest = await loader.loadManifest(url, libraryType);
        console.log('Manifest loaded successfully');
        console.log('Pages found:', manifest.pages?.length || 0);
        
        return { success: true, library: libraryType, pageCount: manifest.pages?.length };
    } catch (error) {
        console.log('Failed:', error.message);
        return { success: false, error: error.message };
    }
}

test().then(result => {
    console.log(JSON.stringify(result));
});
`;
        
        // Write and run test
        fs.writeFileSync('.devkit/temp-test.ts', testScript);
        
        // Use bun to run TypeScript directly
        const output = execSync('cd /home/ubuntu/mss-downloader && bun .devkit/temp-test.ts 2>&1', {
            encoding: 'utf8',
            timeout: 30000
        });
        
        console.log('  Result:', output.trim());
        
        // Parse result
        const lines = output.split('\n');
        const lastLine = lines[lines.length - 1];
        try {
            const result = JSON.parse(lastLine);
            results[key] = result;
            if (result.success) {
                console.log(`  ✅ SUCCESS - ${result.pageCount} pages found`);
            } else {
                console.log(`  ❌ FAILED - ${result.error}`);
            }
        } catch (e) {
            console.log(`  ❌ FAILED - Could not parse output`);
            results[key] = { status: 'parse_error', output };
        }
        
    } catch (error) {
        console.log(`  ❌ ERROR: ${error.message}`);
        results[key] = { status: 'error', error: error.message };
    }
}

// Summary
console.log('\n=== SUMMARY ===\n');
let fixed = 0;
let broken = 0;
let noUrl = 0;

for (const [key, result] of Object.entries(results)) {
    const testCase = testCases[key];
    if (result.status === 'no_url') {
        noUrl++;
        console.log(`Issue #${testCase.number}: No URL provided`);
    } else if (result.success) {
        fixed++;
        console.log(`Issue #${testCase.number}: ✅ WORKING (${result.pageCount} pages)`);
    } else {
        broken++;
        console.log(`Issue #${testCase.number}: ❌ BROKEN - ${result.error || result.status}`);
    }
}

console.log(`\nTotal: ${Object.keys(results).length} issues`);
console.log(`Working: ${fixed}`);
console.log(`Broken: ${broken}`);
console.log(`No URL: ${noUrl}`);

// Save results
fs.writeFileSync('.devkit/test-results.json', JSON.stringify(results, null, 2));
console.log('\nDetailed results saved to .devkit/test-results.json');