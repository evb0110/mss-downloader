const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');

// All libraries found in the logs
const librariesToTest = {
    // From logs - working
    loc: 'https://www.loc.gov/item/2023698924/',
    duesseldorf: 'https://digital.ulb.hhu.de/hs/content/structure/443907',
    vallicelliana: 'https://opac.vallicelliana.it/bav_view.php?urn=urn:nbn:it:bav-0000-004-01A2-F',
    
    // From logs - had errors
    verona: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15',
    morgan: 'https://www.themorgan.org/collection/lindau-gospels/thumbs',
    graz: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
    
    // Other libraries mentioned in code - need testing
    gallica: 'https://gallica.bnf.fr/ark:/12148/btv1b10500001g',
    grenoble: 'https://pagella.bm-grenoble.fr/BMG/doc/SYRACUSE/7177',
    karlsruhe: 'https://digital.blb-karlsruhe.de/id/4299854',
    manchester: 'https://www.digitalcollections.manchester.ac.uk/view/MS-LATIN-00098',
    unifr: 'https://www.e-codices.unifr.ch/en/list/one/bge/lat0027',
    vatlib: 'https://digi.vatlib.it/view/MSS_Reg.lat.15',
    cecilia: 'https://cecilia.mediatheques.grand-albigeois.fr/viewer/124/',
    irht: 'https://bvmm.irht.cnrs.fr/mirador/?iiif-content=https://bvmm.irht.cnrs.fr/iiif/5228/manifest',
    dijon: 'https://patrimoine.bm-dijon.fr/ui/notice/319637',
    laon: 'https://manuscrits-patrimoine.laon.fr/s/manuscrits/ark:/15472/382b2b91-cd3f-497b-87a6-3c09e97cf58a',
    durham: 'https://iiif.durham.ac.uk/index.html?manifest=t1m0g354f39w',
    florus: 'https://florus-project.univ-lyon3.fr/visualisation/doc/Codices/codex-3',
    cudl: 'https://cudl.lib.cam.ac.uk/view/MS-ADD-03970',
    trinity_cam: 'https://mss-cat.trin.cam.ac.uk/manuscripts/uv/view.php?n=B.5.5',
    toronto: 'https://collections.library.utoronto.ca/view/fisher:F12090',
    isos: 'https://www.isos.dias.ie/english/index.html?ref=https://www.dias.ie/celt/celt-publications-2/manuscript-catalogue/b/book-of-ballymote/',
    mira: 'https://mira.bodleian.ox.ac.uk/objects/5e5c6e4f-85fb-4a13-b99d-c8bb0b87b7c6/',
    orleans: 'https://mediatheques.orleans.fr/recherche/viewnotice/clef/FRAGMENTSDEDIFFERENTSLIVRESDELECRITURESAINTE--AUGUSTINSAINT----28/id/745380',
    rbme: 'https://rbme.patrimonionacional.es/ms-II-218',
    parker: 'https://parker.stanford.edu/parker/catalog/kx416nd2081',
    manuscripta: 'https://www.manuscripta.se/ms/100206',
    internet_culturale: 'https://www.internetculturale.it/viewmanoscritto/oai%3Awww.internetculturale.sbn.it%2FTeca%3A20%3ANT0000%3AIT%5C%5CICCU%5C%5CNAP%5C%5C0074416',
    cologne: 'https://digital.dombibliothek-koeln.de/hs/content/pageview/2267899',
    vienna_manuscripta: 'https://manuscripta.at/hs_detail.php?ID=33924',
    rome: 'https://manus.iccu.sbn.it/opac_SchedaScheda.php?ID=254903',
    berlin: 'https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN688813658',
    czech: 'https://www.manuscriptorium.com/apps/index.php?direct=record&pid=AIPDIG-NMP__10_C_136______3BF5NLP-cs',
    modena: 'https://archiviodiocesano.mo.it/archivio/flip/ACMo-OI-7/',
    bdl: 'https://www.bdl.servizirl.it/bdl/bookreader/IT-BDL-0000000000-BDL-OGGETTO-11604?locale=it',
    europeana: 'https://www.europeana.eu/en/item/2048442/item_PKLHU4MFYR7HFHKLMXJFVTTO2VXZJWVG',
    monte_cassino: 'https://www.montecastello.org/biblioteca/digitale/manuscript/123',
    diamm: 'https://www.diamm.ac.uk/sources/4264/',
    bne: 'https://bdh-rd.bne.es/viewer.vm?id=0000008456',
    mdc_catalonia: 'https://mdc.csuc.cat/digital/collection/manuscritBC/id/46605',
    bvpb: 'https://bvpb.mcu.es/es/consulta/registro.do?id=451006',
    florence: 'https://teca.bmlonline.it/digital/collection/plutei/id/263',
    onb: 'https://digital.onb.ac.at/RepViewer/viewer.faces?doc=DTL_3133459',
    rouen: 'https://www.rouen.fr/bibliotheques/patrimoine/manuscrit/U-004',
    freiburg: 'https://dl.ub.uni-freiburg.de/diglit/hs48',
    sharedcanvas: 'https://example.com/sharedcanvas/manifest',
    saint_omer: 'https://bibliotheque-numerique.bibliotheque-agglo-stomer.fr/idurl/1/15416',
    ugent: 'https://lib.ugent.be/viewer/archive.ugent.be%3A1874A832-B1E9-11DF-A2E0-A70579F64438',
    bl: 'https://www.bl.uk/manuscripts/FullDisplay.aspx?ref=Royal_MS_20_A_II',
    wolfenbuettel: 'https://diglib.hab.de/mss/23-aug-4f/start.htm',
    belgica_kbr: 'https://belgica.kbr.be/belgica/SearchMinervaMWB/DoSearch.aspx?SearchDescr=9066'
};

