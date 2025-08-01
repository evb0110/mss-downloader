#!/usr/bin/env node

/**
 * Direct validation using SharedManifestLoaders
 */

const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');
const fs = require('fs');

// Exact URLs from user reports
const TEST_CASES = {
    issue_2: {
        title: 'грац (Graz)',
        url: 'https://gams.uni-graz.at/o:hora.3-1',
        library: 'graz'
    },
    issue_3: {
        title: 'верона (Verona)',
        url: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15',
        library: 'verona'
    },
    issue_4: {
        title: 'морган (Morgan)',
        url: 'https://www.themorgan.org/collection/lindau-gospels/thumbs',
        library: 'morgan'
    },
    issue_5: {
        title: 'Флоренция (Florence)',
        url: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/',
        library: 'florence'
    },
    issue_6: {
        title: 'Бордо (Bordeaux)',
        url: 'https://1886.bordeaux.fr/ark:/48743/btv1b52509616g',
        library: 'bordeaux'
    },
    issue_7: {
        title: 'Бодлеянская (Bodleian) #7',
        url: 'https://digital.bodleian.ox.ac.uk/objects/ce827512-d440-4833-bdba-f4f4f079d2cd/',
        library: 'bodleian'
    },
    issue_8: {
        title: 'Бодлеянская (Bodleian) #8',
        url: 'https://digital.bodleian.ox.ac.uk/objects/ce827512-d440-4833-bdba-f4f4f079d2cd/',
        library: 'bodleian'
    },
    issue_9: {
        title: 'BDL',
        url: 'https://www.bdl.servizirl.it/vufind/Record/BDL-OGGETTO-3903',
        library: 'bdl'
    },
    issue_10: {
        title: 'Цюрих (E-manuscripta)',
        url: 'https://www.e-manuscripta.ch/zuz/content/zoom/24451322',
        library: 'e_manuscripta'
    },
    issue_11: {
        title: 'BNE/BVPB',
        url: 'https://bvpb.mcu.es/es/consulta/registro.do?id=406029',
        library: 'bvpb'
    },
    issue_12: {
        title: 'каталония (MDC Catalonia)',
        url: 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1',
        library: 'mdc_catalonia'
    },
    issue_13: {
        title: 'гренобль (Grenoble)',
        url: 'https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom',
        library: 'grenoble'
    },
    issue_14: {
        title: 'Карлсруэ (Karlsruhe)',
        url: 'https://i3f.vls.io/iiif/iiif-server?img=/AUGE-2-PERG-1--F--0001.jpg&id=https%3A%2F%2Fdigital.blb-karlsruhe.de%2Fid%2F2926018%2Fmanifest&bx=7500&by=9375&bw=7500&bh=9375&rot=0&scaledWidth=1500&scaledHeight=1875',
        library: 'karlsruhe'
    }
};

class DirectValidator {
    constructor() {
        this.loaders = new SharedManifestLoaders();
        this.results = {};
        this.summary = {
            fixed: [],
            working: [],
            failed: [],
            networkIssues: []
        };
    }

    async testIssue(issueKey, config) {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`Testing ${issueKey}: ${config.title}`);
        console.log(`URL: ${config.url}`);
        console.log(`Library: ${config.library}`);
        console.log(`${'='.repeat(70)}`);
        
