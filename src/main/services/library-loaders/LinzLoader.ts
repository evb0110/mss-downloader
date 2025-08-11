import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class LinzLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'linz';
    }
    
    async loadManifest(linzUrl: string): Promise<ManuscriptManifest> {
        try {
            console.log(`Loading Oberösterreichische Landesbibliothek (Linz) manifest: ${linzUrl}`);
            
            // Extract manuscript ID from various URL patterns
            let manuscriptId: string;
            
            // Pattern 1: /viewer/image/{ID}/
            // Pattern 2: /viewer/api/v1/records/{ID}/manifest/
            // Pattern 3: /viewer/mirador/?manifest=.../{ID}/manifest/
            const patterns = [
                /\/viewer\/image\/([^/]+)\//,
                /\/records\/([^/]+)\/manifest/,
                /\/records\/([^/]+)\/files/,
                /\/viewer\/image\/([^/]+)$/
            ];
            
            let matched = false;
            for (const pattern of patterns) {
                const match = linzUrl.match(pattern);
                if (match) {
                    manuscriptId = match[1];
                    matched = true;
                    break;
                }
            }
            
            if (!matched) {
                throw new Error('Could not extract manuscript ID from Linz URL. Expected format: https://digi.landesbibliothek.at/viewer/image/{ID}/');
            }
            
            // Construct IIIF manifest URL
            const manifestUrl = `https://digi.landesbibliothek.at/viewer/api/v1/records/${manuscriptId}/manifest/`;
            console.log(`Fetching IIIF manifest from: ${manifestUrl}`);
            
            // Fetch the IIIF manifest
            const response = await this.deps.fetchDirect(manifestUrl, {
                headers: {
                    'Accept': 'application/json, application/ld+json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Manuscript ID "${manuscriptId}" not found in Linz library. Please check the URL.`);
                }
                throw new Error(`Failed to load Linz manifest: HTTP ${response.status}`);
            }
            
            const manifestData = await response.json();
            
            // Extract display name from metadata
            let displayName = manifestData.label || `Linz MS ${manuscriptId}`;
            if (typeof displayName === 'object' && displayName['@value']) {
                displayName = displayName['@value'];
            }
            
            // Extract page links from IIIF v2 manifest
            const pageLinks: string[] = [];
            
            // IIIF v2: canvases are in sequences
            if (!manifestData.sequences || !Array.isArray(manifestData.sequences) || manifestData.sequences.length === 0) {
                throw new Error('Invalid IIIF manifest: no sequences found');
            }
            
            const canvases = manifestData.sequences[0].canvases || [];
            console.log(`Found ${canvases.length} pages in manifest`);
            
            for (const canvas of canvases) {
                if (canvas.images && Array.isArray(canvas.images) && canvas.images.length > 0) {
                    const image = canvas.images[0];
                    
                    // Get the IIIF image service URL
                    let imageServiceUrl: string | undefined;
                    
                    if (image.resource?.service?.['@id']) {
                        imageServiceUrl = image.resource.service['@id'];
                    } else if (image.resource?.service?.id) {
                        imageServiceUrl = image.resource.service.id;
                    }
                    
                    if (imageServiceUrl) {
                        // Construct maximum resolution URL
                        // Linz supports both full/full and full/max for maximum quality
                        const fullResUrl = `${imageServiceUrl}/full/max/0/default.jpg`;
                        pageLinks.push(fullResUrl);
                    } else if (image.resource?.['@id']) {
                        // Fallback to direct resource URL if no service URL
                        let resourceUrl = image.resource['@id'];
                        // Convert to maximum resolution if it's a IIIF URL
                        if (resourceUrl.includes('/full/')) {
                            resourceUrl = resourceUrl.replace(/\/full\/[^/]+\//, '/full/max/');
                        }
                        pageLinks.push(resourceUrl);
                    }
                }
            }
            
            if (pageLinks.length === 0) {
                throw new Error('No pages found in Linz manifest');
            }
            
            console.log(`Successfully loaded Linz manifest with ${pageLinks.length} pages`);
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'linz',
                displayName,
                originalUrl: linzUrl
            };
        } catch (error: any) {
            console.error('Error loading Linz manifest:', error);
            throw new Error(`Failed to load Linz manuscript: ${error.message}`);
        }
    }
}