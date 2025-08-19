#!/usr/bin/env bun

/**
 * Test e-codices (Swiss manuscripts) manifest loading
 * URL: https://www.e-codices.ch/en/sbe/0610/1
 */

// Mock the Electron environment completely
const mockElectronApp = {
    getPath: () => '/tmp',
    getVersion: () => '1.0.0'
};

const mockElectronIpcMain = {
    on: () => {},
    handle: () => {},
    removeAllListeners: () => {}
};

// Mock electron before any imports
const electronMock = {
    app: mockElectronApp,
    ipcMain: mockElectronIpcMain
};

// Mock the electron module
if (!global.require) {
    global.require = require;
}

// Mock electron module resolution
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request: string, parent: any, isMain: boolean) {
    if (request === 'electron') {
        return 'mocked-electron';
    }
    return originalResolveFilename(request, parent, isMain);
};

require.cache['mocked-electron'] = {
    exports: electronMock,
    id: 'mocked-electron',
    filename: 'mocked-electron',
    loaded: true,
    children: [],
    paths: []
};

async function testEcodices() {
    console.log('🧪 Testing e-codices (Swiss manuscripts) manifest loading...');
    
    try {
        // Import the service with Electron mocks
        const { EnhancedManuscriptDownloaderService } = await import('../../src/main/services/EnhancedManuscriptDownloaderService.ts');
        
        // Create service instance
        const service = new EnhancedManuscriptDownloaderService('/tmp', mockElectronApp as any);
        
        // Test URL from TODO
        const testUrl = 'https://www.e-codices.ch/en/sbe/0610/1';
        console.log(`📖 Testing URL: ${testUrl}`);
        
        // Test library detection
        const detectedLibrary = service.detectLibrary(testUrl);
        console.log(`🔍 Detected library: ${detectedLibrary}`);
        
        if (detectedLibrary !== 'unifr') {
            throw new Error(`❌ Library detection failed: expected 'unifr', got '${detectedLibrary}'`);
        }
        
        // Test manifest loading
        console.log('📥 Loading manifest...');
        const startTime = Date.now();
        
        const manifest = await service.loadManifest(testUrl);
        
        const duration = Date.now() - startTime;
        console.log(`✅ Manifest loaded successfully in ${duration}ms`);
        console.log(`📊 Result: ${manifest.totalPages} pages, library: ${manifest.library}`);
        console.log(`🏷️  Display name: ${manifest.displayName}`);
        
        // Validate manifest structure
        if (!manifest.pageLinks || manifest.pageLinks.length === 0) {
            throw new Error('❌ No page links found in manifest');
        }
        
        if (manifest.library !== 'unifr') {
            throw new Error(`❌ Wrong library in manifest: expected 'unifr', got '${manifest.library}'`);
        }
        
        // Test a few page URLs
        console.log('🖼️  Testing page URLs...');
        for (let i = 0; i < Math.min(3, manifest.pageLinks.length); i++) {
            const pageUrl = manifest.pageLinks[i];
            console.log(`   Page ${i + 1}: ${pageUrl.substring(0, 80)}...`);
            
            // Validate URL format
            if (!pageUrl.includes('e-codices.unifr.ch')) {
                console.log(`   ⚠️  Warning: Page URL doesn't contain e-codices.unifr.ch domain`);
            }
        }
        
        console.log('🎉 e-codices test PASSED!');
        return {
            success: true,
            pages: manifest.totalPages,
            library: manifest.library,
            displayName: manifest.displayName,
            duration: duration
        };
        
    } catch (error) {
        console.error('❌ e-codices test FAILED:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

// Run test
testEcodices().then(result => {
    if (result.success) {
        console.log(`\n✅ VALIDATION RESULT: e-codices working (${result.pages} pages, ${result.duration}ms)`);
        process.exit(0);
    } else {
        console.log(`\n❌ VALIDATION RESULT: e-codices BROKEN - ${result.error}`);
        process.exit(1);
    }
}).catch(error => {
    console.error('💥 Test script error:', error);
    process.exit(1);
});