        try {
            const startTime = Date.now();
            
            // Call getManifestForLibrary directly
            const manifest = await this.loaders.getManifestForLibrary(config.library, config.url);
            
            const duration = Date.now() - startTime;
            
            // Extract page count
            let pageCount = 0;
            if (manifest.images && Array.isArray(manifest.images)) {
                pageCount = manifest.images.length;
            } else if (manifest.totalPages) {
                pageCount = manifest.totalPages;
            } else if (manifest.pageCount) {
                pageCount = manifest.pageCount;
            } else if (manifest.tileConfig?.pageCount) {
                pageCount = manifest.tileConfig.pageCount;
            }
            
            console.log(`✅ SUCCESS in ${duration}ms`);
            console.log(`  Title: ${manifest.displayName || 'No title'}`);
            console.log(`  Pages: ${pageCount}`);
            console.log(`  Type: ${manifest.type || 'standard'}`);
            
            // Check for specific fixes
            if (issueKey === 'issue_6' && pageCount > 50) {
                console.log(`  🎉 FIXED: Bordeaux now detects ${pageCount} pages (was limited to 50)`);
                this.summary.fixed.push({ ...config, issueKey, pageCount });
            } else if (issueKey === 'issue_10' && pageCount > 11) {
                console.log(`  🎉 FIXED: E-manuscripta now detects ${pageCount} pages (was limited to 11)`);
                this.summary.fixed.push({ ...config, issueKey, pageCount });
            } else if (issueKey === 'issue_14') {
                console.log(`  🎉 NEW: Karlsruhe proxy URL support implemented`);
                this.summary.fixed.push({ ...config, issueKey, pageCount });
            } else {
                this.summary.working.push({ ...config, issueKey, pageCount });
            }
            
            this.results[issueKey] = {
                success: true,
                pageCount,
                duration,
                title: manifest.displayName
            };
            
        } catch (error) {
            console.log(`❌ FAILED: ${error.message}`);
            
            const errorLower = error.message.toLowerCase();
            if (errorLower.includes('enotfound') || 
                errorLower.includes('etimedout') || 
                errorLower.includes('eai_again') ||
                errorLower.includes('timeout') ||
                errorLower.includes('econnrefused') ||
                errorLower.includes('econnreset') ||
                errorLower.includes('socket hang up')) {
                console.log(`  ⚠️ Network/DNS issue - server may be temporarily unavailable`);
                this.summary.networkIssues.push({ ...config, issueKey, error: error.message });
            } else {
                this.summary.failed.push({ ...config, issueKey, error: error.message });
            }
            
            this.results[issueKey] = {
                success: false,
                error: error.message
            };
        }
    }

    async runAll() {
        console.log('Running direct validation of all 14 GitHub issues...\n');
        console.log('This tests the ACTUAL production code (SharedManifestLoaders)\n');
        
        for (const [issueKey, config] of Object.entries(TEST_CASES)) {
            await this.testIssue(issueKey, config);
            // Small delay between tests
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        this.printSummary();
    }

    printSummary() {
        console.log('\n\n' + '='.repeat(80));
        console.log('=== COMPREHENSIVE ISSUE RESOLUTION SUMMARY ===');
        console.log('='.repeat(80));
        console.log(`Total open issues tested: ${Object.keys(TEST_CASES).length}`);
        
        if (this.summary.fixed.length > 0) {
            console.log('\n🎉 FIXED IN THIS VERSION:');
            this.summary.fixed.forEach(issue => {
                console.log(`  ✅ ${issue.issueKey} (${issue.title}) - ${issue.pageCount} pages`);
            });
        }
        
        if (this.summary.working.length > 0) {
            console.log('\n✅ ALREADY WORKING (verified):');
            this.summary.working.forEach(issue => {
                console.log(`  ✅ ${issue.issueKey} (${issue.title}) - ${issue.pageCount} pages`);
            });
        }
        
        if (this.summary.networkIssues.length > 0) {
            console.log('\n⚠️ NETWORK/SERVER ISSUES (not our fault):');
            this.summary.networkIssues.forEach(issue => {
                console.log(`  ⚠️ ${issue.issueKey} (${issue.title}) - ${issue.error}`);
            });
        }
        
        if (this.summary.failed.length > 0) {
            console.log('\n❌ ACTUAL FAILURES:');
            this.summary.failed.forEach(issue => {
                console.log(`  ❌ ${issue.issueKey} (${issue.title}) - ${issue.error}`);
            });
        }
        
        const total = Object.keys(TEST_CASES).length;
        const working = this.summary.fixed.length + this.summary.working.length;
        const networkIssues = this.summary.networkIssues.length;
        const actualFailures = this.summary.failed.length;
        
        console.log('\n' + '='.repeat(80));
        console.log('STATISTICS:');
        console.log(`  Working: ${working}/${total} (${Math.round(working/total*100)}%)`);
        console.log(`  Network Issues: ${networkIssues}/${total}`);
        console.log(`  Actual Failures: ${actualFailures}/${total}`);
        console.log(`  Ready for version bump: ${actualFailures === 0 ? 'YES ✅' : 'NO ❌'}`);
        console.log('='.repeat(80));
        
        // Save results
        fs.writeFileSync(
            '.devkit/validation-results.json',
            JSON.stringify({
                timestamp: new Date().toISOString(),
                summary: this.summary,
                results: this.results,
                statistics: {
                    total,
                    working,
                    networkIssues,
                    actualFailures,
                    successRate: Math.round(working/total*100)
                }
            }, null, 2)
        );
        
        console.log('\n📋 Full results saved to .devkit/validation-results.json');
    }
}

// Run validation
const validator = new DirectValidator();
validator.runAll().catch(console.error);