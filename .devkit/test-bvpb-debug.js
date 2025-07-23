const { SharedManifestLoaders } = require('../src/shared/SharedManifestLoaders.js');

// Override fetch to add debugging
class DebugSharedManifestLoaders extends SharedManifestLoaders {
    async getBVPBManifest(url) {
        console.log('\n=== BVPB Debug ===');
        
        // Extract registro ID from URL
        const match = url.match(/registro\.do\?id=(\d+)/);
        if (!match) throw new Error('Invalid BVPB URL');
        
        const registroId = match[1];
        console.log('Registro ID:', registroId);
        
        // Fetch the registro page to find image viewer links
        console.log('Fetching registro page...');
        const response = await this.fetchWithRetry(url);
        if (!response.ok) throw new Error(`Failed to fetch BVPB page: ${response.status}`);
        
        const html = await response.text();
        console.log('Page fetched, length:', html.length);
        
        // Look for catalogo_imagenes grupo.do path
        const grupoMatch = html.match(/catalogo_imagenes\/grupo\.do\?path=(\d+)/);
        console.log('Grupo match:', grupoMatch ? grupoMatch[1] : 'NOT FOUND');
        
        if (!grupoMatch) {
            // Log some context
            const hasDigital = html.includes('Copia digital');
            const hasCatalogo = html.includes('catalogo_imagenes');
            console.log('Has "Copia digital":', hasDigital);
            console.log('Has "catalogo_imagenes":', hasCatalogo);
            throw new Error('No digital copy found for this BVPB manuscript');
        }
        
        const grupoPath = grupoMatch[1];
        
        // First, fetch the main grupo page to see all thumbnails/pages
        const grupoUrl = `https://bvpb.mcu.es/es/catalogo_imagenes/grupo.do?path=${grupoPath}`;
        console.log('Fetching grupo page:', grupoUrl);
        const grupoResponse = await this.fetchWithRetry(grupoUrl);
        if (!grupoResponse.ok) throw new Error(`Failed to fetch grupo page: ${grupoResponse.status}`);
        
        const grupoHtml = await grupoResponse.text();
        console.log('Grupo page fetched, length:', grupoHtml.length);
        
        // Extract all image object IDs from miniature links
        const miniaturePattern = /object-miniature\.do\?id=(\d+)/g;
        const imageIdPattern = /idImagen=(\d+)/g;
        const imageIds = [];
        let idMatch;
        
        // Try miniature pattern first
        while ((idMatch = miniaturePattern.exec(grupoHtml)) !== null) {
            if (!imageIds.includes(idMatch[1])) {
                imageIds.push(idMatch[1]);
            }
        }
        console.log('Found with miniature pattern:', imageIds.length);
        
        // If no miniatures found, try direct image ID pattern
        if (imageIds.length === 0) {
            while ((idMatch = imageIdPattern.exec(grupoHtml)) !== null) {
                if (!imageIds.includes(idMatch[1])) {
                    imageIds.push(idMatch[1]);
                }
            }
            console.log('Found with idImagen pattern:', imageIds.length);
        }
        
        console.log('Total image IDs found:', imageIds.length);
        console.log('First 5 IDs:', imageIds.slice(0, 5));
        
        if (imageIds.length === 0) {
            throw new Error('No image IDs found in BVPB viewer');
        }
        
        const images = [];
        
        // Get first 10 pages (or all if fewer)
        const maxPages = Math.min(imageIds.length, 10);
        for (let i = 0; i < maxPages; i++) {
            const imageId = imageIds[i];
            // Direct image URL pattern found in the viewer
            const imageUrl = `https://bvpb.mcu.es/es/catalogo_imagenes/imagen_id.do?idImagen=${imageId}&formato=jpg&registrardownload=0`;
            images.push({
                url: imageUrl,
                label: `Page ${i + 1}`
            });
        }
        
        return { images };
    }
}

async function testWithDebug() {
    const loader = new DebugSharedManifestLoaders();
    
    // Test manuscript with multiple pages
    const url = 'https://bvpb.mcu.es/es/consulta/registro.do?id=451885';
    
    try {
        const manifest = await loader.getBVPBManifest(url);
        console.log(`\nSuccess! Found ${manifest.images.length} pages`);
    } catch (error) {
        console.error('\nError:', error.message);
    }
}

testWithDebug().catch(console.error);