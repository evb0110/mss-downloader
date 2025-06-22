// Test the complete Graz implementation with the fix
const problematicUrl = 'https://unipub.uni-graz.at/obvugrscript/content/pageview/8224540';

// Simulate the fixed Graz implementation
async function testGrazImplementation(grazUrl) {
    console.log(`Testing Graz implementation: ${grazUrl}`);
    
    // Extract manuscript ID from URL
    const manuscriptIdMatch = grazUrl.match(/\/(\d+)$/);
    if (!manuscriptIdMatch) {
        throw new Error('Could not extract manuscript ID from Graz URL');
    }
    
    let manuscriptId = manuscriptIdMatch[1];
    console.log(`Extracted ID: ${manuscriptId}`);
    
    // If this is a pageview URL, convert to titleinfo ID using known pattern
    if (grazUrl.includes('/pageview/')) {
        const pageviewId = parseInt(manuscriptId);
        const titleinfoId = (pageviewId - 2).toString();
        console.log(`Converting pageview ID ${pageviewId} to titleinfo ID ${titleinfoId}`);
        manuscriptId = titleinfoId;
    }
    
    // Construct IIIF manifest URL
    const manifestUrl = `https://unipub.uni-graz.at/i3f/v20/${manuscriptId}/manifest`;
    console.log(`Fetching IIIF manifest from: ${manifestUrl}`);
    
    // Fetch the IIIF manifest with extended timeout (simulating the optimization)
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
        console.log('⏰ Timeout triggered (30s)');
    }, 30000); // Extended timeout as per optimization
    
    try {
        const response = await fetch(manifestUrl, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json, application/ld+json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        clearTimeout(timeout);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch IIIF manifest: ${response.status} ${response.statusText}`);
        }
        
        const manifest = await response.json();
        console.log('✅ IIIF manifest loaded, processing canvases...');
        
        const pageLinks = [];
        let displayName = 'University of Graz Manuscript';
        
        // Extract title from manifest metadata
        if (manifest.label) {
            if (typeof manifest.label === 'string') {
                displayName = manifest.label;
            } else if (manifest.label['@value']) {
                displayName = manifest.label['@value'];  
            } else if (manifest.label.en) {
                displayName = Array.isArray(manifest.label.en) ? manifest.label.en[0] : manifest.label.en;
            } else if (manifest.label.de) {
                displayName = Array.isArray(manifest.label.de) ? manifest.label.de[0] : manifest.label.de;
            }
        }
        
        // Process IIIF sequences and canvases
        if (manifest.sequences && manifest.sequences.length > 0) {
            const sequence = manifest.sequences[0];
            if (sequence.canvases) {
                for (const canvas of sequence.canvases) {
                    if (canvas.images && canvas.images.length > 0) {
                        const image = canvas.images[0];
                        if (image.resource && image.resource['@id']) {
                            const imageUrl = image.resource['@id'];
                            pageLinks.push(imageUrl);
                        }
                    }
                }
            }
        }
        
        if (pageLinks.length === 0) {
            throw new Error('No page images found in IIIF manifest');
        }
        
        // Sanitize display name
        const sanitizedName = displayName
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\.$/, '');
            
        console.log(`✅ University of Graz manifest loaded: ${pageLinks.length} pages`);
        console.log(`✅ Display name: ${sanitizedName}`);
        console.log(`✅ First image URL: ${pageLinks[0]}`);
        
        return {
            pageLinks,
            totalPages: pageLinks.length,
            library: 'graz',
            displayName: sanitizedName,
            originalUrl: grazUrl,
        };
        
    } catch (error) {
        clearTimeout(timeout);
        throw error;
    }
}

// Test the problematic URL
testGrazImplementation(problematicUrl)
.then(result => {
    console.log('\n🎉 SUCCESS! Graz implementation working correctly:');
    console.log(`   Pages: ${result.totalPages}`);
    console.log(`   Title: ${result.displayName}`);
    console.log(`   Library: ${result.library}`);
    console.log('\n✅ The Graz fetch error should now be resolved!');
})
.catch(error => {
    console.error('\n❌ FAILED:', error.message);
    console.error('The fix may need additional work.');
});