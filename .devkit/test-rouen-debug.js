const fetch = require('node-fetch');

async function testRouenManifest() {
    const manuscriptId = 'btv1b10052442z';
    const manifestUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/manifest.json`;
    
    console.log(`Fetching manifest: ${manifestUrl}`);
    
    try {
        const response = await fetch(manifestUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': 'https://www.rotomagus.fr/ark:/12148/btv1b10052442z/f1.item.zoom'
            }
        });
        
        if (!response.ok) {
            console.error(`Failed to fetch manifest: ${response.status} ${response.statusText}`);
            return;
        }
        
        const manifestData = await response.json();
        console.log('Manifest fetched successfully');
        
        // Search for totalNumberPage recursively
        function findPageCount(obj, path = '') {
            if (typeof obj !== 'object' || obj === null) return;
            
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    const currentPath = path ? `${path}.${key}` : key;
                    
                    if (key === 'totalNumberPage' || key === 'totalVues' || key === 'nbTotalVues') {
                        console.log(`Found ${key} at path: ${currentPath} = ${obj[key]}`);
                    }
                    
                    if (typeof obj[key] === 'object') {
                        findPageCount(obj[key], currentPath);
                    }
                }
            }
        }
        
        console.log('\nSearching for page count fields...');
        findPageCount(manifestData);
        
        // Test specific paths mentioned in the code
        console.log('\nTesting specific paths:');
        if (manifestData.PageAViewerFragment?.parameters?.fragmentDownload?.contenu?.totalNumberPage) {
            console.log(`PageAViewerFragment path: ${manifestData.PageAViewerFragment.parameters.fragmentDownload.contenu.totalNumberPage}`);
        } else {
            console.log('PageAViewerFragment path: NOT FOUND');
        }
        
        if (manifestData.ViewerFragment?.parameters?.totalVues) {
            console.log(`ViewerFragment path: ${manifestData.ViewerFragment.parameters.totalVues}`);
        } else {
            console.log('ViewerFragment path: NOT FOUND');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testRouenManifest();