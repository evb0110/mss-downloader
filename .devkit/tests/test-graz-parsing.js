const fetch = require('node-fetch');

async function testGrazParsing() {
    try {
        // Test URLs that might be failing
        const testUrls = [
            'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
            'https://unipub.uni-graz.at/obvugrscript/content/pageview/8224540'
        ];

        for (const url of testUrls) {
            console.log(`\nTesting URL: ${url}`);
            
            // Extract manuscript ID
            const manuscriptIdMatch = url.match(/\/(\d+)$/);
            if (!manuscriptIdMatch) {
                console.error('Could not extract manuscript ID from URL');
                continue;
            }
            
            let manuscriptId = manuscriptIdMatch[1];
            console.log(`Extracted ID: ${manuscriptId}`);
            
            // Handle pageview conversion
            if (url.includes('/pageview/')) {
                const pageviewId = parseInt(manuscriptId);
                const titleinfoId = (pageviewId - 2).toString();
                console.log(`Converting pageview ID ${pageviewId} to titleinfo ID ${titleinfoId}`);
                manuscriptId = titleinfoId;
            }
            
            // Construct manifest URL
            const manifestUrl = `https://unipub.uni-graz.at/i3f/v20/${manuscriptId}/manifest`;
            console.log(`Manifest URL: ${manifestUrl}`);
            
            // Try to fetch manifest
            console.log('Fetching manifest...');
            const response = await fetch(manifestUrl, {
                headers: {
                    'Accept': 'application/json, application/ld+json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 30000
            });
            
            console.log(`Response status: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
                const text = await response.text();
                console.error(`Error response body: ${text.substring(0, 500)}`);
                continue;
            }
            
            const jsonText = await response.text();
            console.log(`Response size: ${(jsonText.length / 1024).toFixed(1)} KB`);
            
            try {
                const manifest = JSON.parse(jsonText);
                console.log(`Manifest type: ${manifest['@type'] || manifest.type}`);
                console.log(`Manifest label: ${manifest.label || 'No label'}`);
                
                // Check for sequences
                if (manifest.sequences && manifest.sequences[0]) {
                    const canvasCount = manifest.sequences[0].canvases?.length || 0;
                    console.log(`Canvas count: ${canvasCount}`);
                }
            } catch (parseError) {
                console.error(`JSON parse error: ${parseError.message}`);
                console.log(`First 500 chars of response: ${jsonText.substring(0, 500)}`);
            }
        }
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testGrazParsing();