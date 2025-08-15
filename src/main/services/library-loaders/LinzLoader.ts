import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class LinzLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'linz';
    }
    
    async loadManifest(url: string): Promise<ManuscriptManifest> {
        console.log('[LinzLoader] Processing URL:', url);
        
        // Extract manuscript ID from URL pattern like /viewer/image/116/
        let manuscriptId: string;
        const idMatch = url.match(/\/viewer\/image\/([^/]+)/);
        
        if (idMatch) {
            manuscriptId = idMatch[1] || '';
        } else {
            // Try other patterns
            const altMatch = url.match(/\/(\d+)$/);
            if (altMatch) {
                manuscriptId = altMatch[1] || '';
            } else {
                throw new Error('Could not extract manuscript ID from Linz URL');
            }
        }
        
        console.log('[LinzLoader] Manuscript ID:', manuscriptId);
        
        // Linz uses Goobi viewer with standard IIIF manifest endpoint
        const manifestUrl = `https://digi.landesbibliothek.at/viewer/api/v1/records/${manuscriptId}/manifest/`;
        console.log('[LinzLoader] Fetching IIIF manifest from:', manifestUrl);
        
        try {
            const response = await this.deps.fetchWithHTTPS(manifestUrl, {
                headers: {
                    'Accept': 'application/json, application/ld+json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch Linz manifest: ${response.status}`);
            }
            
            const manifest = await response.json();
            const images: Array<{ url: string; label: string }> = [];
            
            // Extract images from IIIF manifest
            if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
                const canvases = manifest.sequences[0].canvases;
                console.log(`[LinzLoader] Found ${canvases?.length} pages in manifest`);
                
                for (let i = 0; i < canvases?.length; i++) {
                    const canvas = canvases[i];
                    if (canvas.images && canvas.images[0]) {
                        const image = canvas.images[0];
                        let imageUrl: string | null = null;
                        
                        // Handle different IIIF image formats
                        if (image.resource) {
                            if (typeof image.resource === 'string') {
                                imageUrl = image.resource;
                            } else if (image.resource['@id']) {
                                imageUrl = image.resource['@id'];
                            } else if (image.resource.id) {
                                imageUrl = image.resource.id;
                            }
                        }
                        
                        // If it's a IIIF image service, construct full resolution URL
                        if (imageUrl && imageUrl.includes('/info.json')) {
                            imageUrl = imageUrl.replace('/info.json', '/full/full/0/default.jpg');
                        }
                        
                        if (imageUrl) {
                            images.push({
                                url: imageUrl,
                                label: canvas.label || `Page ${i + 1}`
                            });
                        }
                    }
                }
            }
            
            if (images?.length === 0) {
                throw new Error('No images found in Linz manifest');
            }
            
            console.log(`[LinzLoader] Successfully extracted ${images?.length} pages`);
            
            return {
                pageLinks: images.map(img => img.url),
                totalPages: images?.length,
                library: 'linz' as const,
                displayName: manifest.label || `Linz - ${manuscriptId}`,
                originalUrl: url
            };
            
        } catch (error) {
            console.error('[LinzLoader] Error loading manifest:', error);
            throw new Error(`Failed to load Linz manuscript: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}