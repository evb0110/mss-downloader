/**
 * UNSUPPORTED LIBRARY AUDIT - ULTRA-DEEP ANALYSIS
 * Systematic comparison of library detection vs registration vs routing
 * This reveals ALL mismatches causing "Unsupported library" errors
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 ULTRA-DEEP ANALYSIS: Unsupported Library Detection vs Registration Audit\n');

// Read source files
const enhancedServicePath = '/Users/evb/WebstormProjects/mss-downloader/src/main/services/EnhancedManuscriptDownloaderService.ts';
const sharedLoaderPath = '/Users/evb/WebstormProjects/mss-downloader/src/shared/SharedManifestLoaders.ts';

const enhancedService = fs.readFileSync(enhancedServicePath, 'utf8');
const sharedLoaders = fs.readFileSync(sharedLoaderPath, 'utf8');

// Extract detectLibrary mappings (URL patterns -> library IDs)
function extractDetectionMappings(serviceContent) {
    const detectionMappings = {};
    const lines = serviceContent.split('\n');
    
    for (const line of lines) {
        const match = line.match(/if \(url\.includes\(['"](.*?)['"].*?\)\) return ['"]([^'"]+)['"];/);
        if (match) {
            const [, urlPattern, libraryId] = match;
            detectionMappings[urlPattern] = libraryId;
        }
    }
    
    return detectionMappings;
}

// Extract switch case mappings (EnhancedManuscriptDownloaderService routing)
function extractEnhancedServiceSwitchCases(serviceContent) {
    const switchCases = new Set();
    const lines = serviceContent.split('\n');
    
    for (const line of lines) {
        const match = line.match(/case ['"]([^'"]+)['"]:/);
        if (match) {
            switchCases.add(match[1]);
        }
    }
    
    return Array.from(switchCases).sort();
}

// Extract SharedManifestLoaders switch cases
function extractSharedLoadersSwitchCases(loadersContent) {
    const switchCases = new Set();
    const lines = loadersContent.split('\n');
    
    for (const line of lines) {
        const match = line.match(/case ['"]([^'"]+)['"]:/);
        if (match) {
            switchCases.add(match[1]);
        }
    }
    
    return Array.from(switchCases).sort();
}

// Run analysis
const detectionMappings = extractDetectionMappings(enhancedService);
const enhancedServiceCases = extractEnhancedServiceSwitchCases(enhancedService);
const sharedLoadersCases = extractSharedLoadersSwitchCases(sharedLoaders);

console.log('📊 DETECTION MAPPINGS (URL Patterns → Library IDs):');
console.log('='.repeat(60));
Object.entries(detectionMappings).forEach(([pattern, id]) => {
    console.log(`${pattern.padEnd(40)} → ${id}`);
});

console.log(`\n🎯 ENHANCED SERVICE SWITCH CASES (${enhancedServiceCases.length} total):`);
console.log('='.repeat(60));
enhancedServiceCases.forEach((caseId, index) => {
    console.log(`${(index + 1).toString().padStart(2)}. ${caseId}`);
});

console.log(`\n📦 SHARED LOADERS SWITCH CASES (${sharedLoadersCases.length} total):`);
console.log('='.repeat(60));
sharedLoadersCases.forEach((caseId, index) => {
    console.log(`${(index + 1).toString().padStart(2)}. ${caseId}`);
});

// CRITICAL ANALYSIS: Find mismatches
console.log('\n🚨 CRITICAL MISMATCH ANALYSIS:');
console.log('='.repeat(60));

const detectedLibraryIds = Object.values(detectionMappings);
const allDetected = new Set(detectedLibraryIds);

// Libraries detected but missing from EnhancedService routing
const missingFromEnhanced = [];
allDetected.forEach(libId => {
    if (!enhancedServiceCases.includes(libId)) {
        missingFromEnhanced.push(libId);
    }
});

// Libraries in EnhancedService but missing from SharedLoaders
const missingFromShared = [];
enhancedServiceCases.forEach(libId => {
    if (!sharedLoadersCases.includes(libId)) {
        missingFromShared.push(libId);
    }
});

// Libraries in SharedLoaders but not detected
const undetectableLibraries = [];
sharedLoadersCases.forEach(libId => {
    if (!allDetected.has(libId)) {
        undetectableLibraries.push(libId);
    }
});

// KEY ROUTING MISMATCHES (The Rome problem)
const routingMismatches = [];
const enhancedLines = enhancedService.split('\n');
for (let i = 0; i < enhancedLines.length; i++) {
    const line = enhancedLines[i];
    const caseMatch = line.match(/case ['"]([^'"]+)['"]:/);
    if (caseMatch && i + 1 < enhancedLines.length) {
        const caseId = caseMatch[1];
        const nextLine = enhancedLines[i + 1];
        const adapterMatch = nextLine.match(/getManifestForLibrary\(['"]([^'"]+)['"].*\)/);
        if (adapterMatch) {
            const targetId = adapterMatch[1];
            if (caseId !== targetId) {
                routingMismatches.push({ detected: caseId, routed: targetId });
            }
        }
    }
}

console.log('❌ LIBRARIES DETECTED BUT MISSING FROM ENHANCED SERVICE ROUTING:');
if (missingFromEnhanced.length === 0) {
    console.log('   ✅ No missing libraries - all detected libraries have routing');
} else {
    missingFromEnhanced.forEach(lib => console.log(`   - ${lib} (CAUSES: "Unsupported library" error)`));
}

console.log('\n❌ LIBRARIES IN ENHANCED SERVICE BUT MISSING FROM SHARED LOADERS:');
if (missingFromShared.length === 0) {
    console.log('   ✅ No missing libraries - all routed libraries have loaders');
} else {
    missingFromShared.forEach(lib => console.log(`   - ${lib} (CAUSES: "Unsupported library" error in SharedManifestLoaders)`));
}

console.log('\n❌ LIBRARIES IN SHARED LOADERS BUT NOT DETECTABLE:');
if (undetectableLibraries.length === 0) {
    console.log('   ✅ No undetectable libraries - all loaders can be reached');
} else {
    undetectableLibraries.forEach(lib => console.log(`   - ${lib} (UNREACHABLE: No URL pattern can trigger this loader)`));
}

console.log('\n🔀 ROUTING MISMATCHES (Detected ID → Different Target):');
if (routingMismatches.length === 0) {
    console.log('   ✅ No routing mismatches - all cases route to matching targets');
} else {
    routingMismatches.forEach(({ detected, routed }) => {
        console.log(`   - "${detected}" routes to "${routed}" (The Rome problem type)`);
    });
}

// Check for the specific Rome issue mentioned in CLAUDE.md
console.log('\n🏛️ ROME ISSUE ANALYSIS (From CLAUDE.md):');
console.log('='.repeat(60));
const romeDetected = detectionMappings['digitale.bnc.roma.sbn.it'] === 'rome';
const romeInEnhanced = enhancedServiceCases.includes('rome');
const romeInShared = sharedLoadersCases.includes('rome');

// Check routing target for rome case
const romeCaseLine = enhancedService.split('\n').find(line => line.includes(`case 'rome':`));
const romeTargetMatch = enhancedService.match(/case 'rome':\s*manifest = await this\.sharedManifestAdapter\.getManifestForLibrary\(['"]([^'"]+)['"].*\)/);
const romeRoutesTo = romeTargetMatch ? romeTargetMatch[1] : 'NOT_FOUND';

console.log(`✅ Rome detection: ${romeDetected ? 'WORKS' : 'BROKEN'} (digitale.bnc.roma.sbn.it → rome)`);
console.log(`✅ Rome in Enhanced: ${romeInEnhanced ? 'EXISTS' : 'MISSING'} (case 'rome': exists)`);
console.log(`✅ Rome in Shared: ${romeInShared ? 'EXISTS' : 'MISSING'} (SharedManifestLoaders supports rome)`);
console.log(`🎯 Rome routing: case 'rome' → getManifestForLibrary('${romeRoutesTo}')`);

if (romeRoutesTo === 'rome') {
    console.log('   ✅ Rome routing is CORRECT - routes to same ID');
} else {
    console.log(`   ❌ Rome routing MISMATCH - should route to 'rome' but routes to '${romeRoutesTo}'`);
}

// Check for RomeLoader.ts existence
const romeLoaderPath = '/Users/evb/WebstormProjects/mss-downloader/src/main/services/library-loaders/RomeLoader.ts';
const romeLoaderExists = fs.existsSync(romeLoaderPath);
console.log(`📁 RomeLoader.ts: ${romeLoaderExists ? 'EXISTS' : 'MISSING'} (${romeLoaderExists ? 'but never called due to routing' : 'completely missing'})`);

console.log('\n📋 SUMMARY OF ISSUES CAUSING "UNSUPPORTED LIBRARY" ERRORS:');
console.log('='.repeat(60));
let issueCount = 0;

if (missingFromEnhanced.length > 0) {
    issueCount++;
    console.log(`${issueCount}. DETECTION → ROUTING GAP: ${missingFromEnhanced.length} libraries detected but not routed`);
}

if (missingFromShared.length > 0) {
    issueCount++;
    console.log(`${issueCount}. ROUTING → LOADER GAP: ${missingFromShared.length} libraries routed but no loader exists`);
}

if (routingMismatches.length > 0) {
    issueCount++;
    console.log(`${issueCount}. ROUTING MISMATCHES: ${routingMismatches.length} libraries route to wrong targets`);
}

if (issueCount === 0) {
    console.log('✅ NO SYSTEMATIC ISSUES FOUND - All libraries have complete detection → routing → loading flow');
} else {
    console.log(`\n❌ TOTAL ISSUES: ${issueCount} categories of problems causing "Unsupported library" errors`);
}

console.log('\n🔧 RECOMMENDED FIXES:');
console.log('='.repeat(60));
if (missingFromEnhanced.length > 0) {
    console.log('1. Add missing switch cases to EnhancedManuscriptDownloaderService.ts around line 2217');
    missingFromEnhanced.forEach(lib => {
        console.log(`   case '${lib}': manifest = await this.sharedManifestAdapter.getManifestForLibrary('${lib}', originalUrl); break;`);
    });
}

if (missingFromShared.length > 0) {
    console.log('2. Add missing loaders to SharedManifestLoaders.ts switch statement');
    missingFromShared.forEach(lib => {
        console.log(`   case '${lib}': return await this.get${lib.charAt(0).toUpperCase() + lib.slice(1)}Manifest(url);`);
    });
}

if (routingMismatches.length > 0) {
    console.log('3. Fix routing mismatches in EnhancedManuscriptDownloaderService.ts');
    routingMismatches.forEach(({ detected, routed }) => {
        console.log(`   Change: case '${detected}': getManifestForLibrary('${routed}') → getManifestForLibrary('${detected}')`);
    });
}