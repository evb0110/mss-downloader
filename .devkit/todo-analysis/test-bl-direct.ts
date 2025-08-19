// Direct manifest loading test for British Library
const testUrl = 'https://bl.digirati.io/iiif/ark:/81055/vdc_100055984026.0x000001';

console.log('Testing British Library manifest URL directly...');
console.log('URL:', testUrl);

async function testManifest() {
    try {
        const response = await fetch(testUrl);
        const data = await response.json();
        
        console.log('✅ Manifest loaded successfully!');
        console.log('Label:', data.label?.en?.[0] || data.label?.['@value'] || 'Unknown');
        console.log('Type:', data.type || data['@type']);
        console.log('Items/Sequences:', data.items?.length || data.sequences?.[0]?.canvases?.length || 0);
        
        // Check for pages
        const items = data.items || data.sequences?.[0]?.canvases || [];
        console.log('Total pages/canvases:', items.length);
        
        if (items.length > 0) {
            console.log('\n📄 First page structure:');
            const firstItem = items[0];
            console.log('ID:', firstItem.id || firstItem['@id']);
            console.log('Label:', firstItem.label?.en?.[0] || firstItem.label?.['@value'] || 'Page 1');
        }
        
        return true;
    } catch (error) {
        console.error('❌ Manifest test failed:', error.message);
        return false;
    }
}

testManifest();