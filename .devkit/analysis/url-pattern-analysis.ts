/**
 * URL Pattern Analysis for Todo #10
 * Ultra-Deep Analysis of Library URL Detection Pattern Evolution
 */

interface URLTestCase {
    url: string;
    expectedLibrary: string;
    issueNumber?: number;
    status: 'working' | 'broken' | 'unknown';
    notes?: string;
}

interface LibraryPattern {
    library: string;
    currentPatterns: string[];
    newPatternsNeeded?: string[];
    issues: string[];
}

const URL_TEST_CASES: URLTestCase[] = [
    // BROKEN CASES FROM GITHUB ISSUES
    {
        url: 'https://admont.codices.at/codices/169/90299',
        expectedLibrary: 'codices_admont',
        issueNumber: 57,
        status: 'broken',
        notes: 'New library - Codices Admont not supported'
    },
    {
        url: 'https://ambrosiana.comperio.it/opac/detail/view/ambro:catalog:76502',
        expectedLibrary: 'ambrosiana',
        issueNumber: 54,
        status: 'broken',
        notes: 'Ambrosiana library detection broken'
    },
    {
        url: 'https://cudl.lib.cam.ac.uk/view/MS-II-00006-00032/1',
        expectedLibrary: 'cudl',
        issueNumber: 53,
        status: 'broken',
        notes: 'Cambridge CUDL downloads failing'
    },
    {
        url: 'https://manuscripta.at/diglit/AT5000-1013/0001',
        expectedLibrary: 'vienna_manuscripta',
        issueNumber: 52,
        status: 'broken',
        notes: 'Vienna Manuscripta detection failing'
    },
    {
        url: 'https://www.bdl.servizirl.it/vufind/Record/BDL-OGGETTO-4040',
        expectedLibrary: 'bdl',
        issueNumber: 51,
        status: 'broken',
        notes: 'BDL downloads hang on PDF save'
    },
    {
        url: 'https://manus.iccu.sbn.it/risultati-ricerca-manoscritti/-/manus-search/cnmd/0000016076',
        expectedLibrary: 'iccu_api',
        issueNumber: 50,
        status: 'broken',
        notes: 'ICCU new URL format not supported'
    },
    {
        url: 'https://www.europeana.eu/en/item/446/CNMD_0000171876',
        expectedLibrary: 'europeana',
        issueNumber: 48,
        status: 'broken',
        notes: 'Europeana detection failing'
    },
    {
        url: 'https://musmed.eu/visualiseur-iiif?manifest=https%3A%2F%2Fiiif.diamm.net%2Fmanifests%2FI-Rc-Ms-1907%2Fmanifest.json',
        expectedLibrary: 'diamm',
        issueNumber: 47,
        status: 'broken',
        notes: 'DIAMM infinite recursion error'
    },
    {
        url: 'https://dl.ub.uni-freiburg.de/diglit/hs24/0001',
        expectedLibrary: 'freiburg',
        issueNumber: 46,
        status: 'broken',
        notes: 'Freiburg detection failing'
    },
    {
        url: 'https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=22211',
        expectedLibrary: 'bvpb',
        issueNumber: 45,
        status: 'broken',
        notes: 'BVPB URL format not supported'
    },
    {
        url: 'https://www.rotomagus.fr/ark:/12148/btv1b10052442z/f1.item.zoom',
        expectedLibrary: 'rouen',
        issueNumber: 44,
        status: 'broken',
        notes: 'Rouen detection failing'
    },
    {
        url: 'https://pagella.bm-grenoble.fr/ark:/12148/btv1b106634178/f3.item.zoom',
        expectedLibrary: 'grenoble',
        issueNumber: 43,
        status: 'broken',
        notes: 'Grenoble server returns 429 Too Many Requests'
    },
    {
        url: 'https://fuldig.hs-fulda.de/viewer/image/PPN314754709/',
        expectedLibrary: 'fulda',
        issueNumber: 42,
        status: 'broken',
        notes: 'Fulda detection failing'
    },
    {
        url: 'https://diglib.hab.de/wdb.php?dir=mss/1008-helmst',
        expectedLibrary: 'wolfenbuettel',
        issueNumber: 40,
        status: 'broken',
        notes: 'Wolfenbuettel detection failing'
    },
    {
        url: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/217923/rec/2',
        expectedLibrary: 'florence',
        issueNumber: 39,
        status: 'broken',
        notes: 'Florence hangs on calculation'
    },
    {
        url: 'https://www.thedigitalwalters.org/Data/WaltersManuscripts/html/W33/',
        expectedLibrary: 'walters',
        issueNumber: 38,
        status: 'broken',
        notes: 'New library - Digital Walters not supported'
    },
    {
        url: 'https://digi.landesbibliothek.at/viewer/image/154/',
        expectedLibrary: 'linz',
        issueNumber: 37,
        status: 'broken',
        notes: 'Linz downloads restart, no chunking'
    },
    {
        url: 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778',
        expectedLibrary: 'bordeaux',
        issueNumber: 6,
        status: 'broken',
        notes: 'Bordeaux new library needed - zoom tiles'
    },
    {
        url: 'https://www.themorgan.org/collection/lindau-gospels/thumbs',
        expectedLibrary: 'morgan',
        issueNumber: 4,
        status: 'broken',
        notes: 'Morgan Library ReferenceError'
    }
];

