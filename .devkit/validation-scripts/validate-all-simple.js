const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders');
const fs = require('fs').promises;
const path = require('path');

const VALIDATION_DIR = path.join(__dirname, '../validation-results');

// All test cases
const TEST_CASES = [
    {
        library: 'Florence',
        issue: '#5 - ETIMEDOUT cdm21059.contentdm.oclc.org',
        urls: [
            'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/30643',
            'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/17625'
        ]
    },
    {
        library: 'Morgan',
        issue: '#4 - ReferenceError imagesByPriority',
        urls: [
            'https://www.themorgan.org/collection/lindau-gospels/thumbs',
            'https://ica.themorgan.org/manuscript/thumbs/143821'
        ]
    },
    {
        library: 'Verona',
        issue: '#3 - ETIMEDOUT nuovabibliotecamanoscritta.it',
        urls: [
            'https://nuovabibliotecamanoscritta.it/catalogo/Scheda?codice=15',
            'https://nbm.regione.veneto.it/documenti/mirador_json/manifest/LXXXIX841.json'
        ]
    },
    {
        library: 'Graz',
        issue: '#2 - Manifest addition error',
        urls: [
            'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
            'https://unipub.uni-graz.at/obvugrscript/content/pageview/8224540'
        ]
    },
    {
        library: 'HHU',
        issue: '#1 - JSON parsing error',
        urls: [
            'https://digital.ub.uni-duesseldorf.de/content/titleinfo/7938251',
            'https://digital.ub.uni-duesseldorf.de/hs/content/titleinfo/259994'
        ]
    }
];

async function downloadImage(loader, url) {
    try {
        const response = await loader.fetchWithRetry(url, {}, 2);
        if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
        const buffer = await response.buffer();
        return { success: true, size: buffer.length };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function validateLibrary(loader, testCase) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing ${testCase.library} - Issue ${testCase.issue}`);
    console.log('='.repeat(60));
    
    const results = [];
    
    for (const url of testCase.urls) {
        console.log(`\nURL: ${url}`);
        const result = { url, library: testCase.library };
        
        try {
            const startTime = Date.now();
            
            // Get manifest
            const libraryId = testCase.library.toLowerCase().replace(' ', '_');
            const manifest = await loader.getManifestForLibrary(libraryId, url);
            
            result.manifestTime = Date.now() - startTime;
            result.status = 'success';
            result.totalImages = manifest.images ? manifest.images.length : 0;
            result.displayName = manifest.displayName || 'Unknown';
            
            console.log(`✓ Manifest loaded in ${result.manifestTime}ms`);
            console.log(`  Title: ${result.displayName}`);
            console.log(`  Total images: ${result.totalImages}`);
            
            // Test downloading first 5 images
            if (manifest.images && manifest.images.length > 0) {
                const testCount = Math.min(5, manifest.images.length);
                const downloadResults = [];
                
                console.log(`  Testing ${testCount} image downloads...`);
                
                for (let i = 0; i < testCount; i++) {
                    const image = manifest.images[i];
                    if (image.url.endsWith('.zif')) {
                        console.log(`    Page ${i + 1}: Skipped (ZIF format)`);
                        continue;
                    }
                    
                    const dlResult = await downloadImage(loader, image.url);
                    downloadResults.push(dlResult);
                    
                    if (dlResult.success) {
                        console.log(`    Page ${i + 1}: ✓ ${(dlResult.size / 1024).toFixed(1)} KB`);
                    } else {
                        console.log(`    Page ${i + 1}: ✗ ${dlResult.error}`);
                    }
                }
                
                const successCount = downloadResults.filter(r => r.success).length;
                result.downloadSuccess = successCount;
                result.downloadTotal = downloadResults.length;
                result.downloadRate = downloadResults.length > 0 ? 
                    (successCount / downloadResults.length * 100).toFixed(1) : 0;
                
                console.log(`  Download success rate: ${result.downloadRate}% (${successCount}/${downloadResults.length})`);
            }
            
        } catch (error) {
            result.status = 'failed';
            result.error = error.message;
            console.log(`✗ Error: ${error.message}`);
        }
        
        results.push(result);
    }
    
    return results;
}

async function runValidation() {
    console.log('MSS Downloader - GitHub Issues Validation');
    console.log('========================================\n');
    
    await fs.mkdir(VALIDATION_DIR, { recursive: true });
    
    const loader = new SharedManifestLoaders();
    const allResults = [];
    const summary = {
        total: 0,
        successful: 0,
        failed: 0,
        libraries: {}
    };
    
    for (const testCase of TEST_CASES) {
        const results = await validateLibrary(loader, testCase);
        allResults.push(...results);
        
        // Update summary
        const libSuccess = results.filter(r => r.status === 'success').length;
        const libTotal = results.length;
        
        summary.libraries[testCase.library] = {
            issue: testCase.issue,
            total: libTotal,
            successful: libSuccess,
            failed: libTotal - libSuccess,
            successRate: libTotal > 0 ? (libSuccess / libTotal * 100).toFixed(1) : 0
        };
        
        summary.total += libTotal;
        summary.successful += libSuccess;
        summary.failed += libTotal - libSuccess;
    }
    
    // Final report
    console.log('\n' + '='.repeat(60));
    console.log('VALIDATION SUMMARY');
    console.log('='.repeat(60));
    
    for (const [library, stats] of Object.entries(summary.libraries)) {
        console.log(`\n${library} (${stats.issue}):`);
        console.log(`  Success rate: ${stats.successRate}% (${stats.successful}/${stats.total})`);
    }
    
    console.log('\n' + '-'.repeat(60));
    console.log(`Overall: ${summary.successful}/${summary.total} tests passed`);
    console.log(`Success rate: ${(summary.successful / summary.total * 100).toFixed(1)}%`);
    
    // Save detailed report
    const report = {
        timestamp: new Date().toISOString(),
        summary,
        details: allResults
    };
    
    await fs.writeFile(
        path.join(VALIDATION_DIR, 'validation-report.json'),
        JSON.stringify(report, null, 2)
    );
    
    console.log(`\nDetailed report saved to: ${path.join(VALIDATION_DIR, 'validation-report.json')}`);
}

// Run validation
runValidation().catch(console.error);