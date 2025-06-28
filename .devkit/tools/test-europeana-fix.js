import https from 'https';

const testUrl = 'https://www.europeana.eu/en/item/446/CNMD_0000171876';
console.log(`Testing Europeana fix for: ${testUrl}`);

// Test the IIIF manifest structure  
const iiifUrl = 'https://iiif.europeana.eu/presentation/446/CNMD_0000171876/manifest';

https.get(iiifUrl, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const manifest = JSON.parse(data);
            console.log('IIIF Manifest label structure:');
            console.log(JSON.stringify(manifest.label, null, 2));
            
            // Test our fix logic
            const label = manifest.label;
            let displayName = 'Europeana_fallback';
            
            if (Array.isArray(label)) {
                const firstLabel = label[0];
                if (typeof firstLabel === 'string') {
                    displayName = firstLabel;
                } else if (firstLabel && typeof firstLabel === 'object' && '@value' in firstLabel) {
                    displayName = firstLabel['@value'];
                } else {
                    displayName = firstLabel || displayName;
                }
            }
            
            console.log(`\nExtracted displayName: "${displayName}"`);
            console.log(`Type: ${typeof displayName}`);
            
            // Test .replace() call
            try {
                const result = displayName.replace(/[<>:"/\\|?*]/g, '_');
                console.log(`✅ .replace() test passed: "${result}"`);
            } catch (error) {
                console.log(`❌ .replace() test failed: ${error.message}`);
            }
            
        } catch (error) {
            console.log(`❌ JSON parse error: ${error.message}`);
        }
    });
}).on('error', (error) => {
    console.log(`❌ Request error: ${error.message}`);
});