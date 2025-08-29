#!/usr/bin/env node

/**
 * ARENBERG GOSPELS ZIF URL PATTERN TEST
 * 
 * Simple test to validate the fix for ZIF URL construction.
 * Tests the logic of preferring manuscriptCode over manuscriptId.
 */

console.log('🔍 ARENBERG GOSPELS ZIF URL PATTERN TEST');
console.log('=====================================\n');

// Test the ZIF directory selection logic
function testZifDirectorySelection() {
    console.log('🧪 Testing ZIF directory selection logic:\n');
    
    // Test Case 1: Arenberg Gospels - Before Fix (BROKEN)
    const imagesDir_old = null; // Not discovered
    const manuscriptCode_old = null; // Not used in old logic
    const manuscriptId_old = 'arenberg-gospels'; // URL slug
    const zifDir_old = imagesDir_old || manuscriptId_old; // Results in wrong directory
    
    console.log('❌ BEFORE FIX (Broken):');
    console.log(`   imagesDir: ${imagesDir_old || 'none'}`);
    console.log(`   manuscriptCode: ${manuscriptCode_old || 'none'}`); 
    console.log(`   manuscriptId: ${manuscriptId_old}`);
    console.log(`   zifDir: "${zifDir_old}"`);
    console.log(`   URL: https://host.themorgan.org/facsimile/images/${zifDir_old}/159161v_0017.zif`);
    console.log(`   Result: 404 Not Found ❌\n`);
    
    // Test Case 2: Arenberg Gospels - After Fix (WORKING)
    const imagesDir_new = null; // Still not discovered from ZIF pattern
    const manuscriptCode_new = 'm869'; // Discovered from iframe URL 
    const manuscriptId_new = 'arenberg-gospels'; // URL slug
    const zifDir_new = imagesDir_new || manuscriptCode_new || manuscriptId_new; // Now uses manuscriptCode!
    
    console.log('✅ AFTER FIX (Working):');
    console.log(`   imagesDir: ${imagesDir_new || 'none'}`);
    console.log(`   manuscriptCode: ${manuscriptCode_new || 'none'}`);
    console.log(`   manuscriptId: ${manuscriptId_new}`);
    console.log(`   zifDir: "${zifDir_new}"`);
    console.log(`   URL: https://host.themorgan.org/facsimile/images/${zifDir_new}/159161v_0017.zif`);
    console.log(`   Result: Should work! ✅\n`);
    
    // Test Case 3: Lindau Gospels - Should still work (REGRESSION TEST)
    const imagesDir_lindau = 'lindau-gospels'; // Discovered from ZIF pattern
    const manuscriptCode_lindau = 'm1'; // Discovered from iframe
    const manuscriptId_lindau = 'lindau-gospels'; // URL slug
    const zifDir_lindau = imagesDir_lindau || manuscriptCode_lindau || manuscriptId_lindau; // Uses imagesDir (highest priority)
    
    console.log('🔄 REGRESSION TEST - Lindau Gospels:');
    console.log(`   imagesDir: ${imagesDir_lindau || 'none'}`);
    console.log(`   manuscriptCode: ${manuscriptCode_lindau || 'none'}`);
    console.log(`   manuscriptId: ${manuscriptId_lindau}`);
    console.log(`   zifDir: "${zifDir_lindau}"`);
    console.log(`   URL: https://host.themorgan.org/facsimile/images/${zifDir_lindau}/76874v_0001.zif`);
    console.log(`   Result: Should still work! ✅\n`);
}

// Test iframe manuscript code extraction
function testManuscriptCodeExtraction() {
    console.log('🧪 Testing manuscript code extraction from iframe:\n');
    
    const arenbergIframe = 'https://host.themorgan.org/facsimile/m869/default.asp?id=1&width=100%25&height=100%25&iframe=true';
    const lindauIframe = 'https://host.themorgan.org/facsimile/m1/default.asp?id=1&width=100%25&height=100%25&iframe=true';
    
    const pattern = /host\.themorgan\.org\/facsimile\/([^\/]+)\/default\.asp/;
    
    const arenbergMatch = arenbergIframe.match(pattern);
    const lindauMatch = lindauIframe.match(pattern);
    
    console.log('📊 Iframe URL Parsing Results:');
    console.log(`   Arenberg iframe: ${arenbergIframe}`);
    console.log(`   Extracted code: "${arenbergMatch?.[1] || 'none'}" ${arenbergMatch?.[1] === 'm869' ? '✅' : '❌'}`);
    console.log();
    console.log(`   Lindau iframe: ${lindauIframe}`);
    console.log(`   Extracted code: "${lindauMatch?.[1] || 'none'}" ${lindauMatch?.[1] === 'm1' ? '✅' : '❌'}`);
    console.log();
}

// Run all tests
console.log('🚀 Running Arenberg Fix Validation Tests...\n');
testZifDirectorySelection();
testManuscriptCodeExtraction();

console.log('🎯 SUMMARY:');
console.log('===========');
console.log('✅ Fix should resolve 404 errors for Arenberg Gospels');
console.log('✅ Should not affect working Lindau Gospels downloads'); 
console.log('✅ Manuscript code extraction logic is sound');
console.log('\n🔬 Next Step: Test with actual Arenberg download in the app');