import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class BerlinLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'berlin';
    }
    
    async loadManifest(berlinUrl: string): Promise<ManuscriptManifest> {
            console.log('Loading Berlin State Library manifest for:', berlinUrl);
            
            try {
                // Extract PPN from URL
                // Expected formats:
                // https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN782404456&view=picture-download&PHYSID=PHYS_0005&DMDID=DMDLOG_0001
                // https://digital.staatsbibliothek-berlin.de/werkansicht/?PPN=PPN782404677
                const ppnMatch = berlinUrl.match(/[?&]PPN=(PPN\d+)/);
                if (!ppnMatch) {
                    throw new Error('Could not extract PPN from Berlin State Library URL');
                }
                
                const fullPpn = ppnMatch[1]; // e.g., "PPN782404456"
                const ppnNumber = fullPpn.replace('PPN', ''); // e.g., "782404456"
                
                // Fetch IIIF manifest
                const manifestUrl = `https://content.staatsbibliothek-berlin.de/dc/${fullPpn}/manifest`;
                console.log('Fetching Berlin manifest from:', manifestUrl);
                
                const manifestResponse = await this.deps.fetchDirect(manifestUrl, {
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                if (!manifestResponse.ok) {
                    throw new Error(`Failed to load Berlin IIIF manifest: HTTP ${manifestResponse.status}`);
                }
                
                const manifestData = await manifestResponse.json();
                
                // Extract metadata
                const title = manifestData.label || `Berlin Manuscript ${ppnNumber}`;
                
                // Get sequences and canvases
                if (!manifestData.sequences || manifestData.sequences.length === 0) {
                    throw new Error('No sequences found in Berlin IIIF manifest');
                }
                
                const sequence = manifestData.sequences[0];
                const canvases = sequence.canvases || [];
                
                if (canvases.length === 0) {
                    throw new Error('No canvases found in Berlin IIIF manifest');
                }
                
                // Generate page links from canvases
                const pageLinks: string[] = [];
                for (const canvas of canvases) {
                    if (canvas.images && canvas.images.length > 0) {
                        const image = canvas.images[0];
                        if (image.resource && image.resource['@id']) {
                            // Use the direct image URL from the manifest
                            pageLinks.push(image.resource['@id']);
                        } else {
                            // Fallback: construct URL from canvas ID
                            // Canvas ID format: https://content.staatsbibliothek-berlin.de/dc/782404456-0001/canvas
                            const canvasMatch = canvas['@id'].match(/\/dc\/(\d+-\d+)\/canvas$/);
                            if (canvasMatch) {
                                const imageId = canvasMatch[1];
                                pageLinks.push(`https://content.staatsbibliothek-berlin.de/dc/${imageId}/full/full/0/default.jpg`);
                            }
                        }
                    }
                }
                
                if (pageLinks.length === 0) {
                    throw new Error('No valid image URLs found in Berlin IIIF manifest');
                }
                
                console.log(`Berlin State Library: Found ${pageLinks.length} pages for "${title}"`);
                
                return {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'berlin',
                    displayName: title,
                    originalUrl: berlinUrl
                };
                
            } catch (error: any) {
                console.error('Error loading Berlin State Library manifest:', error);
                throw new Error(`Failed to load Berlin State Library manuscript: ${(error as Error).message}`);
            }
        }
}