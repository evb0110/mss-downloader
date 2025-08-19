// Debug the title flow for Digital Scriptorium

async function debugTitleFlow() {
    console.log('🔍 Testing Digital Scriptorium title flow...');
    
    try {
        // Import the SharedManifestLoaders to test directly
        const { SharedManifestLoaders } = await import('../../../src/shared/SharedManifestLoaders.js');
        
        // Create an instance
        const loaders = new SharedManifestLoaders();
        
        // Test the method directly
        const result = await loaders.getDigitalScriptoriumManifest('https://search.digital-scriptorium.org/catalog/DS1649');
        
        console.log('\n📋 Direct method result:');
        console.log('result.displayName:', result.displayName);
        console.log('result.images length:', result.images ? result.images.length : 'undefined');
        console.log('result keys:', Object.keys(result));
        
        // Now test through the library method
        const libraryResult = await loaders.getManifestForLibrary('digital_scriptorium', 'https://search.digital-scriptorium.org/catalog/DS1649');
        
        console.log('\n📋 Library method result:');
        console.log('libraryResult.displayName:', (libraryResult as any).displayName);
        console.log('libraryResult keys:', Object.keys(libraryResult));
        
    } catch (error) {
        console.error('❌ Error in debug flow:', error);
    }
}

debugTitleFlow();