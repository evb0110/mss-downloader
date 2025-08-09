const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');

async function testGraz() {
    console.log('🔍 Testing exact user URL: https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688');
    console.log('Platform:', process.platform);
    console.log('Node version:', process.version);
    
    const loaders = new SharedManifestLoaders();
    const url = 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688';
    
    try {
        console.log('\n⏳ Starting manifest load...');
        const startTime = Date.now();
        
        const result = await loaders.parseUrl(url);
        
        const duration = Date.now() - startTime;
        console.log(`✅ Manifest loaded in ${duration}ms`);
        console.log(`📄 Pages found: ${result.pages}`);
        console.log(`📚 Title: ${result.displayName}`);
        
        // Test page URLs
        if (result.library === 'graz') {
            console.log('\n🔍 Testing page URL generation...');
            const testPage = await loaders.library2.graz.getPageUrl(result.pageList[0], {});
            console.log(`✅ First page URL: ${testPage.url.substring(0, 100)}...`);
        }
        
        return result;
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error('Stack:', error.stack);
        
        // Check if it's a timeout or IPC error
        if (error.message.includes('timeout') || error.message.includes('reply')) {
            console.error('\n⚠️  This appears to be an IPC/timeout error similar to user report');
        }
        
        throw error;
    }
}

testGraz().catch(error => {
    console.error('\n💥 Test failed');
    process.exit(1);
});