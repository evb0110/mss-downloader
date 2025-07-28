// Test Morgan Library functionality directly
const fetch = require('node-fetch');

// Simulate the loadMorganManifest method with the exact problematic code structure
async function testMorganManifest() {
    const morganUrl = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';
    
    try {
        console.log('Testing Morgan URL:', morganUrl);
        
        // This simulates the fetch and initial processing
        const pageResponse = await fetch(morganUrl);
        const pageContent = await pageResponse.text();
        
        console.log('Fetched page, length:', pageContent.length);
        
        // Extract image URLs from the page
        const pageLinks = [];
        
        // Initialize imagesByPriority at outer scope so it's accessible for logging
        const imagesByPriority = {
            0: [], // HIGHEST PRIORITY: .zif tiled images
            1: [], // NEW: High-resolution download URLs
            2: [], // High priority: direct full-size images  
            3: [], // Medium priority: converted styled images
            4: [], // Low priority: facsimile images
            5: []  // Lowest priority: other direct references
        };
        
        if (morganUrl.includes('ica.themorgan.org')) {
            console.log('Processing ICA format...');
            // ICA processing code
        } else {
            console.log('Processing main Morgan format...');
            
            // Check if imagesByPriority is accessible here
            console.log('imagesByPriority is defined:', typeof imagesByPriority !== 'undefined');
            
            // Test accessing it
            try {
                if (imagesByPriority[1].length > 0) {
                    console.log('Has priority 1 images');
                } else {
                    console.log('No priority 1 images yet');
                }
            } catch (err) {
                console.error('ERROR accessing imagesByPriority:', err.message);
            }
        }
        
        // Test the final logging section
        try {
            console.log(`Morgan: Image quality distribution:`);
            console.log(`  - Priority 0: ${imagesByPriority[0].length} images`);
            console.log(`  - Priority 1: ${imagesByPriority[1].length} images`);
        } catch (err) {
            console.error('ERROR in final logging:', err.message);
        }
        
        console.log('Test completed successfully');
        
    } catch (error) {
        console.error('Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testMorganManifest();