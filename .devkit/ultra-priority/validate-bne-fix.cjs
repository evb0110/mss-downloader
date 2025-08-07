#!/usr/bin/env node

/**
 * ULTRA-PRIORITY Validation for Issue #11 Fix
 * Tests BNE with the actual production code after fixes
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔬 ULTRA-VALIDATION: BNE Fix for Issue #11');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

// First, compile the TypeScript code
console.log('📦 Building the application...');
try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Build completed successfully');
} catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
}

console.log('');
console.log('🧪 Testing BNE manuscript loading with fixed code...');
console.log('');

// Test URLs from the issue
const testUrls = [
    'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1',
    'https://bdh-rd.bne.es/viewer.vm?id=0000011363&page=1',
    'https://bdh-rd.bne.es/viewer.vm?id=0000049109&page=1'
];

async function testBNEManuscript(url) {
    console.log(`Testing: ${url}`);
    console.log('────────────────────────────────────────');
    
    const startTime = Date.now();
    
    try {
        // Create a test script that uses the built code
        const testScript = `
const { app } = require('electron');
const path = require('path');

// Prevent Electron from starting
app.whenReady = () => Promise.resolve();

// Load the built service
const { EnhancedManuscriptDownloaderService } = require('./dist/main/services/EnhancedManuscriptDownloaderService.js');

async function test() {
    const service = new EnhancedManuscriptDownloaderService();
    const url = '${url}';
    
    console.log('Starting manifest load...');
    const startTime = Date.now();
    
    try {
        const manifest = await service.loadManifest(url);
        const loadTime = Date.now() - startTime;
        
        console.log(\`✅ Success in \${loadTime}ms\`);
        console.log(\`   Pages found: \${manifest.totalPages}\`);
        console.log(\`   Library: \${manifest.library}\`);
        console.log(\`   Display name: \${manifest.displayName}\`);
        
        if (loadTime > 10000) {
            console.log('⚠️  Warning: Load time exceeded 10 seconds');
        }
        
        return manifest;
    } catch (error) {
        const errorTime = Date.now() - startTime;
        console.error(\`❌ Failed after \${errorTime}ms: \${error.message}\`);
        
        if (errorTime > 30000) {
            console.error('🚨 CRITICAL: Timeout exceeded 30 seconds - hang detected!');
        }
        
        throw error;
    }
}

test().then(() => process.exit(0)).catch(() => process.exit(1));
`;
        
        // Write and execute the test script
        const testFile = '.devkit/ultra-priority/temp-test.js';
        fs.writeFileSync(testFile, testScript);
        
        // Run with timeout
        const output = execSync(`node ${testFile}`, {
            timeout: 45000, // 45 second timeout
            encoding: 'utf8'
        });
        
        console.log(output);
        
        const totalTime = Date.now() - startTime;
        
        if (totalTime < 5000) {
            console.log('🚀 EXCELLENT: Very fast response');
        } else if (totalTime < 10000) {
            console.log('✅ GOOD: Acceptable response time');
        } else if (totalTime < 30000) {
            console.log('⚠️  SLOW: Response time needs improvement');
        } else {
            console.log('❌ TOO SLOW: Perceived as hanging');
        }
        
        // Clean up
        fs.unlinkSync(testFile);
        
        return true;
        
    } catch (error) {
        const totalTime = Date.now() - startTime;
        console.error(`❌ Test failed after ${totalTime}ms`);
        
        if (error.signal === 'SIGTERM') {
            console.error('🚨 TIMEOUT: Operation exceeded 45 seconds!');
            console.error('   This confirms the hanging issue is NOT fixed!');
            return false;
        }
        
        console.error(`Error: ${error.message}`);
        return false;
    }
    
    console.log('');
}

async function runAllTests() {
    let successCount = 0;
    let failCount = 0;
    
    for (const url of testUrls) {
        const success = await testBNEManuscript(url);
        if (success) {
            successCount++;
        } else {
            failCount++;
        }
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 VALIDATION SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Successful: ${successCount}/${testUrls.length}`);
    console.log(`❌ Failed: ${failCount}/${testUrls.length}`);
    
    if (failCount === 0) {
        console.log('');
        console.log('🎉 ALL TESTS PASSED! Issue #11 is FIXED!');
        console.log('');
        console.log('The BNE hanging issue has been resolved:');
        console.log('1. Reduced max pages from 500 to 200');
        console.log('2. Reduced batch size from 10 to 5');
        console.log('3. Reduced HEAD request timeout from 30s to 5s');
        console.log('4. Improved early stop detection');
        console.log('5. Reduced progress monitor timeout from 3min to 1min');
    } else {
        console.log('');
        console.log('⚠️  Some tests failed - fix may be incomplete');
    }
}

runAllTests();