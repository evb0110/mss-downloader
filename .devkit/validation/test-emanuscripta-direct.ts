#!/usr/bin/env bun

/**
 * Direct test of EManuscriptaLoader 
 */

async function testEManuscriptaLoaderDirect() {
    console.log('🧪 Testing EManuscriptaLoader directly...');
    
    try {
        // Import the loader directly
        const { EManuscriptaLoader } = await import('../../src/main/services/library-loaders/EManuscriptaLoader.ts');
        
        // Create mock dependencies
        const mockDeps = {
            fetchDirect: async (url: string, options?: any) => {
                console.log(`🌐 Fetching: ${url}`);
                const response = await fetch(url, options);
                return response;
            },
            downloadLogger: {
                log: () => {},
                logDownloadStart: () => {},
                logDownloadProgress: () => {},
                logDownloadComplete: () => {},
                logDownloadError: () => {},
                logManifestLoad: () => {},
                logFileSaved: () => {}
            }
        };
        
        // Create loader instance
        const loader = new EManuscriptaLoader(mockDeps);
        
        // Test URL from TODO
        const testUrl = 'https://www.e-manuscripta.ch/zuzcmi/content/zoom/3229497';
        console.log(`📖 Testing URL: ${testUrl}`);
        
        // Test manifest loading
        console.log('📥 Loading manifest...');
        const startTime = Date.now();
        
        const manifest = await loader.loadManifest(testUrl);
        
        const duration = Date.now() - startTime;
        console.log(`✅ Manifest loaded successfully in ${duration}ms`);
        console.log(`📊 Result: ${manifest.totalPages} pages, library: ${manifest.library}`);
        console.log(`🏷️  Display name: ${manifest.displayName}`);
        
        // Validate manifest structure
        if (!manifest.pageLinks || manifest.pageLinks.length === 0) {
            throw new Error('❌ No page links found in manifest');
        }
        
        // Test first few page URLs
        console.log('🖼️  Sample page URLs:');
        for (let i = 0; i < Math.min(3, manifest.pageLinks.length); i++) {
            const pageUrl = manifest.pageLinks[i];
            console.log(`   Page ${i + 1}: ${pageUrl}`);
        }
        
        console.log('🎉 EManuscriptaLoader test PASSED!');
        return {
            success: true,
            pages: manifest.totalPages,
            library: manifest.library,
            displayName: manifest.displayName,
            duration: duration
        };
        
    } catch (error) {
        console.error('❌ EManuscriptaLoader test FAILED:', error.message);
        console.error('Stack:', error.stack);
        return {
            success: false,
            error: error.message
        };
    }
}

// Run test
testEManuscriptaLoaderDirect().then(result => {
    if (result.success) {
        console.log(`\n✅ VALIDATION RESULT: e-manuscripta working (${result.pages} pages, ${result.duration}ms)`);
        process.exit(0);
    } else {
        console.log(`\n❌ VALIDATION RESULT: e-manuscripta BROKEN - ${result.error}`);
        process.exit(1);
    }
}).catch(error => {
    console.error('💥 Test script error:', error);
    process.exit(1);
});