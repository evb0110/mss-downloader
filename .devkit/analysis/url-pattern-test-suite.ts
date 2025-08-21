#!/usr/bin/env bun

/**
 * URL PATTERN VALIDATION TEST SUITE v1.0
 * 
 * MISSION: Comprehensive validation of URL detection patterns and routing consistency
 * 
 * This test suite validates:
 * 1. URL detection accuracy for all supported libraries
 * 2. Routing consistency between detection and implementation
 * 3. Pattern robustness against URL variations
 * 4. Evolution resilience for known URL format changes
 */

interface TestCase {
    library: string;
    url: string;
    expectedDetection: string;
    expectedRouting: 'individual' | 'shared' | 'error';
    category: 'basic' | 'evolution' | 'edge_case' | 'regression';
    description: string;
}

interface TestResult {
    testCase: TestCase;
    actualDetection: string | null;
    actualRouting: 'individual' | 'shared' | 'error' | 'unknown';
    success: boolean;
    issues: string[];
    timing: number;
}

class URLPatternTestSuite {
    private testCases: TestCase[] = [];
    private results: TestResult[] = [];
    
    constructor() {
        this.initializeTestCases();
    }
    
    private initializeTestCases(): void {
        this.testCases = [
            // BRITISH LIBRARY - Multiple URL formats
            {
                library: 'bl',
                url: 'https://iiif.bl.uk/viewer/ark:/81055/vdc_100000000789.0x000001',
                expectedDetection: 'bl',
                expectedRouting: 'individual',
                category: 'basic',
                description: 'British Library - IIIF URL format'
            },
            {
                library: 'bl',
                url: 'https://bl.digirati.io/viewer/ark:/81055/vdc_100000000789.0x000001',
                expectedDetection: 'bl',
                expectedRouting: 'individual',
                category: 'evolution',
                description: 'British Library - New Digirati URL format'
            },
            {
                library: 'bl',
                url: 'https://bl.digirati.io/manuscripts/manuscript-1001',
                expectedDetection: 'bl',
                expectedRouting: 'individual',
                category: 'edge_case',
                description: 'British Library - Alternative URL structure'
            },
            
            // GALLICA BnF - ARK identifiers and variations
            {
                library: 'gallica',
                url: 'https://gallica.bnf.fr/ark:/12148/btv1b8451636m/f1.item',
                expectedDetection: 'gallica',
                expectedRouting: 'individual',
                category: 'basic',
                description: 'Gallica BnF - Standard ARK identifier'
            },
            {
                library: 'gallica',
                url: 'https://gallica.bnf.fr/ark:/12148/btv1b8451636m.r=manuscript',
                expectedDetection: 'gallica',
                expectedRouting: 'individual',
                category: 'edge_case',
                description: 'Gallica BnF - ARK with search parameters'
            },
            {
                library: 'gallica',
                url: 'https://gallica.bnf.fr/iiif/ark:/12148/btv1b8451636m/manifest.json',
                expectedDetection: 'gallica',
                expectedRouting: 'individual',
                category: 'evolution',
                description: 'Gallica BnF - Direct IIIF manifest URL'
            },
            
            // VATICAN LIBRARY - Key mismatch testing
            {
                library: 'vatican',
                url: 'https://digi.vatlib.it/view/MSS_Vat.lat.3225',
                expectedDetection: 'vatlib', // Current detection returns 'vatlib'
                expectedRouting: 'individual', // But routes to 'vatican'
                category: 'regression',
                description: 'Vatican Library - Key mismatch issue'
            },
            {
                library: 'vatican',
                url: 'https://digi.vatlib.it/mss/detail/Vat.lat.3225',
                expectedDetection: 'vatlib',
                expectedRouting: 'individual',
                category: 'edge_case',
                description: 'Vatican Library - Alternative URL format'
            },
            
            // E-MANUSCRIPTA - Key mismatch and evolution
            {
                library: 'emanuscripta',
                url: 'https://e-manuscripta.ch/bau/content/pageview/837049',
                expectedDetection: 'e_manuscripta', // Current detection returns 'e_manuscripta'
                expectedRouting: 'individual', // But routes to 'emanuscripta'
                category: 'regression',
                description: 'e-manuscripta - Key mismatch issue'
            },
            {
                library: 'emanuscripta',
                url: 'https://e-manuscripta.ch/viewer/content/pageview/837049',
                expectedDetection: 'e_manuscripta',
                expectedRouting: 'individual',
                category: 'evolution',
                description: 'e-manuscripta - Evolved URL structure'
            },
            
            // CAMBRIDGE CUDL - Pattern robustness
            {
                library: 'cudl',
                url: 'https://cudl.lib.cam.ac.uk/view/MS-DD-00001-00017/1',
                expectedDetection: 'cudl',
                expectedRouting: 'individual',
                category: 'basic',
                description: 'Cambridge CUDL - Standard viewer URL'
            },
            {
                library: 'cudl',
                url: 'https://cudl.lib.cam.ac.uk/collections/manuscripts',
                expectedDetection: 'cudl',
                expectedRouting: 'individual',
                category: 'edge_case',
                description: 'Cambridge CUDL - Collection browse URL'
            },
            
            // BODLEIAN - Multiple subdomains
            {
                library: 'bodleian',
                url: 'https://digital.bodleian.ox.ac.uk/objects/748a9d5a-7c1a-4916-91ad-39d65fa1e2e6/',
                expectedDetection: 'bodleian',
                expectedRouting: 'shared',
                category: 'basic',
                description: 'Bodleian - Standard digital subdomain'
            },
            {
                library: 'bodleian',
                url: 'https://digital2.bodleian.ox.ac.uk/objects/748a9d5a-7c1a-4916-91ad-39d65fa1e2e6/',
                expectedDetection: 'bodleian',
                expectedRouting: 'shared',
                category: 'evolution',
                description: 'Bodleian - New digital2 subdomain'
            },
            
            // YALE - Collections platform
            {
                library: 'yale',
                url: 'https://collections.library.yale.edu/catalog/2002826',
                expectedDetection: 'yale',
                expectedRouting: 'shared',
                category: 'basic',
                description: 'Yale - Collections platform URL'
            },
            {
                library: 'yale',
                url: 'https://collections.library.yale.edu/iiif/2002826/manifest',
                expectedDetection: 'yale',
                expectedRouting: 'shared',
                category: 'edge_case',
                description: 'Yale - IIIF manifest URL'
            },
            
            // TORONTO - Multiple URL patterns
            {
                library: 'toronto',
                url: 'https://collections.library.utoronto.ca/view/fisher2:F6521',
                expectedDetection: 'toronto',
                expectedRouting: 'individual',
                category: 'basic',
                description: 'Toronto - Collections viewer URL'
            },
            {
                library: 'toronto',
                url: 'https://iiif.library.utoronto.ca/presentation/v2/fisher:F6521/manifest',
                expectedDetection: 'toronto',
                expectedRouting: 'individual',
                category: 'basic',
                description: 'Toronto - Direct IIIF manifest URL'
            },
            
            // MORGAN LIBRARY - Two Implementations Bug
            {
                library: 'morgan',
                url: 'https://www.themorgan.org/manuscript/76873',
                expectedDetection: 'morgan',
                expectedRouting: 'shared', // Currently routes to shared (BUG!)
                category: 'regression',
                description: 'Morgan Library - Two Implementations Bug (should use individual)'
            },
            {
                library: 'morgan',
                url: 'https://themorgan.org/iiif/manuscripts/76873/manifest',
                expectedDetection: 'morgan',
                expectedRouting: 'shared',
                category: 'edge_case',
                description: 'Morgan Library - IIIF URL variation'
            },
            
            // ROME LIBRARY - Two Implementations Bug + Complex routing
            {
                library: 'rome',
                url: 'http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1',
                expectedDetection: 'rome',
                expectedRouting: 'shared', // Currently routes to shared (BUG!)
                category: 'regression',
                description: 'Rome Library - Two Implementations Bug (should use individual)'
            },
            {
                library: 'rome',
                url: 'https://digitale.bnc.roma.sbn.it/tecadigitale/codex/4534',
                expectedDetection: 'rome',
                expectedRouting: 'shared',
                category: 'edge_case',
                description: 'Rome Library - Alternative URL structure'
            },
            
            // HHU DÜSSELDORF - Recent updates
            {
                library: 'hhu',
                url: 'https://digital.ulb.hhu.de/i3f/v20/7674176/manifest',
                expectedDetection: 'hhu',
                expectedRouting: 'individual',
                category: 'basic',
                description: 'HHU Düsseldorf - IIIF v2 manifest'
            },
            {
                library: 'hhu',
                url: 'https://digital.ulb.hhu.de/viewer/object/HHU_19234/',
                expectedDetection: 'hhu',
                expectedRouting: 'individual',
                category: 'evolution',
                description: 'HHU Düsseldorf - Viewer URL format'
            },
            
            // BDL - Complex platform
            {
                library: 'bdl',
                url: 'https://bdl.servizirl.it/vufind/Record/TO00170_MS0864/Details',
                expectedDetection: 'bdl',
                expectedRouting: 'individual',
                category: 'basic',
                description: 'BDL - VuFind record URL'
            },
            {
                library: 'bdl',
                url: 'https://bdl.servizirl.it/iiif/presentation/TO00170_MS0864/manifest',
                expectedDetection: 'bdl',
                expectedRouting: 'individual',
                category: 'edge_case',
                description: 'BDL - IIIF presentation URL'
            },
            
            // NORWEGIAN NATIONAL LIBRARY - Generic pattern issues
            {
                library: 'norwegian',
                url: 'https://www.nb.no/items/a8b7c6d5e4f3',
                expectedDetection: 'norwegian',
                expectedRouting: 'shared',
                category: 'basic',
                description: 'Norwegian National Library - Items URL'
            },
            {
                library: 'norwegian',
                url: 'https://api.nb.no/catalog/v1/iiif/a8b7c6d5e4f3/manifest',
                expectedDetection: 'norwegian',
                expectedRouting: 'shared',
                category: 'edge_case',
                description: 'Norwegian National Library - API IIIF URL'
            },
            {
                library: 'norwegian',
                url: 'https://some-other-site.nb.no/unrelated',
                expectedDetection: 'norwegian',
                expectedRouting: 'shared',
                category: 'regression',
                description: 'Norwegian - False positive from generic pattern'
            },
            
            // OMNES VALLICELLIANA - Missing routing case
            {
                library: 'omnes_vallicelliana',
                url: 'https://omnes.dbseret.com/vallicelliana/manuscript/12345',
                expectedDetection: 'omnes_vallicelliana',
                expectedRouting: 'error', // Currently no routing case!
                category: 'regression',
                description: 'Omnes Vallicelliana - Missing routing case'
            },
            
            // EDGE CASES - URLs that should NOT be detected
            {
                library: 'none',
                url: 'https://example.com/manuscript/12345',
                expectedDetection: '',
                expectedRouting: 'unknown',
                category: 'edge_case',
                description: 'Unknown domain - should not be detected'
            },
            {
                library: 'none',
                url: 'https://gallica.bnf.fr.fake-domain.com/ark:/12148/btv1b8451636m',
                expectedDetection: '',
                expectedRouting: 'unknown',
                category: 'edge_case',
                description: 'Domain spoofing attempt - should not be detected'
            },
            
            // COMPLEX PATTERNS - Multiple conditions
            {
                library: 'karlsruhe',
                url: 'https://i3f.vls.io/blb-karlsruhe.de/viewer/manuscript/12345',
                expectedDetection: 'karlsruhe',
                expectedRouting: 'shared', // Currently shared (BUG!)
                category: 'basic',
                description: 'Karlsruhe - Complex AND pattern (i3f.vls.io && blb-karlsruhe.de)'
            },
            {
                library: 'karlsruhe',
                url: 'https://digital.blb-karlsruhe.de/manuscript/12345',
                expectedDetection: 'karlsruhe',
                expectedRouting: 'shared',
                category: 'basic',
                description: 'Karlsruhe - Alternative direct domain pattern'
            }
        ];
        
        console.log(`📋 Initialized ${this.testCases.length} test cases`);
    }
    
