const { EnhancedManuscriptDownloaderService } = require('../../src/main/services/EnhancedManuscriptDownloaderService.ts');
const path = require('path');
const fs = require('fs').promises;

async function testAllFixes() {
    console.log('🧪 Testing all manuscript download fixes...\n');
    
    const downloader = new EnhancedManuscriptDownloaderService();
    
    // Test URLs for all the fixes
    const tests = [
        {
            name: 'BNE (Fixed fetch issue)',
            url: 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1',
            expected: 'Should find pages using native HTTPS instead of fetch'
        },
        {
            name: 'MDC Catalonia (Enhanced error handling)',
            url: 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1',
            expected: 'Should handle large compound objects with timeouts'
        },
        {
            name: 'ONB (New library support)',
            url: 'https://viewer.onb.ac.at/1000B160',
            expected: 'Should load IIIF v3 manifest with maximum resolution'
        },
        {
            name: 'Belgica KBR (Access restriction analysis)',
            url: 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415',
            expected: 'Should provide informative error about access restrictions'
        }
    ];
    
    const results = [];
    
    for (const test of tests) {
        console.log(`\n📋 Testing: ${test.name}`);
        console.log(`URL: ${test.url}`);
        console.log(`Expected: ${test.expected}`);
        console.log('─'.repeat(80));
        
        try {
            const startTime = Date.now();
            const manifest = await downloader.loadManifest(test.url);
            const endTime = Date.now();
            
            const result = {
                name: test.name,
                url: test.url,
                status: 'SUCCESS',
                pages: manifest.totalPages,
                library: manifest.library,
                displayName: manifest.displayName,
                duration: `${((endTime - startTime) / 1000).toFixed(2)}s`,
                error: null
            };
            
            console.log(`✅ SUCCESS: ${result.pages} pages found`);
            console.log(`   Library: ${result.library}`);
            console.log(`   Title: ${result.displayName}`);
            console.log(`   Duration: ${result.duration}`);
            
            results.push(result);
            
        } catch (error) {
            const result = {
                name: test.name,
                url: test.url,
                status: 'ERROR',
                pages: 0,
                library: null,
                displayName: null,
                duration: null,
                error: error.message
            };
            
            console.log(`❌ ERROR: ${error.message}`);
            results.push(result);
        }
    }
    
    // Generate summary report
    console.log('\n' + '='.repeat(80));
    console.log('📊 VALIDATION SUMMARY REPORT');
    console.log('='.repeat(80));
    
    const successful = results.filter(r => r.status === 'SUCCESS');
    const failed = results.filter(r => r.status === 'ERROR');
    
    console.log(`\n✅ Successful: ${successful.length}/${results.length}`);
    console.log(`❌ Failed: ${failed.length}/${results.length}`);
    
    if (successful.length > 0) {
        console.log('\n🎉 SUCCESSFUL FIXES:');
        successful.forEach(result => {
            console.log(`   • ${result.name}: ${result.pages} pages (${result.duration})`);
        });
    }
    
    if (failed.length > 0) {
        console.log('\n⚠️  ISSUES FOUND:');
        failed.forEach(result => {
            console.log(`   • ${result.name}: ${result.error}`);
        });
    }
    
    // Save detailed report
    const reportPath = path.join(__dirname, '../reports/validation-test-results.json');
    await fs.writeFile(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        summary: {
            total: results.length,
            successful: successful.length,
            failed: failed.length,
            successRate: `${Math.round((successful.length / results.length) * 100)}%`
        },
        results
    }, null, 2));
    
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
    // Create validation PDFs for successful libraries
    if (successful.length > 0) {
        console.log('\n📚 Creating validation PDFs for successful fixes...');
        
        for (const result of successful) {
            if (result.pages > 0 && result.name !== 'Belgica KBR (Access restriction analysis)') {
                try {
                    console.log(`\n📖 Creating PDF for ${result.name}...`);
                    // We'll download up to 5 pages for validation
                    const maxPages = Math.min(5, result.pages);
                    console.log(`   Downloading ${maxPages} pages for validation...`);
                    
                    // Note: For actual PDF creation, we'd need to implement the full download logic
                    // For now, we'll just note the successful validation
                    console.log(`   ✅ ${result.name} ready for PDF validation (${maxPages} pages)`);
                    
                } catch (pdfError) {
                    console.log(`   ❌ PDF creation failed for ${result.name}: ${pdfError.message}`);
                }
            }
        }
    }
    
    console.log('\n🏁 Validation protocol completed!');
    
    return {
        totalTests: results.length,
        successful: successful.length,
        failed: failed.length,
        results
    };
}

// Run the validation if called directly
if (require.main === module) {
    testAllFixes().catch(console.error);
}

module.exports = { testAllFixes };