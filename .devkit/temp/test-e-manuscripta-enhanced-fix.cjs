const { EnhancedManuscriptDownloaderService } = require('../../../src/main/services/EnhancedManuscriptDownloaderService');

async function testEnhancedEManuscriptaFix() {
    console.log('=== Testing Enhanced E-Manuscripta Multi-Block Fix ===');
    
    const service = new EnhancedManuscriptDownloaderService();
    const testUrl = 'https://www.e-manuscripta.ch/bau/content/titleinfo/5157222';
    
    try {
        console.log(`Testing URL: ${testUrl}`);
        console.log('Loading manifest with enhanced multi-block support...');
        
        const manifest = await service.loadEManuscriptaManifest(testUrl);
        
        console.log('\n=== Results ===');
        console.log(`✓ Library: ${manifest.library}`);
        console.log(`✓ Display Name: ${manifest.displayName}`);
        console.log(`✓ Total Pages: ${manifest.totalPages}`);
        console.log(`✓ Original URL: ${manifest.originalUrl}`);
        
        if (manifest.pageLinks && manifest.pageLinks.length > 0) {
            console.log('\n=== Sample Page URLs ===');
            console.log(`First page: ${manifest.pageLinks[0]}`);
            console.log(`Middle page: ${manifest.pageLinks[Math.floor(manifest.pageLinks.length / 2)]}`);
            console.log(`Last page: ${manifest.pageLinks[manifest.pageLinks.length - 1]}`);
        }
        
        console.log('\n=== Fix Validation ===');
        if (manifest.totalPages > 100) {
            console.log('✅ SUCCESS: Multi-block manuscript detected and processed');
            console.log(`✅ ${manifest.totalPages} pages found (significant improvement over single block)`);
        } else if (manifest.totalPages > 20) {
            console.log('⚠️  PARTIAL: Some blocks processed but may be missing some');
            console.log(`⚠️  ${manifest.totalPages} pages found`);
        } else {
            console.log('❌ FAILED: Still only finding single block worth of pages');
            console.log(`❌ ${manifest.totalPages} pages found`);
        }
        
        return { success: true, pageCount: manifest.totalPages };
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        return { success: false, error: error.message };
    }
}

testEnhancedEManuscriptaFix().catch(console.error);