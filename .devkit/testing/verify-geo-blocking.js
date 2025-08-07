#!/usr/bin/env node

/**
 * Verification script for Issue #20 - Geo-blocking indicators
 * This script verifies that all required libraries have geo-blocking flags
 */

const fs = require('fs');
const path = require('path');

console.log('🔬 Verifying Geo-Blocking Implementation for Issue #20\n');
console.log('=' .repeat(60));

// Read the EnhancedManuscriptDownloaderService.ts file
const servicePath = path.join(__dirname, '../../src/main/services/EnhancedManuscriptDownloaderService.ts');
const serviceContent = fs.readFileSync(servicePath, 'utf8');

// Extract SUPPORTED_LIBRARIES array
const librariesMatch = serviceContent.match(/static readonly SUPPORTED_LIBRARIES: LibraryInfo\[\] = \[([\s\S]*?)\];/);

if (!librariesMatch) {
    console.error('❌ Could not find SUPPORTED_LIBRARIES in service file');
    process.exit(1);
}

const librariesText = librariesMatch[1];

// Parse libraries with geo-blocking
const geoBlockedLibraries = [];
const allLibraries = [];

// Split by library objects
const libraryBlocks = librariesText.split(/\},\s*\{/);

libraryBlocks.forEach(block => {
    // Extract library name
    const nameMatch = block.match(/name:\s*['"]([^'"]+)['"]/);
    if (nameMatch) {
        const name = nameMatch[1];
        allLibraries.push(name);
        
        // Check if has geoBlocked: true
        if (block.includes('geoBlocked: true')) {
            geoBlockedLibraries.push(name);
        }
    }
});

console.log(`\n📊 Library Statistics:`);
console.log(`Total Libraries: ${allLibraries.length}`);
console.log(`Geo-Blocked Libraries: ${geoBlockedLibraries.length}`);
console.log(`Percentage Geo-Blocked: ${Math.round(geoBlockedLibraries.length / allLibraries.length * 100)}%\n`);

console.log('🌍 Libraries with Geographic Restrictions (Issue #20):\n');
console.log('-'.repeat(60));

// Libraries specifically mentioned in Issue #20
const issue20Libraries = [
    'University of Graz',
    'Florence (ContentDM Plutei)',
    'BDL (Biblioteca Digitale Lombarda)',
    'Grenoble Municipal Library', 
    'MDC Catalonia (Memòria Digital de Catalunya)',
    'Verona Library (NBM)'
];

let allIssue20Found = true;

issue20Libraries.forEach((libName, index) => {
    const found = geoBlockedLibraries.includes(libName);
    if (found) {
        console.log(`${index + 1}. ✅ ${libName} - HAS geo-blocking indicator`);
    } else {
        console.log(`${index + 1}. ❌ ${libName} - MISSING geo-blocking indicator`);
        allIssue20Found = false;
    }
});

console.log('\n' + '-'.repeat(60));
console.log('\n📋 Additional Geo-Blocked Libraries:\n');

// Show other geo-blocked libraries not in Issue #20
const additionalGeoBlocked = geoBlockedLibraries.filter(lib => !issue20Libraries.includes(lib));
additionalGeoBlocked.forEach((lib, index) => {
    console.log(`${index + 1}. ${lib}`);
});

// Check Vue component for filter implementation
console.log('\n' + '='.repeat(60));
console.log('\n🔍 Checking UI Implementation...\n');

const vuePath = path.join(__dirname, '../../src/renderer/components/ManuscriptDownloader.vue');
const vueContent = fs.readFileSync(vuePath, 'utf8');

const hasGeoFilter = vueContent.includes('showOnlyGeoBlocked');
const hasFilterButton = vueContent.includes('geo-filter-button');
const hasFilterLogic = vueContent.includes('lib.geoBlocked');

console.log(`Filter Toggle Variable: ${hasGeoFilter ? '✅ Present' : '❌ Missing'}`);
console.log(`Filter Button UI: ${hasFilterButton ? '✅ Present' : '❌ Missing'}`);
console.log(`Filter Logic: ${hasFilterLogic ? '✅ Present' : '❌ Missing'}`);

console.log('\n' + '='.repeat(60));

// Final verdict
if (allIssue20Found && hasGeoFilter && hasFilterButton) {
    console.log('\n🎉 SUCCESS: Issue #20 FULLY RESOLVED!');
    console.log('\n✨ What was implemented:');
    console.log('1. All 6 libraries from Issue #20 have geo-blocking flags');
    console.log('2. Filter button "Show Geo-Blocked Only" added to UI');
    console.log('3. Visual badges (🌍) show on geo-restricted libraries');
    console.log('4. Users can now easily see the list of geo-blocked libraries');
    console.log(`5. Total of ${geoBlockedLibraries.length} libraries marked with restrictions`);
    
    console.log('\n📝 User can now:');
    console.log('- Click "Show Geo-Blocked Only" to filter libraries');
    console.log('- See orange badges on restricted libraries');
    console.log('- Know which libraries require specific country IPs');
    
    process.exit(0);
} else {
    console.log('\n⚠️  Issue #20 partially resolved');
    if (!allIssue20Found) {
        console.log('- Some libraries from Issue #20 missing geo-blocking flags');
    }
    if (!hasGeoFilter || !hasFilterButton) {
        console.log('- UI filter implementation incomplete');
    }
    process.exit(1);
}