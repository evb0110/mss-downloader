#!/usr/bin/env bun

// Vatican Library Deep Analysis Test
// Tests both VaticanLoader.ts and SharedManifestLoaders implementations

interface ManuscriptImage {
    url: string;
    filename: string;
}

interface ManuscriptManifest {
    pageLinks: string[];
    totalPages: number;
    library: string;
    displayName: string;
    originalUrl: string;
}

// Simulate the VaticanLoader.ts implementation
async function testVaticanLoader(url: string) {
    console.log('\n=== Testing VaticanLoader.ts Implementation ===');
    
    try {
        // Extract manuscript name from URL
        const nameMatch = url.match(/\/view\/([^/?]+)/);
        if (!nameMatch) {
            throw new Error('Invalid Vatican Library URL format');
        }
        
        const manuscriptName = nameMatch[1] || '';
        console.log(`📋 Manuscript ID: ${manuscriptName}`);
        
        // Extract cleaner manuscript name
        let displayName = manuscriptName;
        if (manuscriptName.startsWith('MSS_')) {
            displayName = manuscriptName.substring(4);
        } else if (manuscriptName.startsWith('bav_')) {
            displayName = manuscriptName.substring(4).replace(/^([a-z])/, (match) => match.toUpperCase());
        }
        console.log(`📝 Display Name: ${displayName}`);
        
        const manifestUrl = `https://digi.vatlib.it/iiif/${manuscriptName}/manifest.json`;
        console.log(`🔗 Manifest URL: ${manifestUrl}`);
        
        const response = await fetch(manifestUrl);
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`Manuscript not found: ${manuscriptName}. Please check the URL is correct.`);
            }
            throw new Error(`HTTP ${response.status}: Failed to load manifest`);
        }
        
        const iiifManifest = await response.json();
        
        // Check if manifest has the expected structure
        if (!iiifManifest.sequences || !iiifManifest.sequences[0] || !iiifManifest.sequences[0].canvases) {
            throw new Error('Invalid manifest structure: missing sequences or canvases');
        }
        
        const pageLinks = iiifManifest.sequences[0].canvases.map((canvas: any) => {
            const resource = canvas['images'][0]['resource'];
            
            // Vatican Library uses a service object with @id pointing to the image service
            if (resource['service'] && resource['service']["@id"]) {
                // Extract the base service URL and construct full resolution image URL
                const serviceId = resource['service']["@id"];
                return `${serviceId}/full/full/0/native.jpg`;
            }
            
            // Fallback to direct resource @id if no service (other IIIF implementations)
            if (resource['@id']) {
                return resource['@id'];
            }
            
            return null;
        }).filter((link: string) => link);
        
        console.log(`📊 Total Pages Found: ${pageLinks?.length}`);
        
        if (pageLinks?.length === 0) {
            throw new Error('No pages found in manifest');
        }
        
        // Test first few image URLs
        console.log('\n🖼️ Testing Image URLs:');
        for (let i = 0; i < Math.min(3, pageLinks.length); i++) {
            const imageUrl = pageLinks[i];
            console.log(`   Page ${i+1}: ${imageUrl.substring(0, 80)}...`);
            
            try {
                const imgResponse = await fetch(imageUrl, { method: 'HEAD' });
                console.log(`   Status: ${imgResponse.status} - ${imgResponse.headers.get('content-length')} bytes`);
            } catch (err) {
                console.log(`   Error: ${err}`);
            }
        }
        
        return {
            pageLinks,
            totalPages: pageLinks?.length,
            library: 'vatlib',
            displayName: displayName,
            originalUrl: url,
        };
        
    } catch (error: any) {
        console.error(`❌ VaticanLoader Error: ${error.message}`);
        throw error;
    }
}

