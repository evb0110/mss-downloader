const { contextBridge, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// Test URLs from all issues
const testUrls = {
    hhu: 'https://digital.ulb.hhu.de/ms/content/titleinfo/7674176', // Issue #1
    graz: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538', // Issue #2
    verona: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15', // Issue #3
    morgan: 'https://www.themorgan.org/collection/lindau-gospels/thumbs' // Issue #4
};

async function validateAllFixes() {
    console.log('=== Validating All Issue Fixes ===\n');
    
    const results = {};
    const { EnhancedManuscriptDownloaderService } = require(path.join(__dirname, '../../src/main/services/EnhancedManuscriptDownloaderService.ts'));
    const service = new EnhancedManuscriptDownloaderService();
    
    // Test Issue #1: HHU Düsseldorf
    console.log('Testing Issue #1 - HHU Düsseldorf...');
    try {
        const manifest = await service.loadHhuManifest(testUrls.hhu);
        console.log(`✅ HHU Fix Working: Loaded ${manifest.pageLinks.length} pages`);
        results.hhu = { status: 'success', pages: manifest.pageLinks.length };
    } catch (error) {
        console.error(`❌ HHU Fix Failed: ${error.message}`);
        results.hhu = { status: 'failed', error: error.message };
    }
    
    // Test Issue #2: University of Graz
    console.log('\nTesting Issue #2 - University of Graz...');
    try {
        const manifest = await service.loadGrazManifest(testUrls.graz);
        console.log(`✅ Graz Fix Working: Loaded ${manifest.pageLinks.length} pages`);
        results.graz = { status: 'success', pages: manifest.pageLinks.length };
    } catch (error) {
        console.error(`❌ Graz Fix Failed: ${error.message}`);
        results.graz = { status: 'failed', error: error.message };
    }
    
    // Test Issue #3: Verona
    console.log('\nTesting Issue #3 - Verona NBM...');
    try {
        const manifest = await service.loadVeronaManifest(testUrls.verona);
        console.log(`✅ Verona Fix Working: Loaded ${manifest.pageLinks.length} pages`);
        results.verona = { status: 'success', pages: manifest.pageLinks.length };
    } catch (error) {
        console.error(`❌ Verona Fix Failed: ${error.message}`);
        results.verona = { status: 'failed', error: error.message };
    }
    
    // Test Issue #4: Morgan Library
    console.log('\nTesting Issue #4 - Morgan Library...');
    try {
        const manifest = await service.parseMorganLibraryPages(testUrls.morgan);
        console.log(`✅ Morgan Fix Working: Loaded ${manifest.pageLinks.length} pages`);
        results.morgan = { status: 'success', pages: manifest.pageLinks.length };
    } catch (error) {
        console.error(`❌ Morgan Fix Failed: ${error.message}`);
        results.morgan = { status: 'failed', error: error.message };
    }
    
    // Summary
    console.log('\n=== Validation Summary ===');
    const allSuccess = Object.values(results).every(r => r.status === 'success');
    
    if (allSuccess) {
        console.log('✅ All fixes validated successfully!');
        console.log('\nReady for version bump.');
    } else {
        console.log('❌ Some fixes need attention:');
        Object.entries(results).forEach(([lib, result]) => {
            if (result.status === 'failed') {
                console.log(`  - ${lib}: ${result.error}`);
            }
        });
    }
    
    // Save results
    await fs.writeFile(
        path.join(__dirname, '../validation-results.json'),
        JSON.stringify(results, null, 2)
    );
    
    return allSuccess;
}

// Run if called directly
if (require.main === module) {
    validateAllFixes().catch(console.error);
}

module.exports = { validateAllFixes };