async function testManifestLoading(libraryId, url) {
    try {
        const loader = new SharedManifestLoaders();
        console.log(`Testing ${libraryId}...`);
        
        const startTime = Date.now();
        const manifest = await loader.getManifestForLibrary(libraryId, url);
        const loadTime = Date.now() - startTime;
        
        return {
            library: libraryId,
            url: url,
            success: true,
            loadTime: loadTime,
            pages: manifest.images ? manifest.images.length : 0,
            displayName: manifest.displayName || 'N/A',
            error: null
        };
    } catch (error) {
        return {
            library: libraryId,
            url: url,
            success: false,
            loadTime: 0,
            pages: 0,
            displayName: 'N/A',
            error: error.message
        };
    }
}

async function runTests() {
    console.log('Testing all libraries found in code and logs...\n');
    
    const results = [];
    const supportedBySharedLoader = [
        'bdl', 'verona', 'vienna_manuscripta', 'bne', 'mdc_catalonia', 
        'florence', 'grenoble', 'manchester', 'toronto', 'vatican', 
        'karlsruhe', 'loc', 'graz', 'bvpb'
    ];
    
    // Test only libraries supported by SharedManifestLoaders
    for (const [libraryId, url] of Object.entries(librariesToTest)) {
        if (supportedBySharedLoader.includes(libraryId)) {
            const result = await testManifestLoading(libraryId, url);
            results.push(result);
            
            // Brief pause between tests
            await new Promise(resolve => setTimeout(resolve, 500));
        } else {
            results.push({
                library: libraryId,
                url: url,
                success: 'N/A',
                loadTime: 0,
                pages: 0,
                displayName: 'N/A',
                error: 'Not supported by SharedManifestLoaders'
            });
        }
    }
    
    // Generate report
    console.log('\n=== TEST RESULTS ===\n');
    
    const working = results.filter(r => r.success === true);
    const failing = results.filter(r => r.success === false);
    const notSupported = results.filter(r => r.success === 'N/A');
    
    console.log(`WORKING LIBRARIES (${working.length}):`);
    working.forEach(r => {
        console.log(`✅ ${r.library} - ${r.pages} pages loaded in ${r.loadTime}ms`);
    });
    
    console.log(`\nFAILING LIBRARIES (${failing.length}):`);
    failing.forEach(r => {
        console.log(`❌ ${r.library} - ${r.error}`);
    });
    
    console.log(`\nNOT TESTED (${notSupported.length}) - Not supported by SharedManifestLoaders:`);
    notSupported.forEach(r => {
        console.log(`⚠️  ${r.library}`);
    });
    
    // Save detailed report
    const reportPath = path.join(__dirname, 'library-test-results.json');
    await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
    console.log(`\nDetailed results saved to: ${reportPath}`);
    
    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total libraries tested: ${librariesToTest.length}`);
    console.log(`Working: ${working.length}`);
    console.log(`Failing: ${failing.length}`);
    console.log(`Not supported by SharedManifestLoaders: ${notSupported.length}`);
    
    return results;
}

// Run the tests
runTests().catch(console.error);