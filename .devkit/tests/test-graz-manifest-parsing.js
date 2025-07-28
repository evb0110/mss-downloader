const fetch = require('node-fetch');
const https = require('https');

// Test the actual manifest parsing logic from the app
async function testGrazManifestParsing() {
    console.log('Testing Graz manifest parsing logic...\n');
    
    const testUrl = 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538';
    
    // Extract manuscript ID
    const manuscriptIdMatch = testUrl.match(/\/(\d+)$/);
    if (!manuscriptIdMatch) {
        console.error('Could not extract manuscript ID from URL');
        return;
    }
    
    const manuscriptId = manuscriptIdMatch[1];
    const manifestUrl = `https://unipub.uni-graz.at/i3f/v20/${manuscriptId}/manifest`;
    
    console.log(`Fetching manifest from: ${manifestUrl}`);
    
    try {
        const httpsAgent = new https.Agent({
            rejectUnauthorized: false,
            timeout: 30000,
            keepAlive: true
        });
        
        const response = await fetch(manifestUrl, {
            agent: httpsAgent,
            headers: {
                'Accept': 'application/json, application/ld+json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 30000
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch IIIF manifest: ${response.status} ${response.statusText}`);
        }
        
        const jsonText = await response.text();
        console.log(`Manifest size: ${(jsonText.length / 1024).toFixed(1)} KB`);
        
        let manifestData;
        try {
            manifestData = JSON.parse(jsonText);
        } catch (parseError) {
            throw new Error(`Failed to parse IIIF manifest JSON: ${parseError.message}`);
        }
        
        console.log('\nManifest structure:');
        console.log(`- @context: ${manifestData['@context']}`);
        console.log(`- @type: ${manifestData['@type']}`);
        console.log(`- @id: ${manifestData['@id']}`);
        console.log(`- label: ${manifestData.label}`);
        
        // Test the exact parsing logic from loadGrazManifest
        const pageLinks = [];
        let displayName = 'University of Graz Manuscript';
        
        // Extract title from manifest metadata
        if (manifestData.label) {
            if (typeof manifestData.label === 'string') {
                displayName = manifestData.label;
            } else if (manifestData.label['@value']) {
                displayName = manifestData.label['@value'];
            } else if (manifestData.label.en) {
                displayName = Array.isArray(manifestData.label.en) ? manifestData.label.en[0] : manifestData.label.en;
            } else if (manifestData.label.de) {
                displayName = Array.isArray(manifestData.label.de) ? manifestData.label.de[0] : manifestData.label.de;
            }
        }
        
        console.log(`\nExtracted display name: ${displayName}`);
        
        // Process IIIF sequences and canvases
        if (manifestData.sequences && manifestData.sequences.length > 0) {
            const sequence = manifestData.sequences[0];
            console.log(`\nSequence has ${sequence.canvases?.length || 0} canvases`);
            
            if (sequence.canvases) {
                // Check first few canvases
                for (let i = 0; i < Math.min(3, sequence.canvases.length); i++) {
                    const canvas = sequence.canvases[i];
                    console.log(`\nCanvas ${i + 1}:`);
                    console.log(`  - @id: ${canvas['@id']}`);
                    console.log(`  - label: ${canvas.label}`);
                    console.log(`  - images: ${canvas.images?.length || 0}`);
                    
                    if (canvas.images && canvas.images.length > 0) {
                        const image = canvas.images[0];
                        console.log(`  - image resource:`, image.resource ? 'present' : 'missing');
                        
                        if (image.resource) {
                            console.log(`    - @id: ${image.resource['@id']}`);
                            console.log(`    - @type: ${image.resource['@type']}`);
                            console.log(`    - format: ${image.resource.format}`);
                            console.log(`    - width: ${image.resource.width}`);
                            console.log(`    - height: ${image.resource.height}`);
                            
                            // Check webcache URL pattern
                            if (image.resource['@id']?.includes('/download/webcache/')) {
                                const pageIdMatch = image.resource['@id'].match(/\/webcache\/\d+\/(\d+)$/);
                                if (pageIdMatch) {
                                    const pageId = pageIdMatch[1];
                                    const highResUrl = `https://unipub.uni-graz.at/download/webcache/2000/${pageId}`;
                                    console.log(`    - Converted to high-res URL: ${highResUrl}`);
                                }
                            }
                        }
                    }
                }
                
                // Process all canvases to get page links
                for (const canvas of sequence.canvases) {
                    if (canvas.images && canvas.images.length > 0) {
                        const image = canvas.images[0];
                        let imageUrl = '';
                        
                        if (image.resource && image.resource['@id']) {
                            const resourceId = image.resource['@id'];
                            
                            if (resourceId.includes('/download/webcache/')) {
                                const pageIdMatch = resourceId.match(/\/webcache\/\d+\/(\d+)$/);
                                if (pageIdMatch) {
                                    const pageId = pageIdMatch[1];
                                    imageUrl = `https://unipub.uni-graz.at/download/webcache/2000/${pageId}`;
                                } else {
                                    console.warn(`Unexpected webcache URL format: ${resourceId}`);
                                    imageUrl = resourceId;
                                }
                            } else {
                                imageUrl = resourceId;
                            }
                        } else if (image.resource && image.resource.service && image.resource.service['@id']) {
                            const serviceId = image.resource.service['@id'];
                            imageUrl = `${serviceId}/full/full/0/default.jpg`;
                            console.warn(`Using legacy IIIF service URL: ${imageUrl}`);
                        }
                        
                        if (imageUrl) {
                            pageLinks.push(imageUrl);
                        }
                    }
                }
            }
        }
        
        console.log(`\nTotal page links extracted: ${pageLinks.length}`);
        if (pageLinks.length > 0) {
            console.log(`First page URL: ${pageLinks[0]}`);
            console.log(`Last page URL: ${pageLinks[pageLinks.length - 1]}`);
        }
        
        // Test sanitization
        const sanitizedName = displayName
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\.$/, '');
        
        console.log(`\nSanitized name: ${sanitizedName}`);
        
        if (pageLinks.length === 0) {
            throw new Error('No page images found in IIIF manifest');
        }
        
        console.log('\n✅ Manifest parsing completed successfully');
        
    } catch (error) {
        console.error('\n❌ Error during manifest parsing:', error.message);
        console.error('Full error:', error);
    }
}

testGrazManifestParsing().catch(console.error);