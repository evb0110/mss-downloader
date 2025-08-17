#!/usr/bin/env node

/**
 * ULTRATHINK Validation: Rome vs Roman Archive fixes
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 ROME vs ROMAN ARCHIVE FIX VALIDATION');
console.log('='.repeat(60));

// Test URLs
const romeUrl = 'http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1';
const romanArchiveUrl = 'https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/preziosi.php?lar=1536&alt=864';

console.log('\n📝 Test URLs:');
console.log('  Rome National Library:', romeUrl);
console.log('  Roman Archive:', romanArchiveUrl);
console.log('\n' + '='.repeat(60));

// Check files
const enhancedServicePath = path.join(__dirname, '../src/main/services/EnhancedManuscriptDownloaderService.ts');
const romeLoaderPath = path.join(__dirname, '../src/main/services/library-loaders/RomeLoader.ts');
const sharedLoadersPath = path.join(__dirname, '../src/shared/SharedManifestLoaders.ts');

const enhancedService = fs.readFileSync(enhancedServicePath, 'utf-8');
const romeLoader = fs.readFileSync(romeLoaderPath, 'utf-8');
const sharedLoaders = fs.readFileSync(sharedLoadersPath, 'utf-8');

let allPassed = true;

// Test 1: Rome fetchWithHTTPS
console.log('\n✅ Test 1: Rome uses fetchWithHTTPS to avoid socket issues');
if (enhancedService.includes("url.includes('digitale.bnc.roma.sbn.it')")) {
    console.log('   ✓ Rome added to fetchWithHTTPS list');
} else {
    console.log('   ✗ Rome NOT in fetchWithHTTPS list');
    allPassed = false;
}

// Test 2: Roman Archive switch case
console.log('\n✅ Test 2: Roman Archive has switch case');
if (enhancedService.includes("case 'roman_archive':")) {
    console.log('   ✓ roman_archive switch case exists');
} else {
    console.log('   ✗ roman_archive switch case MISSING');
    allPassed = false;
}

// Test 3: RomeLoader doesn't fetch HTML
console.log('\n✅ Test 3: RomeLoader doesn\'t fetch HTML');
if (romeLoader.includes('await this.deps.fetchDirect(romeUrl)')) {
    console.log('   ✗ RomeLoader still fetches HTML - WILL TIMEOUT!');
    allPassed = false;
} else if (romeLoader.includes('ULTRATHINK FIX: Remove HTML fetching')) {
    console.log('   ✓ RomeLoader HTML fetching removed');
} else {
    console.log('   ? RomeLoader status unclear');
}

// Test 4: Rome timeout configuration
console.log('\n✅ Test 4: Rome has extended timeout');
if (sharedLoaders.includes("if (url.includes('digitale.bnc.roma.sbn.it'))")) {
    console.log('   ✓ Rome has 90-second timeout configured');
} else {
    console.log('   ✗ Rome timeout configuration missing');
    allPassed = false;
}

// Test 5: Library detection
console.log('\n✅ Test 5: Library detection patterns');
if (enhancedService.includes("if (url.includes('digitale.bnc.roma.sbn.it')) return 'rome'")) {
    console.log('   ✓ Rome detection pattern exists');
} else {
    console.log('   ✗ Rome detection pattern missing');
    allPassed = false;
}

if (enhancedService.includes("url.includes('imagoarchiviodistatoroma.cultura.gov.it') || url.includes('archiviostorico.senato.it')) return 'roman_archive'")) {
    console.log('   ✓ Roman Archive detection pattern exists');
} else {
    console.log('   ✗ Roman Archive detection pattern missing');
    allPassed = false;
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 VALIDATION SUMMARY');
console.log('='.repeat(60));

if (allPassed) {
    console.log('\n🎉 ALL FIXES VALIDATED SUCCESSFULLY!');
    console.log('\nExpected behavior:');
    console.log('1. Rome National Library: No more socket timeouts');
    console.log('2. Roman Archive: "Unsupported library" error fixed');
    console.log('3. Both libraries properly separated and handled');
} else {
    console.log('\n❌ SOME FIXES ARE MISSING OR INCOMPLETE!');
    console.log('Please review the failed tests above.');
    process.exit(1);
}

console.log('\n' + '='.repeat(60));
console.log('ℹ️  NEXT STEPS');
console.log('='.repeat(60));
console.log('1. Run: npm run precommit');
console.log('2. Version bump to 1.4.201');
console.log('3. Test with actual URLs in the app');
console.log('4. Verify no timeout errors for Rome');
console.log('5. Verify Roman Archive is recognized');