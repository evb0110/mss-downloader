const { SharedManifestLoaders } = require('../../../src/shared/SharedManifestLoaders.js');

async function analyzeURLs() {
    console.log('🔬 Analyzing BDL URL patterns...\n');
    const loaders = new SharedManifestLoaders();
    const url = 'https://www.bdl.servizirl.it/vufind/Record/BDL-OGGETTO-3903';
    
    try {
        const manifest = await loaders.getManifestForLibrary('bdl', url);
        console.log(`Total images: ${manifest.images.length}\n`);
        
        // Check first 10 and last 10 URLs
        console.log('First 5 URLs:');
        for (let i = 0; i < 5; i++) {
            console.log(`  ${i + 1}: ${manifest.images[i].url}`);
        }
        
        console.log('\nLast 5 URLs:');
        for (let i = manifest.images.length - 5; i < manifest.images.length; i++) {
            console.log(`  ${i + 1}: ${manifest.images[i].url}`);
        }
        
        // Check for duplicate IDs
        const ids = manifest.images.map(img => {
            const match = img.url.match(/\/(\d+)\/full/);
            return match ? match[1] : null;
        });
        
        const uniqueIds = new Set(ids);
        console.log(`\n📊 Analysis:`);
        console.log(`  Total URLs: ${ids.length}`);
        console.log(`  Unique IDs: ${uniqueIds.size}`);
        
        if (ids.length !== uniqueIds.size) {
            console.log('  ⚠️ DUPLICATE IDs FOUND!');
            
            // Find duplicates
            const counts = {};
            ids.forEach(id => {
                counts[id] = (counts[id] || 0) + 1;
            });
            
            Object.entries(counts).forEach(([id, count]) => {
                if (count > 1) {
                    console.log(`    ID ${id} appears ${count} times`);
                }
            });
        }
        
        // Check for null IDs
        const nullCount = ids.filter(id => !id).length;
        if (nullCount > 0) {
            console.log(`  ⚠️ ${nullCount} URLs with no ID extracted`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

analyzeURLs();