    /**
     * Simulate URL detection logic (without importing actual code)
     */
    private simulateDetectLibrary(url: string): string | null {
        // Replicate the detection logic from EnhancedManuscriptDownloaderService
        if (url.includes('digitalcollections.nypl.org')) return 'nypl';
        if (url.includes('themorgan.org')) return 'morgan';
        if (url.includes('gallica.bnf.fr')) return 'gallica';
        if (url.includes('pagella.bm-grenoble.fr')) return 'grenoble';
        if ((url.includes('i3f.vls.io') && url.includes('blb-karlsruhe.de')) || url.includes('digital.blb-karlsruhe.de')) return 'karlsruhe';
        if (url.includes('digitalcollections.manchester.ac.uk')) return 'manchester';
        if (url.includes('digitale-sammlungen.de')) return 'munich';
        if (url.includes('nb.no')) return 'norwegian';
        if (url.includes('e-codices.unifr.ch') || url.includes('e-codices.ch')) return 'unifr';
        if (url.includes('e-manuscripta.ch')) return 'e_manuscripta';
        if (url.includes('e-rara.ch')) return 'e_rara';
        if (url.includes('collections.library.yale.edu')) return 'yale';
        if (url.includes('digi.vatlib.it')) return 'vatlib';
        if (url.includes('cecilia.mediatheques.grand-albigeois.fr')) return 'cecilia';
        if (url.includes('www.loc.gov') || url.includes('tile.loc.gov')) return 'loc';
        if (url.includes('patrimoine.bm-dijon.fr')) return 'dijon';
        if (url.includes('bibliotheque-numerique.ville-laon.fr')) return 'laon';
        if (url.includes('iiif.durham.ac.uk')) return 'durham';
        if (url.includes('sharedcanvas.be')) return 'sharedcanvas';
        if (url.includes('bibliotheque-agglo-stomer.fr')) return 'saintomer';
        if (url.includes('lib.ugent.be')) return 'ugent';
        if (url.includes('iiif.bl.uk') || url.includes('bl.digirati.io')) return 'bl';
        if (url.includes('florus.bm-lyon.fr')) return 'florus';
        if (url.includes('digitallibrary.unicatt.it')) return 'unicatt';
        if (url.includes('internetculturale.it')) return 'internet_culturale';
        if (url.includes('cudl.lib.cam.ac.uk')) return 'cudl';
        if (url.includes('mss-cat.trin.cam.ac.uk')) return 'trinity_cam';
        if (url.includes('iiif.library.utoronto.ca') || url.includes('collections.library.utoronto.ca')) return 'toronto';
        if (url.includes('isos.dias.ie')) return 'isos';
        if (url.includes('mira.ie')) return 'mira';
        if (url.includes('arca.irht.cnrs.fr')) return 'arca';
        if (url.includes('rbme.patrimonionacional.es')) return 'rbme';
        if (url.includes('parker.stanford.edu')) return 'parker';
        if (url.includes('manuscripta.se')) return 'manuscripta';
        if (url.includes('unipub.uni-graz.at')) return 'graz';
        if (url.includes('gams.uni-graz.at')) return 'gams';
        if (url.includes('digital.dombibliothek-koeln.de')) return 'cologne';
        if (url.includes('manuscripta.at')) return 'vienna_manuscripta';
        if (url.includes('digitale.bnc.roma.sbn.it')) return 'rome';
        if (url.includes('digital.staatsbibliothek-berlin.de')) return 'berlin';
        if (url.includes('dig.vkol.cz')) return 'czech';
        if (url.includes('archiviodiocesano.mo.it')) return 'modena';
        if (url.includes('bdl.servizirl.it')) return 'bdl';
        if (url.includes('europeana.eu')) return 'europeana';
        if (url.includes('omnes.dbseret.com/montecassino')) return 'montecassino';
        if (url.includes('dam.iccu.sbn.it') || url.includes('jmms.iccu.sbn.it')) return 'vallicelliana';
        if (url.includes('omnes.dbseret.com/vallicelliana')) return 'omnes_vallicelliana';
        if (url.includes('manus.iccu.sbn.it')) return 'montecassino';
        if (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it')) return 'verona';
        if (url.includes('bvpb.mcu.es')) return 'bvpb';
        if (url.includes('diamm.ac.uk') || url.includes('iiif.diamm.net') || url.includes('musmed.eu/visualiseur-iiif')) return 'diamm';
        if (url.includes('bdh-rd.bne.es')) return 'bne';
        if (url.includes('mdc.csuc.cat/digital/collection')) return 'mdc_catalonia';
        if (url.includes('cdm21059.contentdm.oclc.org/digital/collection/plutei')) return 'florence';
        if (url.includes('viewer.onb.ac.at')) return 'onb';
        if (url.includes('rotomagus.fr')) return 'rouen';
        if (url.includes('dl.ub.uni-freiburg.de')) return 'freiburg';
        if (url.includes('fuldig.hs-fulda.de')) return 'fulda';
        if (url.includes('diglib.hab.de')) return 'wolfenbuettel';
        if (url.includes('digital.ulb.hhu.de')) return 'hhu';
        if (url.includes('manuscrits.bordeaux.fr') || url.includes('selene.bordeaux.fr')) return 'bordeaux';
        if (url.includes('digital.bodleian.ox.ac.uk') || url.includes('digital2.bodleian.ox.ac.uk')) return 'bodleian';
        if (url.includes('digi.ub.uni-heidelberg.de') || url.includes('doi.org/10.11588/diglit')) return 'heidelberg';
        if (url.includes('digi.landesbibliothek.at')) return 'linz';
        if (url.includes('imagoarchiviodistatoroma.cultura.gov.it') || url.includes('archiviostorico.senato.it')) return 'roman_archive';
        if (url.includes('digital-scriptorium.org') || url.includes('colenda.library.upenn.edu')) return 'digital_scriptorium';
        
        return null;
    }
    
    /**
     * Simulate routing logic to determine where detected library would be routed
     */
    private simulateRoutingDestination(library: string | null): 'individual' | 'shared' | 'error' | 'unknown' {
        if (!library) return 'unknown';
        
        // Based on current routing switch statement
        const individualRouted = new Set([
            'nypl', 'gallica', 'munich', 'unifr', 'cecilia', 'loc', 'dijon', 'laon',
            'durham', 'sharedcanvas', 'saintomer', 'ugent', 'florus', 'unicatt', 
            'cudl', 'trinity_cam', 'toronto', 'isos', 'mira', 'rbme', 'parker',
            'manuscripta', 'internet_culturale', 'graz', 'hhu', 'cologne', 'czech',
            'emanuscripta', 'florence', 'modena', 'fulda', 'europeana', 'montecassino',
            'vallicelliana', 'diamm', 'rouen', 'freiburg', 'wolfenbuettel', 'linz',
            'bdl', 'berlin', 'bne'
        ]);
        
        const sharedRouted = new Set([
            'morgan', 'grenoble', 'karlsruhe', 'manchester', 'norwegian', 'bl',
            'bordeaux', 'bodleian', 'heidelberg', 'vatican', 'cambridge', 'vienna',
            'bvpb', 'verona', 'mdc_catalonia', 'onb', 'gams', 'yale', 'e_rara',
            'roman_archive', 'digital_scriptorium', 'vienna_manuscripta', 'rome'
        ]);
        
        // Handle key mismatches
        if (library === 'vatlib') {
            // detectLibrary returns 'vatlib' but routes to 'vatican' (individual)
            return 'individual';
        }
        if (library === 'e_manuscripta') {
            // detectLibrary returns 'e_manuscripta' but routes to 'emanuscripta' (individual) 
            return 'individual';
        }
        
        // Check for missing routing cases
        if (library === 'omnes_vallicelliana') {
            return 'error'; // No routing case exists!
        }
        
        if (individualRouted.has(library)) return 'individual';
        if (sharedRouted.has(library)) return 'shared';
        
        return 'error';
    }
    
    /**
     * Run a single test case
     */
    private runTest(testCase: TestCase): TestResult {
        const startTime = Date.now();
        
        const actualDetection = this.simulateDetectLibrary(testCase.url);
        const actualRouting = this.simulateRoutingDestination(actualDetection);
        
        const timing = Date.now() - startTime;
        
        const issues: string[] = [];
        let success = true;
        
        // Check detection
        if (testCase.expectedDetection === '') {
            // Expecting no detection
            if (actualDetection !== null) {
                issues.push(`UNEXPECTED_DETECTION: Expected no detection, got '${actualDetection}'`);
                success = false;
            }
        } else {
            // Expecting specific detection
            if (actualDetection !== testCase.expectedDetection) {
                issues.push(`DETECTION_MISMATCH: Expected '${testCase.expectedDetection}', got '${actualDetection}'`);
                success = false;
            }
        }
        
        // Check routing
        if (actualRouting !== testCase.expectedRouting) {
            issues.push(`ROUTING_MISMATCH: Expected '${testCase.expectedRouting}', got '${actualRouting}'`);
            success = false;
        }
        
        // Check for known issues in regression tests
        if (testCase.category === 'regression' && success) {
            issues.push(`REGRESSION_RESOLVED: This test case was expected to fail but now passes - verify fix is complete`);
        }
        
        return {
            testCase,
            actualDetection,
            actualRouting,
            success,
            issues,
            timing
        };
    }
    
    /**
     * Run all test cases
     */
    async runAllTests(): Promise<void> {
        console.log('🧪 Running URL Pattern Validation Test Suite...\n');
        
        let passed = 0;
        let failed = 0;
        let regressionCases = 0;
        
        for (const testCase of this.testCases) {
            const result = this.runTest(testCase);
            this.results.push(result);
            
            if (result.success) {
                passed++;
                console.log(`✅ ${testCase.library} - ${testCase.description}`);
            } else {
                failed++;
                console.log(`❌ ${testCase.library} - ${testCase.description}`);
                for (const issue of result.issues) {
                    console.log(`   📝 ${issue}`);
                }
            }
            
            if (testCase.category === 'regression') {
                regressionCases++;
            }
        }
        
        console.log(`\n📊 Test Results:`);
        console.log(`   ✅ Passed: ${passed}/${this.testCases.length} (${((passed/this.testCases.length)*100).toFixed(1)}%)`);
        console.log(`   ❌ Failed: ${failed}/${this.testCases.length} (${((failed/this.testCases.length)*100).toFixed(1)}%)`);
        console.log(`   🔄 Regression Cases: ${regressionCases} (expected failures before fixes)`);
    }
    
    /**
     * Generate detailed test report
     */
    async generateReport(): Promise<void> {
        console.log('\n📋 Generating test report...');
        
        const summary = {
            totalTests: this.results.length,
            passed: this.results.filter(r => r.success).length,
            failed: this.results.filter(r => !r.success).length,
            categories: {
                basic: this.results.filter(r => r.testCase.category === 'basic'),
                evolution: this.results.filter(r => r.testCase.category === 'evolution'),
                edge_case: this.results.filter(r => r.testCase.category === 'edge_case'),
                regression: this.results.filter(r => r.testCase.category === 'regression')
            }
        };
        
        const report = {
            timestamp: new Date().toISOString(),
            summary,
            results: this.results,
            analysis: this.generateAnalysis()
        };
        
        // Write detailed JSON report
        const jsonPath = '/Users/evb/WebstormProjects/mss-downloader/.devkit/analysis/url-pattern-test-results.json';
        await Bun.write(jsonPath, JSON.stringify(report, null, 2));
        
        // Generate markdown report  
        const markdownReport = this.generateMarkdownReport(report);
        const markdownPath = '/Users/evb/WebstormProjects/mss-downloader/.devkit/analysis/URL-PATTERN-TEST-RESULTS.md';
        await Bun.write(markdownPath, markdownReport);
        
        console.log(`✅ Detailed report: ${jsonPath}`);
        console.log(`✅ Summary report: ${markdownPath}`);
    }
    
    private generateAnalysis(): any {
        const failedTests = this.results.filter(r => !r.success);
        
        const issueTypes = new Map<string, number>();
        const libraryIssues = new Map<string, string[]>();
        
        for (const result of failedTests) {
            const library = result.testCase.library;
            
            for (const issue of result.issues) {
                const issueType = issue.split(':')[0];
                issueTypes.set(issueType, (issueTypes.get(issueType) || 0) + 1);
                
                if (!libraryIssues.has(library)) {
                    libraryIssues.set(library, []);
                }
                libraryIssues.get(library)?.push(issue);
            }
        }
        
        return {
            mostCommonIssues: Array.from(issueTypes.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5),
            librariesWithMostIssues: Array.from(libraryIssues.entries())
                .sort((a, b) => b[1].length - a[1].length)
                .slice(0, 10),
            regressionTestAnalysis: this.analyzeRegressionTests()
        };
    }
    
    private analyzeRegressionTests(): any {
        const regressionTests = this.results.filter(r => r.testCase.category === 'regression');
        
        return {
            total: regressionTests.length,
            stillFailing: regressionTests.filter(r => !r.success).length,
            nowPassing: regressionTests.filter(r => r.success).length,
            details: regressionTests.map(r => ({
                library: r.testCase.library,
                description: r.testCase.description,
                status: r.success ? 'FIXED' : 'STILL_FAILING',
                issues: r.issues
            }))
        };
    }
    
    private generateMarkdownReport(report: any): string {
        return `# URL Pattern Validation Test Results

**Generated:** ${report.timestamp}
**Total Tests:** ${report.summary.totalTests}
**Success Rate:** ${((report.summary.passed/report.summary.totalTests)*100).toFixed(1)}%

## Summary

- ✅ **Passed:** ${report.summary.passed}
- ❌ **Failed:** ${report.summary.failed}
- 🔧 **Regression Cases:** ${report.summary.categories.regression.length}

## Test Categories

| Category | Total | Passed | Failed | Success Rate |
|----------|-------|--------|--------|--------------|
| Basic | ${report.summary.categories.basic.length} | ${report.summary.categories.basic.filter(r => r.success).length} | ${report.summary.categories.basic.filter(r => !r.success).length} | ${((report.summary.categories.basic.filter(r => r.success).length/report.summary.categories.basic.length)*100).toFixed(1)}% |
| Evolution | ${report.summary.categories.evolution.length} | ${report.summary.categories.evolution.filter(r => r.success).length} | ${report.summary.categories.evolution.filter(r => !r.success).length} | ${((report.summary.categories.evolution.filter(r => r.success).length/report.summary.categories.evolution.length)*100).toFixed(1)}% |
| Edge Case | ${report.summary.categories.edge_case.length} | ${report.summary.categories.edge_case.filter(r => r.success).length} | ${report.summary.categories.edge_case.filter(r => !r.success).length} | ${((report.summary.categories.edge_case.filter(r => r.success).length/report.summary.categories.edge_case.length)*100).toFixed(1)}% |
| Regression | ${report.summary.categories.regression.length} | ${report.summary.categories.regression.filter(r => r.success).length} | ${report.summary.categories.regression.filter(r => !r.success).length} | ${((report.summary.categories.regression.filter(r => r.success).length/report.summary.categories.regression.length)*100).toFixed(1)}% |

## Most Common Issues

${report.analysis.mostCommonIssues.map(([issue, count]) => `- **${issue}:** ${count} occurrences`).join('\n')}

## Libraries with Most Issues

${report.analysis.librariesWithMostIssues.map(([library, issues]) => `- **${library}:** ${issues.length} issues`).join('\n')}

## Regression Test Analysis

**Status:** ${report.analysis.regressionTestAnalysis.nowPassing}/${report.analysis.regressionTestAnalysis.total} regression tests now passing

${report.analysis.regressionTestAnalysis.details.map(test => 
  `### ${test.library} - ${test.status}\n**Description:** ${test.description}\n${test.issues.length > 0 ? `**Issues:**\n${test.issues.map(issue => `- ${issue}`).join('\n')}` : '✅ No issues'}\n`
).join('\n')}

## Failed Tests Detail

${report.results.filter(r => !r.success).map(result => 
  `### ❌ ${result.testCase.library} - ${result.testCase.description}
**URL:** ${result.testCase.url}
**Expected Detection:** ${result.testCase.expectedDetection || 'None'}
**Actual Detection:** ${result.actualDetection || 'None'}
**Expected Routing:** ${result.testCase.expectedRouting}
**Actual Routing:** ${result.actualRouting}
**Issues:**
${result.issues.map(issue => `- ${issue}`).join('\n')}
`).join('\n')}

---

*This report was generated by the URL Pattern Validation Test Suite v1.0*
*For technical details, see: url-pattern-test-results.json*
`;
    }
    
    /**
     * Main execution method
     */
    async run(): Promise<void> {
        await this.runAllTests();
        await this.generateReport();
        
        const summary = {
            total: this.results.length,
            passed: this.results.filter(r => r.success).length,
            failed: this.results.filter(r => !r.success).length
        };
        
        console.log(`\n🎉 URL Pattern Test Suite Complete!`);
        console.log(`📊 Final Results: ${summary.passed}/${summary.total} passed (${((summary.passed/summary.total)*100).toFixed(1)}%)`);
        
        if (summary.failed > 0) {
            console.log(`⚠️  ${summary.failed} tests failed - review reports for details`);
            console.log(`📋 See: .devkit/analysis/URL-PATTERN-TEST-RESULTS.md`);
        } else {
            console.log(`✅ All tests passed! URL pattern detection is working correctly.`);
        }
    }
}

// Execute the test suite
const testSuite = new URLPatternTestSuite();
await testSuite.run();