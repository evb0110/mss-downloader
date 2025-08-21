/**
 * ARCHITECTURAL FIX for "Unsupported library" errors
 * Fixes routing mismatches between detection → routing → loading
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 ARCHITECTURAL FIX: Unsupported Library Routing');
console.log('='.repeat(60));

// Read source files
const enhancedServicePath = '/Users/evb/WebstormProjects/mss-downloader/src/main/services/EnhancedManuscriptDownloaderService.ts';
const sharedLoaderPath = '/Users/evb/WebstormProjects/mss-downloader/src/shared/SharedManifestLoaders.ts';

let enhancedService = fs.readFileSync(enhancedServicePath, 'utf8');
let sharedLoaders = fs.readFileSync(sharedLoaderPath, 'utf8');

// Get available SharedManifestLoaders methods
const sharedMethods = new Set();
const methodMatches = sharedLoaders.match(/async get(\w+)Manifest\(/g);
if (methodMatches) {
    methodMatches.forEach(match => {
        const methodName = match.match(/get(\w+)Manifest/)[1].toLowerCase();
        sharedMethods.add(methodName);
    });
}

console.log('📦 Available SharedManifestLoaders methods:', Array.from(sharedMethods).sort());

// Get available individual loaders
const loadersDir = '/Users/evb/WebstormProjects/mss-downloader/src/main/services/library-loaders';
const individualLoaders = new Set();
if (fs.existsSync(loadersDir)) {
    const loaderFiles = fs.readdirSync(loadersDir);
    loaderFiles.forEach(file => {
        if (file.endsWith('Loader.ts')) {
            const loaderName = file.replace('Loader.ts', '').toLowerCase();
            individualLoaders.add(loaderName);
        }
    });
}

console.log('🔧 Available individual loaders:', Array.from(individualLoaders).sort());

// Analyze current routing and detect issues
const routingIssues = [];
const lines = enhancedService.split('\n');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const caseMatch = line.match(/case '([^']+)':/);
    
    if (caseMatch && i + 1 < lines.length) {
        const libraryId = caseMatch[1];
        const nextLine = lines[i + 1].trim();
        
        // Check if routed to sharedManifestAdapter
        const sharedAdapterMatch = nextLine.match(/sharedManifestAdapter\.getManifestForLibrary\('([^']+)'/);
        if (sharedAdapterMatch) {
            const targetId = sharedAdapterMatch[1];
            
            // Check if the target method exists in SharedManifestLoaders
            if (!sharedMethods.has(targetId.toLowerCase())) {
                // Check if there's an individual loader for this library
                const hasIndividualLoader = individualLoaders.has(libraryId.toLowerCase());
                
                routingIssues.push({
                    libraryId,
                    targetId,
                    routingType: 'sharedManifestAdapter',
                    issue: 'missing_shared_method',
                    hasIndividualLoader,
                    suggestedFix: hasIndividualLoader ? 'use_individual_loader' : 'create_shared_method'
                });
            }
        }
        
        // Check if routed to loadLibraryManifest
        const libraryManifestMatch = nextLine.match(/loadLibraryManifest\('([^']+)'/);
        if (libraryManifestMatch) {
            const targetId = libraryManifestMatch[1];
            
            // Check if individual loader exists
            if (!individualLoaders.has(targetId.toLowerCase())) {
                routingIssues.push({
                    libraryId,
                    targetId,
                    routingType: 'loadLibraryManifest',
                    issue: 'missing_individual_loader',
                    hasIndividualLoader: false,
                    suggestedFix: 'create_individual_loader'
                });
            }
        }
    }
}

console.log('\n🚨 ROUTING ISSUES DETECTED:');
console.log('='.repeat(60));

if (routingIssues.length === 0) {
    console.log('✅ No routing issues detected');
} else {
    routingIssues.forEach((issue, index) => {
        console.log(`${index + 1}. Library '${issue.libraryId}' → ${issue.routingType}('${issue.targetId}')`);
        console.log(`   Issue: ${issue.issue}`);
        console.log(`   Has individual loader: ${issue.hasIndividualLoader}`);
        console.log(`   Suggested fix: ${issue.suggestedFix}`);
        console.log('');
    });
}

// Group fixes by type
const fixesByType = routingIssues.reduce((acc, issue) => {
    if (!acc[issue.suggestedFix]) acc[issue.suggestedFix] = [];
    acc[issue.suggestedFix].push(issue);
    return acc;
}, {});

console.log('🔧 RECOMMENDED FIXES BY TYPE:');
console.log('='.repeat(60));

// Fix 1: Convert sharedManifestAdapter calls to loadLibraryManifest for libraries with individual loaders
if (fixesByType.use_individual_loader) {
    console.log('1. CONVERT TO INDIVIDUAL LOADERS:');
    fixesByType.use_individual_loader.forEach(issue => {
        console.log(`   - Change: case '${issue.libraryId}': sharedManifestAdapter → loadLibraryManifest('${issue.libraryId}')`);
        
        // Apply the fix
        const oldPattern = `case '${issue.libraryId}':\n                    manifest = await this.sharedManifestAdapter.getManifestForLibrary('${issue.targetId}', originalUrl);`;
        const newPattern = `case '${issue.libraryId}':\n                    manifest = await this.loadLibraryManifest('${issue.libraryId}', originalUrl);`;
        
        if (enhancedService.includes(oldPattern)) {
            enhancedService = enhancedService.replace(oldPattern, newPattern);
            console.log(`     ✅ Applied fix for ${issue.libraryId}`);
        } else {
            console.log(`     ❌ Pattern not found for ${issue.libraryId}`);
        }
    });
}

// Fix 2: Add missing methods to SharedManifestLoaders
if (fixesByType.create_shared_method) {
    console.log('\n2. ADD MISSING SHARED METHODS:');
    const missingMethods = fixesByType.create_shared_method.map(issue => issue.targetId);
    console.log(`   Missing methods: ${missingMethods.join(', ')}`);
    console.log('   Note: These need to be implemented manually based on library requirements');
}

// Fix 3: Create missing individual loaders
if (fixesByType.create_individual_loader) {
    console.log('\n3. CREATE MISSING INDIVIDUAL LOADERS:');
    fixesByType.create_individual_loader.forEach(issue => {
        console.log(`   - Create: ${issue.targetId}Loader.ts`);
    });
}

// Apply the primary fixes (routing changes)
console.log('\n📝 APPLYING ROUTING FIXES...');
fs.writeFileSync(enhancedServicePath, enhancedService, 'utf8');
console.log('✅ Routing fixes applied to EnhancedManuscriptDownloaderService.ts');

// Re-run the audit to see improvement
console.log('\n🔍 RUNNING POST-FIX AUDIT...');
console.log('='.repeat(60));

// Re-run the original audit script
const auditScript = '/Users/evb/WebstormProjects/mss-downloader/.devkit/analysis/unsupported-library-audit.cjs';
try {
    require(auditScript);
} catch (error) {
    console.log('❌ Could not re-run audit:', error.message);
}

console.log('\n✅ ARCHITECTURAL FIX COMPLETE');
console.log('Libraries with individual loaders should now work correctly');
console.log('Remaining issues require either:');
console.log('  1. Creating missing SharedManifestLoaders methods');
console.log('  2. Creating missing individual loader files');
console.log('  3. Updating library detection patterns');