// Test DIAMM URL detection logic
const testUrls = [
    'https://musmed.eu/visualiseur-iiif?manifest=https%3A%2F%2Fiiif.diamm.net%2Fmanifests%2FI-Rc-Ms-1907%2Fmanifest.json',
    'https://musmed.eu/visualiseur-iiif?manifest=https%3A%2F%2Fiiif.diamm.net%2Fmanifests%2FI-Ra-Ms1383%2Fmanifest.json',
    'https://iiif.diamm.net/manifests/I-Rc-Ms-1574/manifest.json',
    'https://iiif.diamm.net/manifests/I-Rv-C_32/manifest.json'
];

// Copy of the detectLibrary logic for testing
function detectLibrary(url) {
    // Check for unsupported libraries first
    if (url.includes('digitalcollections.tcd.ie')) {
        throw new Error('Trinity College Dublin is not currently supported due to aggressive captcha protection. Please download manuscripts manually through their website.');
    }
    
    if (url.includes('digitalcollections.nypl.org')) return 'nypl';
    if (url.includes('themorgan.org')) return 'morgan';
    if (url.includes('gallica.bnf.fr')) return 'gallica';
    if (url.includes('e-codices.unifr.ch') || url.includes('e-codices.ch')) return 'unifr';
    if (url.includes('e-manuscripta.ch')) return 'e_manuscripta';
    if (url.includes('digi.vatlib.it')) return 'vatlib';
    if (url.includes('cecilia.mediatheques.grand-albigeois.fr')) return 'cecilia';
    if (url.includes('arca.irht.cnrs.fr')) return 'irht';
    if (url.includes('patrimoine.bm-dijon.fr')) return 'dijon';
    if (url.includes('bibliotheque-numerique.ville-laon.fr')) return 'laon';
    if (url.includes('iiif.durham.ac.uk')) return 'durham';
    if (url.includes('sharedcanvas.be')) return 'sharedcanvas';
    if (url.includes('lib.ugent.be')) return 'ugent';
    if (url.includes('iiif.bl.uk') || url.includes('bl.digirati.io')) return 'bl';
    if (url.includes('florus.bm-lyon.fr')) return 'florus';
    if (url.includes('digitallibrary.unicatt.it')) return 'unicatt';
    if (url.includes('internetculturale.it')) return 'internet_culturale';
    if (url.includes('cudl.lib.cam.ac.uk')) return 'cudl';
    if (url.includes('mss-cat.trin.cam.ac.uk')) return 'trinity_cam';
    if (url.includes('isos.dias.ie')) return 'isos';
    if (url.includes('mira.ie')) return 'mira';
    if (url.includes('mediatheques.orleans.fr') || url.includes('aurelia.orleans.fr')) return 'orleans';
    if (url.includes('rbme.patrimonionacional.es')) return 'rbme';
    if (url.includes('parker.stanford.edu')) return 'parker';
    if (url.includes('manuscripta.se')) return 'manuscripta';
    if (url.includes('unipub.uni-graz.at')) return 'graz';
    if (url.includes('digital.dombibliothek-koeln.de')) return 'cologne';
    if (url.includes('manuscripta.at')) return 'vienna_manuscripta';
    if (url.includes('digitale.bnc.roma.sbn.it')) return 'rome';
    if (url.includes('digital.staatsbibliothek-berlin.de')) return 'berlin';
    if (url.includes('dig.vkol.cz')) return 'czech';
    if (url.includes('archiviodiocesano.mo.it')) return 'modena';
    if (url.includes('bdl.servizirl.it')) return 'bdl';
    if (url.includes('europeana.eu')) return 'europeana';
    if (url.includes('manus.iccu.sbn.it') || url.includes('omnes.dbseret.com/montecassino')) return 'monte_cassino';
    if (url.includes('dam.iccu.sbn.it') || url.includes('jmms.iccu.sbn.it')) return 'vallicelliana';
    if (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it')) return 'verona';
    if (url.includes('diamm.ac.uk') || url.includes('iiif.diamm.net') || url.includes('musmed.eu/visualiseur-iiif')) return 'diamm';
    
    return null;
}

console.log('🔍 Testing DIAMM URL detection...');

let allPassed = true;

testUrls.forEach((url, index) => {
    console.log(`\n📋 Testing URL ${index + 1}/${testUrls.length}:`);
    console.log(`   ${url}`);
    
    const detected = detectLibrary(url);
    
    if (detected === 'diamm') {
        console.log('✅ DIAMM correctly detected');
    } else {
        console.log(`❌ Wrong library detected: ${detected}`);
        allPassed = false;
    }
});

if (allPassed) {
    console.log('\n🎉 All URL detection tests passed!');
    console.log('✅ DIAMM URL detection is working correctly');
} else {
    console.log('\n❌ Some URL detection tests failed');
    process.exit(1);
}

// Test manifest URL extraction
console.log('\n🔍 Testing manifest URL extraction...');

function extractManifestUrl(url) {
    let manifestUrl;
    
    if (url.includes('musmed.eu/visualiseur-iiif')) {
        const urlParams = new URLSearchParams(url.split('?')[1]);
        const encodedManifest = urlParams.get('manifest');
        if (!encodedManifest) {
            throw new Error('No manifest parameter found in DIAMM viewer URL');
        }
        manifestUrl = decodeURIComponent(encodedManifest);
    } else if (url.includes('iiif.diamm.net/manifests/')) {
        manifestUrl = url;
    } else {
        throw new Error('Unsupported DIAMM URL format');
    }
    
    return manifestUrl;
}

testUrls.forEach((url, index) => {
    try {
        const manifestUrl = extractManifestUrl(url);
        console.log(`✅ URL ${index + 1}: ${manifestUrl}`);
    } catch (error) {
        console.log(`❌ URL ${index + 1}: ${error.message}`);
        allPassed = false;
    }
});

if (allPassed) {
    console.log('\n🎉 All manifest extraction tests passed!');
    console.log('✅ DIAMM implementation is ready');
} else {
    console.log('\n❌ Some manifest extraction tests failed');
    process.exit(1);
}