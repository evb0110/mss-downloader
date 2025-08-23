const { DigitalWaltersLoader } = require('../../dist/main/main.js');

console.log('🔍 Testing Digital Walters URL detection fix...');

// Test URL from user's error
const testUrl = 'https://manuscripts.thewalters.org/viewer.php?id=W.530#page/1/mode/1up';

// Mock dependencies
const mockDeps = {
    fetchDirect: async (url) => {
        console.log(`📡 Mock fetch: ${url}`);
        return {
            ok: true,
            text: async () => '<title>Test Manuscript</title>'
        };
    }
};

async function testWaltersLoader() {
    try {
        const loader = new DigitalWaltersLoader(mockDeps);
        console.log(`🧪 Testing URL: ${testUrl}`);
        
        // This should extract W530 from W.530
        const result = await loader.loadManifest(testUrl);
        console.log(`✅ SUCCESS: Extracted manuscript ID and loaded manifest`);
        console.log(`📋 Manuscript: ${result.title || 'Test Manuscript'}`);
        console.log(`📄 Pages: ${result.pages.length}`);
        
    } catch (error) {
        console.error(`❌ FAILED: ${error.message}`);
        process.exit(1);
    }
}

testWaltersLoader();