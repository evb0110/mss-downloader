
import { SharedManifestLoaders } from '../src/shared/SharedManifestLoaders';

async function test() {
    const loader = new SharedManifestLoaders();
    const url = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';
    
    try {
        // Detect library from URL (production logic)
        const libraryType = await loader.detectLibraryFromUrl(url);
        console.log('Library detected:', libraryType);
        
        // Load manifest using production code
        const manifest = await loader.loadManifest(url, libraryType);
        console.log('Manifest loaded successfully');
        console.log('Pages found:', manifest.pages?.length || 0);
        
        return { success: true, library: libraryType, pageCount: manifest.pages?.length };
    } catch (error) {
        console.log('Failed:', error.message);
        return { success: false, error: error.message };
    }
}

test().then(result => {
    console.log(JSON.stringify(result));
});
