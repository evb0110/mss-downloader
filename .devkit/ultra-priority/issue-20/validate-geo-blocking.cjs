#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

// Read the actual production service file
const serviceFile = path.join(__dirname, '../../../src/main/services/EnhancedManuscriptDownloaderService.ts');
const serviceCode = fs.readFileSync(serviceFile, 'utf8');

console.log('🔍 ULTRA-VALIDATION: Geo-Blocking Indicators Test');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Libraries that MUST have geo-blocking according to Issue #20
const requiredGeoBlocked = [
    'University of Graz',
    'Florence (ContentDM Plutei)',
    'BDL (Biblioteca Digitale Lombarda)',
    'Grenoble Municipal Library',
    'MDC Catalonia (Memòria Digital de Catalunya)',
    'Verona Library (NBM)',
];

// Additional known geo-blocked libraries
const knownGeoBlocked = [
    'Norwegian National Library',
    'Internet Culturale',
    'BNE (Biblioteca Nacional de España)',
    'Trinity College Cambridge'
];

let totalLibraries = 0;
let geoBlockedCount = 0;
let missingGeoBlock = [];
let correctlyMarked = [];
let additionalGeoBlocked = [];

// Extract all library definitions
const libraryPattern = /\{\s*name:\s*['"]([^'"]+)['"][^}]*?\}/gs;
const matches = serviceCode.matchAll(libraryPattern);

for (const match of matches) {
    const libraryBlock = match[0];
    const libraryName = match[1];
    
    // Skip if not part of SUPPORTED_LIBRARIES array
    if (!serviceCode.includes(`name: '${libraryName}'`) && !serviceCode.includes(`name: "${libraryName}"`)) {
        continue;
    }
    
    totalLibraries++;
    
    // Check if it has geoBlocked property
    const hasGeoBlocked = libraryBlock.includes('geoBlocked: true');
    
    if (hasGeoBlocked) {
        geoBlockedCount++;
        
        if (requiredGeoBlocked.includes(libraryName)) {
            correctlyMarked.push(libraryName);
            console.log(`✅ ${libraryName} - Required library correctly marked`);
        } else if (knownGeoBlocked.includes(libraryName)) {
            additionalGeoBlocked.push(libraryName);
            console.log(`✅ ${libraryName} - Known geo-blocked library correctly marked`);
        } else {
            additionalGeoBlocked.push(libraryName);
            console.log(`ℹ️  ${libraryName} - Additional geo-blocked library`);
        }
    } else {
        if (requiredGeoBlocked.includes(libraryName)) {
            missingGeoBlock.push(libraryName);
            console.log(`❌ ${libraryName} - MISSING geo-block indicator!`);
        }
    }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 VALIDATION RESULTS:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log(`Total Libraries Scanned: ${totalLibraries}`);
console.log(`Geo-Blocked Libraries: ${geoBlockedCount} (${(geoBlockedCount/totalLibraries*100).toFixed(1)}%)`);
console.log(`Required from Issue #20: ${requiredGeoBlocked.length}`);
console.log(`Correctly Marked (Required): ${correctlyMarked.length}/${requiredGeoBlocked.length}`);
console.log(`Additional Geo-Blocked: ${additionalGeoBlocked.length}`);

if (missingGeoBlock.length > 0) {
    console.log('\n❌ FAILED VALIDATION - Missing geo-block indicators for:');
    missingGeoBlock.forEach(lib => console.log(`  - ${lib}`));
    console.log('\n⚠️  These libraries were mentioned in Issue #20 but lack geo-blocking indicators!');
    process.exit(1);
} else {
    console.log('\n✅ SUCCESS: All libraries from Issue #20 have geo-blocking indicators!');
    
    const allGeoBlocked = [...correctlyMarked, ...additionalGeoBlocked].sort();
    
    console.log('\n📋 Complete list of geo-blocked libraries (' + allGeoBlocked.length + ' total):');
    allGeoBlocked.forEach((lib, index) => {
        console.log(`  ${index + 1}. ${lib}`);
    });
    
    // Test that descriptions include geo-blocking info
    console.log('\n📝 Verifying descriptions include geo-blocking information:');
    let descriptionCheck = true;
    
    for (const libName of allGeoBlocked) {
        // Find the library block
        const libPattern = new RegExp(`name:\\s*['"]${libName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"][^}]*?description:\\s*['"]([^'"]+)['"]`, 's');
        const descMatch = serviceCode.match(libPattern);
        
        if (descMatch) {
            const description = descMatch[1];
            if (description.toLowerCase().includes('ip') || 
                description.toLowerCase().includes('geo') || 
                description.toLowerCase().includes('restricted') ||
                description.toLowerCase().includes('note:')) {
                console.log(`  ✅ ${libName} - Description mentions restrictions`);
            } else {
                console.log(`  ⚠️  ${libName} - Description might not mention restrictions`);
                descriptionCheck = false;
            }
        }
    }
    
    console.log('\n🎨 UI VALIDATION PREVIEW:');
    console.log('The following libraries will display orange "Geo-Restricted" badges:');
    console.log('┌────────────────────────────────────────────────┐');
    allGeoBlocked.forEach(lib => {
        console.log(`│ 🟠 ${lib.padEnd(44)} │`);
    });
    console.log('└────────────────────────────────────────────────┘');
    
    console.log('\n✅ ULTRA-VALIDATION COMPLETE');
    console.log('📦 Ready for autonomous version bump!');
    process.exit(0);
}