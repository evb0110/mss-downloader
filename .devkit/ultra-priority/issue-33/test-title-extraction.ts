// Test title extraction for Digital Scriptorium

async function testTitleExtraction() {
    console.log('🔍 Testing Digital Scriptorium title extraction...');
    
    try {
        const response = await fetch('https://colenda.library.upenn.edu/items/ark:/81431/p38g8fj78/manifest');
        const manifest = await response.json();
        
        console.log('\n📋 Available title fields:');
        console.log('manifest.label:', manifest.label);
        
        if (manifest.metadata) {
            console.log('\n📋 Metadata entries:');
            manifest.metadata.forEach((entry: any, index: number) => {
                if (entry.label && (
                    (typeof entry.label === 'string' && entry.label.toLowerCase().includes('title')) ||
                    (entry.label.en && entry.label.en[0]?.toLowerCase().includes('title'))
                )) {
                    console.log(`${index}. Label:`, entry.label);
                    console.log(`${index}. Value:`, entry.value);
                }
            });
        }
        
        // Test our extraction logic
        let title = 'Digital Scriptorium Manuscript';
        
        if (manifest.label) {
            if (typeof manifest.label === 'string') {
                title = manifest.label;
            } else if (manifest.label.en && manifest.label.en[0]) {
                title = manifest.label.en[0];
            } else if (manifest.label['@value']) {
                title = manifest.label['@value'];
            } else if (Array.isArray(manifest.label) && manifest.label[0]) {
                title = manifest.label[0];
            }
        }
        
        // Clean up title
        const cleanTitle = title.replace(/^\[|\]$/g, '').trim();
        
        console.log('\n✅ EXTRACTED TITLE:');
        console.log('Raw title:', title);
        console.log('Clean title:', cleanTitle);
        
    } catch (error) {
        console.error('❌ Error testing title extraction:', error);
    }
}

testTitleExtraction();