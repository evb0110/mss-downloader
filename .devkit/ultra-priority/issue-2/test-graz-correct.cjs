const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');

async function testGraz() {
    console.log('🔍 Testing exact user URL: https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688');
    console.log('Platform:', process.platform);
    console.log('Node version:', process.version);
    console.log('User platform: win32 (from logs)');
    console.log('');
    
    const loaders = new SharedManifestLoaders();
    const url = 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688';
    
    try {
        console.log('⏳ Starting manifest load...');
        const startTime = Date.now();
        
        // First test getGrazManifest directly
        console.log('📝 Testing getGrazManifest directly...');
        const result = await loaders.getGrazManifest(url);
        
        const duration = Date.now() - startTime;
        console.log(`✅ Manifest loaded in ${duration}ms`);
        console.log(`📄 Pages found: ${result.images ? result.images.length : result.pageCount || 0}`);
        console.log(`📚 Title: ${result.displayName}`);
        console.log(`🏛️ Library: ${result.library}`);
        
        // Test via getManifestForLibrary
        console.log('\n📝 Testing via getManifestForLibrary...');
        const startTime2 = Date.now();
        const result2 = await loaders.getManifestForLibrary('graz', url);
        const duration2 = Date.now() - startTime2;
        console.log(`✅ Loaded via adapter in ${duration2}ms`);
        
        return result;
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        if (error.stack) {
            console.error('Stack trace (first 5 lines):');
            const stackLines = error.stack.split('\n').slice(0, 5);
            stackLines.forEach(line => console.error('  ', line));
        }
        
        // Check if it's a timeout or IPC error
        if (error.message.includes('timeout') || error.message.includes('reply')) {
            console.error('\n⚠️  This appears to be an IPC/timeout error similar to user report');
        }
        
        // Check for network issues
        if (error.code) {
            console.error(`\n⚠️  Network error code: ${error.code}`);
        }
        
        throw error;
    }
}

testGraz().then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
}).catch(error => {
    console.error('\n💥 Test failed');
    process.exit(1);
});