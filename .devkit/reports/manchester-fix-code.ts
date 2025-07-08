
/**
 * Fixed Manchester Digital Collections implementation
 */
async loadManchesterManifest(manchesterUrl: string): Promise<ManuscriptManifest> {
    try {
        // Extract manuscript ID from URL
        const urlMatch = manchesterUrl.match(/\/view\/([^/]+)/);
        if (!urlMatch) {
            throw new Error('Could not extract manuscript ID from Manchester URL');
        }
        
        const manuscriptId = urlMatch[1];
        let displayName = `Manchester Digital Collections - ${manuscriptId}`;
        
        // Construct IIIF manifest URL
        const manifestUrl = `https://www.digitalcollections.manchester.ac.uk/iiif/${manuscriptId}`;
        
        // Load IIIF manifest
        const response = await this.fetchDirect(manifestUrl);
        if (!response.ok) {
            throw new Error(`Failed to load manifest: HTTP ${response.status}`);
        }
        
        const manifest = await response.json();
        
        // Extract metadata from IIIF v2.0 manifest
        if (manifest.label) {
            if (typeof manifest.label === 'string') {
                displayName = manifest.label;
            } else if (Array.isArray(manifest.label)) {
                displayName = manifest.label[0]?.['@value'] || manifest.label[0] || displayName;
            } else if (manifest.label['@value']) {
                displayName = manifest.label['@value'];
            }
        }
        
        // Get page count from sequences/canvases (IIIF v2.0)
        let totalPages = 0;
        const pageLinks: string[] = [];
        
        if (manifest.sequences && manifest.sequences.length > 0) {
            const sequence = manifest.sequences[0];
            if (sequence.canvases && Array.isArray(sequence.canvases)) {
                totalPages = sequence.canvases.length;
                
                // Extract image URLs with maximum resolution
                for (const canvas of sequence.canvases) {
                    if (canvas.images && canvas.images.length > 0) {
                        const image = canvas.images[0];
                        if (image.resource && image.resource.service && image.resource.service['@id']) {
                            // CRITICAL FIX: Use optimal resolution pattern discovered through testing
                            // Manchester IIIF service supports up to 2000x2000 max dimensions
                            // The pattern /full/1994,2800/0/default.jpg gives highest quality
                            const serviceId = image.resource.service['@id'];
                            const maxResUrl = `${serviceId}/full/1994,2800/0/default.jpg`;
                            pageLinks.push(maxResUrl);
                        }
                    }
                }
            }
        }
        
        return {
            title: displayName,
            totalPages,
            pageLinks,
            source: 'manchester'
        };
        
    } catch (error) {
        throw new Error(`Failed to load Manchester manifest: ${error.message}`);
    }
}