const CURRENT_LIBRARY_PATTERNS: LibraryPattern[] = [
    {
        library: 'vienna_manuscripta',
        currentPatterns: ['manuscripta.at'],
        issues: ['Issue #52: Detection failing for manuscripta.at URLs']
    },
    {
        library: 'iccu_api', 
        currentPatterns: ['manus.iccu.sbn.it'],
        issues: ['Issue #50: New URL format not supported']
    },
    {
        library: 'europeana',
        currentPatterns: ['europeana.eu'],
        issues: ['Issue #48: Detection returning wrong result']
    },
    {
        library: 'diamm',
        currentPatterns: ['diamm.ac.uk', 'iiif.diamm.net', 'musmed.eu/visualiseur-iiif'],
        issues: ['Issue #47: Infinite recursion on musmed.eu URLs']
    },
    {
        library: 'freiburg',
        currentPatterns: ['dl.ub.uni-freiburg.de'],
        issues: ['Issue #46: Detection failing']
    },
    {
        library: 'bvpb',
        currentPatterns: ['bvpb.mcu.es'],
        issues: ['Issue #45: New URL format with path parameters']
    },
    {
        library: 'rouen',
        currentPatterns: ['rotomagus.fr'],
        issues: ['Issue #44: Detection failing']
    },
    {
        library: 'fulda',
        currentPatterns: ['fuldig.hs-fulda.de'],
        issues: ['Issue #42: Detection failing']
    },
    {
        library: 'wolfenbuettel',
        currentPatterns: ['diglib.hab.de'],
        issues: ['Issue #40: Detection failing']
    },
    {
        library: 'morgan',
        currentPatterns: ['themorgan.org'],
        issues: ['Issue #4: ReferenceError on specific URL patterns']
    }
];

/**
 * Analysis functions to test current URL detection
 */
function testCurrentDetection(url: string): string | null {
    // Simulate current detectLibrary logic from EnhancedManuscriptDownloaderService
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
    if (url.includes('bibliotheque-agglo-stomer.fr')) return 'saint_omer';
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
    if (url.includes('omnes.dbseret.com/montecassino')) return 'monte_cassino';
    if (url.includes('dam.iccu.sbn.it') || url.includes('jmms.iccu.sbn.it')) return 'vallicelliana';
    if (url.includes('omnes.dbseret.com/vallicelliana')) return 'omnes_vallicelliana';
    if (url.includes('manus.iccu.sbn.it')) return 'iccu_api';
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
 * Run analysis on all test cases
 */
function runURLAnalysis(): void {
    console.log('=== URL PATTERN ANALYSIS FOR TODO #10 ===\n');
    
    let workingCount = 0;
    let brokenCount = 0;
    let missingLibraries: string[] = [];
    
    for (const testCase of URL_TEST_CASES) {
        const detected = testCurrentDetection(testCase.url);
        const matches = detected === testCase.expectedLibrary;
        
        console.log(`\n🔍 Testing: ${testCase.url}`);
        console.log(`   Expected: ${testCase.expectedLibrary}`);
        console.log(`   Detected: ${detected || 'null'}`);
        console.log(`   Status: ${matches ? '✅ MATCH' : '❌ MISMATCH'}`);
        if (testCase.issueNumber) {
            console.log(`   Issue: #${testCase.issueNumber}`);
        }
        if (testCase.notes) {
            console.log(`   Notes: ${testCase.notes}`);
        }
        
        if (matches && testCase.status !== 'broken') {
            workingCount++;
        } else {
            brokenCount++;
            if (!detected && !missingLibraries.includes(testCase.expectedLibrary)) {
                missingLibraries.push(testCase.expectedLibrary);
            }
        }
    }
    
    console.log('\n=== ANALYSIS SUMMARY ===');
    console.log(`✅ Working patterns: ${workingCount}`);
    console.log(`❌ Broken patterns: ${brokenCount}`);
    console.log(`📋 Total tested: ${URL_TEST_CASES.length}`);
    
    if (missingLibraries.length > 0) {
        console.log('\n🚨 LIBRARIES WITH NO DETECTION:');
        missingLibraries.forEach(lib => console.log(`   - ${lib}`));
    }
    
    console.log('\n🔧 CRITICAL FIXES NEEDED:');
    CURRENT_LIBRARY_PATTERNS.forEach(pattern => {
        if (pattern.issues.length > 0) {
            console.log(`\n📚 ${pattern.library}:`);
            console.log(`   Current patterns: ${pattern.currentPatterns.join(', ')}`);
            pattern.issues.forEach(issue => console.log(`   ⚠️  ${issue}`));
        }
    });
    
    console.log('\n=== RECOMMENDED ACTIONS ===');
    console.log('1. Fix URL detection for broken libraries');
    console.log('2. Add support for new libraries (Codices, Walters, etc.)');
    console.log('3. Update URL patterns for changed library systems');
    console.log('4. Add comprehensive URL validation tests');
    console.log('5. Implement backward compatibility checks');
}

// Run the analysis
runURLAnalysis();

export { URL_TEST_CASES, CURRENT_LIBRARY_PATTERNS, testCurrentDetection };