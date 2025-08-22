#!/usr/bin/env bun

/**
 * Test Florence library detection to debug why it's showing as 'unknown'
 */

// Test URLs from the logs
const testUrls = [
    'https://cdm21059.contentdm.oclc.org/iiif/2/plutei:217707/full/4000,/0/default.jpg',
    'https://cdm21059.contentdm.oclc.org/iiif/2/plutei:217718/full/4000,/0/default.jpg',
    'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/217710/rec/2',
];

// Simulate the detection logic from EnhancedManuscriptDownloaderService
function detectLibrary(url: string): string | null {
    // Simplified version of the detection logic
    if (url.includes('cdm21059.contentdm.oclc.org/digital/collection/plutei')) return 'florence';
    
    // Check if it's a IIIF URL from Florence
    if (url.includes('cdm21059.contentdm.oclc.org')) {
        console.log(`⚠️  URL contains ContentDM domain but not the expected path pattern`);
        console.log(`   Expected: cdm21059.contentdm.oclc.org/digital/collection/plutei`);
        console.log(`   Actual: ${url}`);
        return null; // This would return null, causing 'unknown'
    }
    
    return null;
}

// More comprehensive detection (should be added)
function detectLibraryFixed(url: string): string | null {
    // Original path pattern
    if (url.includes('cdm21059.contentdm.oclc.org/digital/collection/plutei')) return 'florence';
    
    // IIIF URL pattern (missing from original!)
    if (url.includes('cdm21059.contentdm.oclc.org/iiif/2/plutei:')) return 'florence';
    
    // General ContentDM domain (fallback)
    if (url.includes('cdm21059.contentdm.oclc.org')) return 'florence';
    
    return null;
}

console.log('🔍 Testing Florence Library Detection...\n');

for (const url of testUrls) {
    console.log(`🌐 Testing URL: ${url.substring(0, 80)}...`);
    
    const detected = detectLibrary(url);
    const detectedFixed = detectLibraryFixed(url);
    
    console.log(`   Original detection: ${detected || 'null → "unknown"'}`);
    console.log(`   Fixed detection: ${detectedFixed || 'null'}`);
    
    if (!detected && detectedFixed) {
        console.log(`   🚨 FOUND THE BUG: Original logic misses IIIF URLs!`);
    }
    
    console.log('');
}

console.log('🎯 Analysis:');
console.log('❌ Current detection pattern: cdm21059.contentdm.oclc.org/digital/collection/plutei');
console.log('❌ Problem: IIIF URLs use pattern: cdm21059.contentdm.oclc.org/iiif/2/plutei:');
console.log('✅ Solution: Add IIIF URL pattern to detection logic');

console.log('\n🔧 Required Fix:');
console.log('File: EnhancedManuscriptDownloaderService.ts around line 1067');
console.log('Add: if (url.includes("cdm21059.contentdm.oclc.org/iiif/2/plutei:")) return "florence";');
console.log('OR: Change existing to: if (url.includes("cdm21059.contentdm.oclc.org")) return "florence";');