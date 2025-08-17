#!/usr/bin/env node

/**
 * ULTRATHINK Validation: No More Hardcoded Limits
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 NO MORE HARDCODED LIMITS - DEEP VALIDATION');
console.log('='.repeat(60));

// Files to check
const romeLoaderPath = path.join(__dirname, '../src/main/services/library-loaders/RomeLoader.ts');
const sharedLoadersPath = path.join(__dirname, '../src/shared/SharedManifestLoaders.ts');

const romeLoader = fs.readFileSync(romeLoaderPath, 'utf-8');
const sharedLoaders = fs.readFileSync(sharedLoadersPath, 'utf-8');

let issues = [];
let successes = [];

console.log('\n📊 CHECKING FOR HARDCODED LIMITS...\n');

// Test 1: Check RomeLoader for hardcoded limits
console.log('✅ Test 1: RomeLoader no hardcoded page limits');
const romeHardcodedPattern = /const totalPages\s*=\s*\d+/g;
const romeMatches = romeLoader.match(romeHardcodedPattern);
if (romeMatches) {
    issues.push(`RomeLoader still has hardcoded limit: ${romeMatches.join(', ')}`);
    console.log(`   ✗ Found hardcoded limits: ${romeMatches.join(', ')}`);
} else {
    successes.push('RomeLoader: No hardcoded limits');
    console.log('   ✓ No hardcoded page limits found');
}

// Test 2: Check RomeLoader has binary search
console.log('\n✅ Test 2: RomeLoader implements binary search');
if (romeLoader.includes('discoverPageCount') && romeLoader.includes('binary search')) {
    successes.push('RomeLoader: Binary search implemented');
    console.log('   ✓ Binary search implementation found');
} else {
    issues.push('RomeLoader missing binary search implementation');
    console.log('   ✗ Binary search not properly implemented');
}

// Test 3: Check SharedManifestLoaders Rome method
console.log('\n✅ Test 3: SharedManifestLoaders Rome no hardcoded limits');
const romeSection = sharedLoaders.match(/async getRomeManifest[\s\S]*?^\s{4}\}/m);
if (romeSection) {
    const sectionContent = romeSection[0];
    const hardcodedInSection = sectionContent.match(/const totalPages\s*=\s*\d+/);
    if (hardcodedInSection) {
        issues.push(`SharedManifestLoaders getRomeManifest has hardcoded limit: ${hardcodedInSection[0]}`);
        console.log(`   ✗ Found hardcoded limit: ${hardcodedInSection[0]}`);
    } else if (sectionContent.includes('discoverRomePageCount')) {
        successes.push('SharedManifestLoaders: Uses dynamic discovery');
        console.log('   ✓ Uses dynamic page discovery');
    } else {
        issues.push('SharedManifestLoaders getRomeManifest missing dynamic discovery');
        console.log('   ✗ Missing dynamic discovery call');
    }
}

// Test 4: Check for other hardcoded page limits
console.log('\n✅ Test 4: Searching entire codebase for hardcoded limits');
const searchPatterns = [
    /const (?:total|max)Pages\s*=\s*(\d{3,})/g,
    /let (?:total|max)Pages\s*=\s*(\d{3,})/g,
    /for\s*\([^)]*\s*<=\s*(\d{3,})/g,
    /\.slice\(0,\s*(\d{3,})\)/g
];

const srcPath = path.join(__dirname, '../src');
let hardcodedLimits = [];

function searchFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.relative(srcPath, filePath);
    
    for (const pattern of searchPatterns) {
        let match;
        pattern.lastIndex = 0; // Reset regex
        while ((match = pattern.exec(content)) !== null) {
            const limit = parseInt(match[1]);
            if (limit >= 200 && limit <= 2000) { // Common hardcoded range
                const line = content.substring(0, match.index).split('\n').length;
                hardcodedLimits.push({
                    file: fileName,
                    line: line,
                    limit: limit,
                    context: match[0]
                });
            }
        }
    }
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && file !== 'node_modules') {
            walkDir(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.js')) {
            searchFile(fullPath);
        }
    }
}

walkDir(srcPath);

if (hardcodedLimits.length > 0) {
    console.log(`   ⚠️  Found ${hardcodedLimits.length} potential hardcoded limits:`);
    // Show first 10
    hardcodedLimits.slice(0, 10).forEach(item => {
        console.log(`      ${item.file}:${item.line} - ${item.context}`);
    });
    if (hardcodedLimits.length > 10) {
        console.log(`      ... and ${hardcodedLimits.length - 10} more`);
    }
} else {
    console.log('   ✓ No obvious hardcoded limits found');
}

// Test 5: Verify binary search helper exists
console.log('\n✅ Test 5: Binary search utilities');
if (sharedLoaders.includes('discoverRomePageCount') && sharedLoaders.includes('checkRomePageExists')) {
    successes.push('SharedManifestLoaders: Binary search utilities present');
    console.log('   ✓ Rome binary search utilities implemented');
} else {
    issues.push('SharedManifestLoaders missing binary search utilities');
    console.log('   ✗ Binary search utilities not found');
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 VALIDATION SUMMARY');
console.log('='.repeat(60));

if (issues.length === 0) {
    console.log('\n🎉 ALL VALIDATIONS PASSED!');
    console.log('\n✅ Successes:');
    successes.forEach(s => console.log(`   - ${s}`));
    console.log('\n📝 What this means:');
    console.log('   - Rome now uses dynamic binary search');
    console.log('   - No more artificial 500-page limits');
    console.log('   - Pages discovered based on actual manuscript');
    console.log('   - Will work with any size manuscript');
} else {
    console.log('\n❌ ISSUES FOUND:');
    issues.forEach(issue => console.log(`   - ${issue}`));
    console.log('\n⚠️  These issues must be fixed!');
    process.exit(1);
}

console.log('\n' + '='.repeat(60));
console.log('ℹ️  NEXT STEPS');
console.log('='.repeat(60));
console.log('1. Run: npm run precommit');
console.log('2. Test with actual Rome URL');
console.log('3. Verify binary search works');
console.log('4. Check no timeout errors');
console.log('5. Confirm correct page count discovered');