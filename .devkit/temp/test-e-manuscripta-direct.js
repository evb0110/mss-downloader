
const { EnhancedManuscriptDownloaderService } = require('./dist/main/services/EnhancedManuscriptDownloaderService.js');

async function testEManuscriptaFix() {
    try {
        const service = new EnhancedManuscriptDownloaderService();
        const manifest = await service.loadEManuscriptaManifest('https://www.e-manuscripta.ch/zuzcmi/content/zoom/3229497');
        
        console.log('✅ Manifest loaded successfully');
        console.log('📄 Display Name:', manifest.displayName);
        console.log('📊 Total Pages:', manifest.totalPages);
        console.log('🔗 First Page URL:', manifest.pageLinks[0]);
        console.log('🔗 Last Page URL:', manifest.pageLinks[manifest.pageLinks.length - 1]);
        
        if (manifest.totalPages >= 400) {
            console.log('🎉 SUCCESS: Fix appears to be working! Found', manifest.totalPages, 'pages');
            return true;
        } else {
            console.log('❌ FAILURE: Still only finding', manifest.totalPages, 'pages');
            return false;
        }
    } catch (error) {
        console.error('❌ ERROR:', error.message);
        return false;
    }
}

testEManuscriptaFix().then(success => {
    process.exit(success ? 0 : 1);
});
