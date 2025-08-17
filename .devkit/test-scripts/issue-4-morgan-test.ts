#!/usr/bin/env bun

/**
 * CRITICAL BUG REPRODUCTION - Issue #4: Morgan Library imagesByPriority ReferenceError
 * 
 * User Report: "Error invoking remote method 'parse-manuscript-url': ReferenceError: imagesByPriority is not defined"
 * URL: https://www.themorgan.org/collection/lindau-gospels/thumbs
 */

import { SharedManifestLoaders } from '../../src/shared/SharedManifestLoaders';

const TEST_URL = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';

async function reproduceIssue4() {
    console.log('🔍 REPRODUCING ISSUE #4: Morgan Library imagesByPriority ReferenceError');
    console.log(`URL: ${TEST_URL}`);
    
    try {
        const loaders = new SharedManifestLoaders();
        
        console.log('\n⚡ Testing Morgan Library loader...');
        const result = await loaders.getMorganManifest(TEST_URL);
        
        console.log('✅ SUCCESS: No ReferenceError occurred');
        console.log('📊 Result:', {
            type: Array.isArray(result) ? 'Array' : 'Object',
            imagesCount: Array.isArray(result) ? result.length : result.images.length,
            hasDisplayName: !Array.isArray(result) && 'displayName' in result
        });
        
        return { success: true, result };
        
    } catch (error) {
        console.log('❌ ERROR REPRODUCED:');
        console.error(error);
        
        if (error instanceof ReferenceError && error.message.includes('imagesByPriority')) {
            console.log('\n🎯 CONFIRMED: This is the exact error from Issue #4!');
            console.log('🔍 Error details:');
            console.log('  - Type:', error.constructor.name);
            console.log('  - Message:', error.message);
            console.log('  - Stack trace:');
            console.log(error.stack);
            
            return { success: false, error: error.message, isTargetError: true };
        }
        
        return { success: false, error: error instanceof Error ? error.message : String(error), isTargetError: false };
    }
}

// Test various execution contexts to identify the scope issue
async function testExecutionContexts() {
    console.log('\n🧪 TESTING EXECUTION CONTEXTS:');
    
    // Test 1: Direct method call
    console.log('\n1️⃣ Testing direct method call...');
    await reproduceIssue4();
    
    // Test 2: Multiple concurrent calls (potential race condition)
    console.log('\n2️⃣ Testing concurrent calls...');
    try {
        const loaders = new SharedManifestLoaders();
        const promises = Array(3).fill(0).map(() => loaders.getMorganManifest(TEST_URL));
        await Promise.all(promises);
        console.log('✅ Concurrent calls succeeded');
    } catch (error) {
        console.log('❌ Concurrent calls failed:', error instanceof Error ? error.message : String(error));
    }
    
    // Test 3: Different URLs that might trigger different code paths
    console.log('\n3️⃣ Testing different Morgan URLs...');
    const testUrls = [
        'https://www.themorgan.org/collection/lindau-gospels/thumbs',
        'https://host.themorgan.org/facsimile/m1/default.asp?id=1',
    ];
    
    for (const url of testUrls) {
        try {
            const loaders = new SharedManifestLoaders();
            console.log(`Testing URL: ${url}`);
            await loaders.getMorganManifest(url);
            console.log('✅ Success');
        } catch (error) {
            console.log('❌ Failed:', error instanceof Error ? error.message : String(error));
        }
    }
}

async function analyzeCodeStructure() {
    console.log('\n🔍 ANALYZING CODE STRUCTURE:');
    
    // Read the SharedManifestLoaders source to analyze the imagesByPriority usage
    const fs = require('fs');
    const sourceCode = fs.readFileSync('./src/shared/SharedManifestLoaders.ts', 'utf8');
    
    // Find all imagesByPriority references
    const references = [];
    const lines = sourceCode.split('\n');
    lines.forEach((line, index) => {
        if (line.includes('imagesByPriority')) {
            references.push({
                line: index + 1,
                content: line.trim(),
                isDeclaration: line.includes('const imagesByPriority') || line.includes('let imagesByPriority'),
                isUsage: !line.includes('const imagesByPriority') && !line.includes('let imagesByPriority')
            });
        }
    });
    
    console.log(`📍 Found ${references.length} references to imagesByPriority:`);
    references.forEach(ref => {
        console.log(`  Line ${ref.line}: ${ref.isDeclaration ? '🏗️ DECLARATION' : '🔧 USAGE'} - ${ref.content}`);
    });
    
    // Analyze for potential scope issues
    const declarations = references.filter(r => r.isDeclaration);
    const usages = references.filter(r => r.isUsage);
    
    console.log(`\n📊 Analysis:`);
    console.log(`  - Declarations: ${declarations.length}`);
    console.log(`  - Usages: ${usages.length}`);
    
    if (declarations.length !== 1) {
        console.log('⚠️ WARNING: Expected exactly 1 declaration, found', declarations.length);
    }
    
    // Check if any usage is outside the expected method scope
    const getMorganManifestMethod = sourceCode.match(/async getMorganManifest[\s\S]*?(?=async \w+|\}$)/);
    if (getMorganManifestMethod) {
        const methodText = getMorganManifestMethod[0];
        const methodUsages = usages.filter(ref => methodText.includes(ref.content));
        
        if (methodUsages.length !== usages.length) {
            console.log('⚠️ WARNING: Some usages may be outside getMorganManifest method scope');
            console.log(`  - Usages in method: ${methodUsages.length}`);
            console.log(`  - Total usages: ${usages.length}`);
        }
    }
}

// Main execution
async function main() {
    console.log('🚀 STARTING ISSUE #4 DEEP ROOT CAUSE ANALYSIS\n');
    
    await reproduceIssue4();
    await testExecutionContexts();
    await analyzeCodeStructure();
    
    console.log('\n📋 ANALYSIS COMPLETE');
    console.log('📄 Check the output above for:');
    console.log('  1. Whether the ReferenceError was reproduced');
    console.log('  2. Any patterns in execution contexts');
    console.log('  3. Code structure analysis results');
}

main().catch(console.error);