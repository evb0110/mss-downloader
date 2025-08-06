#!/usr/bin/env node

/**
 * ULTRA-VALIDATION: Issue #19 - Heidelberg University Library
 * Complete end-to-end validation to prove the issue is TRULY fixed
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
    console.log('');
    log('═'.repeat(70), 'cyan');
    log(`  ${title}`, 'bright');
    log('═'.repeat(70), 'cyan');
    console.log('');
}

async function downloadImage(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
    });
}

async function runUltraValidation() {
    logSection('🔥 ULTRA-VALIDATION: HEIDELBERG UNIVERSITY LIBRARY (Issue #19) 🔥');
    
    log('Issue History:', 'yellow');
    log('  • v1.4.85: First "fix" - Added Heidelberg support');
    log('  • v1.4.88: Second "fix" - Fixed UI integration');
    log('  • v1.4.90: Third "fix" - Fixed library list');
    log('  • User still reports: "библиотеки нет в списке поддерживаемых"');
    log('  • Translation: "library not in supported list"', 'red');
    
    const results = {
        detection: false,
        backend: false,
        manifest: false,
        downloads: false,
        ui_list: false,
        overall: false
    };
    
    // Test 1: Library Detection
    logSection('TEST 1: Library Detection');
    try {
        const { EnhancedManuscriptDownloaderService } = require('../../src/main/services/EnhancedManuscriptDownloaderService.ts');
        
        // Create minimal mock logger
        const mockLogger = {
            info: () => {},
            error: () => {},
            warn: () => {},
            debug: () => {}
        };
        
        const service = new EnhancedManuscriptDownloaderService(mockLogger);
        const testURL = 'https://digi.ub.uni-heidelberg.de/diglit/salVIII2';
        
        log(`Testing URL: ${testURL}`);
        const detectedLibrary = service.detectLibrary(testURL);
        
        if (detectedLibrary === 'heidelberg') {
            log('✅ Library correctly detected as "heidelberg"', 'green');
            results.detection = true;
        } else {
            log(`❌ Library detection FAILED! Detected as: "${detectedLibrary}"`, 'red');
        }
        
        // Check if Heidelberg is in supported libraries list
        const supportedLibs = service.getSupportedLibraries();
        const heidelbergEntry = supportedLibs.find(lib => 
            lib.name.toLowerCase().includes('heidelberg')
        );
        
        if (heidelbergEntry) {
            log('✅ Heidelberg IS in the supported libraries list', 'green');
            log(`   Name: ${heidelbergEntry.name}`);
            log(`   Example: ${heidelbergEntry.example}`);
            results.ui_list = true;
        } else {
            log('❌ Heidelberg NOT in supported libraries list!', 'red');
        }
        
    } catch (error) {
        log(`❌ Detection test failed: ${error.message}`, 'red');
    }
    
    // Test 2: Backend Manifest Loading
    logSection('TEST 2: Backend Manifest Loading');
    try {
        const loader = new SharedManifestLoaders();
        const testURL = 'https://digi.ub.uni-heidelberg.de/diglit/salVIII2';
        
        log('Loading manifest through SharedManifestLoaders...');
        const manifest = await loader.getHeidelbergManifest(testURL);
        
        if (manifest && manifest.images && manifest.images.length > 0) {
            log(`✅ Manifest loaded: ${manifest.images.length} pages found`, 'green');
            log(`   Title: ${manifest.displayName}`);
            log(`   First page: ${manifest.images[0].url.substring(0, 80)}...`);
            results.backend = true;
            results.manifest = true;
        } else {
            log('❌ Manifest loading failed or no images found', 'red');
        }
    } catch (error) {
        log(`❌ Backend test failed: ${error.message}`, 'red');
    }
    
    // Test 3: Image Download Validation
    logSection('TEST 3: Image Download Validation');
    try {
        const loader = new SharedManifestLoaders();
        const testURL = 'https://digi.ub.uni-heidelberg.de/diglit/salVIII2';
        const manifest = await loader.getHeidelbergManifest(testURL);
        
        if (manifest && manifest.images.length > 0) {
            log('Downloading test pages...');
            const testDir = '.devkit/ultra-priority/heidelberg-validation';
            if (!fs.existsSync(testDir)) {
                fs.mkdirSync(testDir, { recursive: true });
            }
            
            // Download 3 different pages
            const pagesToTest = [0, Math.floor(manifest.images.length / 2), manifest.images.length - 1];
            let allSuccess = true;
            
            for (const pageIndex of pagesToTest) {
                const page = manifest.images[pageIndex];
                const buffer = await downloadImage(page.url);
                const filename = path.join(testDir, `page-${pageIndex + 1}.jpg`);
                fs.writeFileSync(filename, buffer);
                
                const size = buffer.length;
                if (size > 100000) { // At least 100KB
                    log(`  ✅ Page ${pageIndex + 1}: ${(size / 1024 / 1024).toFixed(2)} MB`, 'green');
                } else {
                    log(`  ❌ Page ${pageIndex + 1}: Too small (${size} bytes)`, 'red');
                    allSuccess = false;
                }
            }
            
            results.downloads = allSuccess;
        }
    } catch (error) {
        log(`❌ Download test failed: ${error.message}`, 'red');
    }
    
    // Test 4: Full Integration Test
    logSection('TEST 4: Full Integration Check');
    
    // Check the actual code in the service
    const serviceFile = fs.readFileSync(
        path.join(__dirname, '../../src/main/services/EnhancedManuscriptDownloaderService.ts'),
        'utf8'
    );
    
    const hasHeidelbergDetection = serviceFile.includes('digi.ub.uni-heidelberg.de');
    const hasHeidelbergCase = serviceFile.includes("case 'heidelberg':");
    const hasHeidelbergInList = serviceFile.includes('Heidelberg University Library');
    
    log('Code Analysis:');
    log(`  ${hasHeidelbergDetection ? '✅' : '❌'} URL detection pattern exists`, hasHeidelbergDetection ? 'green' : 'red');
    log(`  ${hasHeidelbergCase ? '✅' : '❌'} Switch case for heidelberg exists`, hasHeidelbergCase ? 'green' : 'red');
    log(`  ${hasHeidelbergInList ? '✅' : '❌'} Entry in supported libraries list`, hasHeidelbergInList ? 'green' : 'red');
    
    // Final Summary
    logSection('📊 VALIDATION SUMMARY');
    
    const allPassed = Object.values(results).every(v => v === true);
    
    log('Test Results:', 'bright');
    log(`  Library Detection:     ${results.detection ? '✅ PASS' : '❌ FAIL'}`, results.detection ? 'green' : 'red');
    log(`  UI Libraries List:     ${results.ui_list ? '✅ PASS' : '❌ FAIL'}`, results.ui_list ? 'green' : 'red');
    log(`  Backend Loading:       ${results.backend ? '✅ PASS' : '❌ FAIL'}`, results.backend ? 'green' : 'red');
    log(`  Manifest Processing:   ${results.manifest ? '✅ PASS' : '❌ FAIL'}`, results.manifest ? 'green' : 'red');
    log(`  Image Downloads:       ${results.downloads ? '✅ PASS' : '❌ FAIL'}`, results.downloads ? 'green' : 'red');
    
    console.log('');
    if (allPassed) {
        log('🎉 ALL TESTS PASSED! HEIDELBERG IS FULLY FUNCTIONAL! 🎉', 'green');
        log('The issue is that the user is on v1.4.86 and needs to update!', 'yellow');
    } else {
        log('⚠️  SOME TESTS FAILED - ISSUE PERSISTS', 'red');
        log('The Heidelberg implementation still has problems!', 'red');
    }
    
    // Check current version
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
    console.log('');
    log(`Current version: v${packageJson.version}`, 'cyan');
    log(`User version: v1.4.86 (from logs)`, 'yellow');
    
    if (packageJson.version !== '1.4.86') {
        log('\n📌 SOLUTION: User needs to update to the latest version!', 'green');
    }
}

// Run the validation
runUltraValidation().catch(error => {
    log(`\n❌ ULTRA-VALIDATION FAILED: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
});