// Simulate the SharedManifestLoaders implementation  
async function testSharedManifestLoader(url: string) {
    console.log('\n=== Testing SharedManifestLoaders Implementation ===');
    
    try {
        // Extract manuscript ID from URL
        const match = url.match(/view\/([^/?]+)/);
        if (!match) throw new Error('Invalid Vatican Library URL');
        
        const manuscriptId = match?.[1];
        console.log(`📋 Manuscript ID: ${manuscriptId}`);
        
        // Clean up display name
        let displayName = manuscriptId || '';
        if (displayName.startsWith('MSS_')) {
            displayName = displayName.substring(4);
        } else if (displayName.startsWith('bav_')) {
            displayName = displayName.substring(4)
                .split('_')
                .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
                .join('.')
                .replace(/_/g, '.');
        }
        console.log(`📝 Display Name: ${displayName}`);
        
        const manifestUrl = `https://digi.vatlib.it/iiif/${manuscriptId}/manifest.json`;
        console.log(`🔗 Manifest URL: ${manifestUrl}`);
        
        const response = await fetch(manifestUrl);
        if (!response.ok) throw new Error(`Failed to fetch manifest: ${response.status}`);
        
        const manifest: any = await response.json();
        const images: ManuscriptImage[] = [];
        
        if (manifest.sequences?.[0]?.canvases) {
            for (const [index, canvas] of manifest.sequences[0].canvases.entries()) {
                const image = canvas.images?.[0];
                const service = image.resource?.service;
                
                if (service && service['@id']) {
                    // Vatican supports up to 4000px width with excellent quality
                    // Testing showed 4000px gives optimal file size/quality balance
                    const imageUrl = `${service['@id']}/full/4000,/0/default.jpg`;
                    images.push({
                        url: imageUrl,
                        filename: `page_${String(index + 1).padStart(3, '0')}.jpg`
                    });
                }
            }
        }
        
        console.log(`📊 Total Images Found: ${images.length}`);
        
        if (images?.length === 0) {
            throw new Error('No images found in Vatican manifest');
        }
        
        // Test first few image URLs
        console.log('\n🖼️ Testing Image URLs:');
        for (let i = 0; i < Math.min(3, images.length); i++) {
            const imageUrl = images[i].url;
            console.log(`   Page ${i+1}: ${imageUrl.substring(0, 80)}...`);
            
            try {
                const imgResponse = await fetch(imageUrl, { method: 'HEAD' });
                console.log(`   Status: ${imgResponse.status} - ${imgResponse.headers.get('content-length')} bytes`);
            } catch (err) {
                console.log(`   Error: ${err}`);
            }
        }
        
        return { 
            images,
            label: manifest.label,
            displayName,
            metadata: manifest.metadata
        };
        
    } catch (error: any) {
        console.error(`❌ SharedManifestLoader Error: ${error.message}`);
        throw error;
    }
}

async function main() {
    const testUrl = 'https://digi.vatlib.it/view/MSS_Vat.lat.1';
    
    console.log('🔍 Vatican Library Deep Analysis');
    console.log(`📚 Test URL: ${testUrl}`);
    
    try {
        // Test VaticanLoader implementation
        const vaticanResult = await testVaticanLoader(testUrl);
        console.log(`✅ VaticanLoader: SUCCESS - ${vaticanResult.totalPages} pages`);
        
        // Test SharedManifestLoaders implementation
        const sharedResult = await testSharedManifestLoader(testUrl);
        console.log(`✅ SharedManifestLoader: SUCCESS - ${sharedResult.images.length} images`);
        
        // Compare results
        console.log('\n📊 COMPARISON ANALYSIS:');
        console.log(`   VaticanLoader pages: ${vaticanResult.totalPages}`);
        console.log(`   SharedManifestLoader images: ${sharedResult.images.length}`);
        console.log(`   Match: ${vaticanResult.totalPages === sharedResult.images.length ? '✅' : '❌'}`);
        
        // Check image URL patterns
        if (vaticanResult.pageLinks.length > 0 && sharedResult.images.length > 0) {
            console.log('\n🔗 URL PATTERN COMPARISON:');
            console.log(`   VaticanLoader uses: ${vaticanResult.pageLinks[0].includes('/full/full/') ? 'full/full' : 'other'}`);
            console.log(`   SharedManifestLoader uses: ${sharedResult.images[0].url.includes('/full/4000') ? 'full/4000' : 'other'}`);
        }
        
    } catch (error) {
        console.error(`💥 Test failed: ${error}`);
        process.exit(1);
    }
}

main();