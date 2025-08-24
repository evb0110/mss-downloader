import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class DiammLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'diamm';
    }
        async loadManifest(originalUrl: string): Promise<ManuscriptManifest> {
            try {
                let manifestUrl: string;
                
                // Handle both musmed.eu viewer URLs and direct manifest URLs
                if (originalUrl.includes('musmed.eu/visualiseur-iiif')) {
                    // Extract manifest URL from musmed.eu viewer parameters
                    const urlParams = new URLSearchParams(originalUrl.split('?')[1]);
                    const encodedManifest = urlParams.get('manifest');
                    if (!encodedManifest) {
                        throw new Error('No manifest parameter found in DIAMM viewer URL');
                    }
                    manifestUrl = decodeURIComponent(encodedManifest);
                } else if (originalUrl.includes('iiif.diamm.net/manifests/')) {
                    // Direct manifest URL
                    manifestUrl = originalUrl;
                } else {
                    throw new Error('Unsupported DIAMM URL format');
                }
                
                // Validate manifest URL format
                if (!manifestUrl.includes('iiif.diamm.net/manifests/')) {
                    throw new Error('Invalid DIAMM manifest URL format');
                }
                
                this.deps.logger?.log({
                    level: 'info',
                    library: 'diamm',
                    message: `Loading IIIF manifest: ${manifestUrl}`,
                    details: { manifestUrl }
                });
                
                // Load IIIF manifest directly (no more circular dependency)
                const response = await this.deps.fetchDirect(manifestUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch DIAMM manifest: HTTP ${response.status} ${response.statusText}`);
                }
                
                const manifest = await response.json();
                
                // Extract manuscript ID for display name
                const manuscriptId = this.extractManuscriptId(manifestUrl);
                
                // Process IIIF manifest to extract image URLs
                const pageLinks = await this.processIIIFManifest(manifest);
                
                if (pageLinks.length === 0) {
                    throw new Error('No images found in DIAMM manifest');
                }
                
                // Extract title from manifest
                let displayName = `DIAMM ${manuscriptId}`;
                if (manifest.label) {
                    const manifestTitle = this.extractLocalizedString(manifest.label);
                    if (manifestTitle) {
                        displayName = manuscriptId && !manifestTitle.includes(manuscriptId) 
                            ? `${manifestTitle} (${manuscriptId})`
                            : manifestTitle;
                    }
                }
                
                this.deps.logger?.log({
                    level: 'info',
                    library: 'diamm',
                    message: `Successfully loaded DIAMM manifest: ${pageLinks.length} pages`,
                    details: { totalPages: pageLinks.length, displayName }
                });
                
                return {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'diamm' as const,
                    displayName,
                    originalUrl,
                };
                
            } catch (error: any) {
                throw new Error(`Failed to load DIAMM manuscript: ${(error as Error).message}`);
            }
        }
        
        private extractManuscriptId(manifestUrl: string): string {
            // Extract manuscript ID from manifest URL
            // e.g., https://iiif.diamm.net/manifests/I-Rc-Ms-1907/manifest.json -> I-Rc-Ms-1907
const match = manifestUrl.match(/\/manifests\/([^/]+)\/manifest\.json$/);
            return match?.[1] ?? 'Unknown';
        }
        
        private extractLocalizedString(value: string | Record<string, string[]> | undefined): string {
            if (typeof value === 'string') {
                return value;
            }
            if (typeof value === 'object' && value !== null) {
                // Try common languages first
                for (const lang of ['en', 'none', '@none']) {
                    const langArray = value[lang];
                    if (langArray && Array.isArray(langArray) && langArray.length > 0) {
                        return langArray[0] ?? '';
                    }
                }
                // Fall back to first available language
                for (const lang in value) {
                    const langArray = value[lang];
                    if (Array.isArray(langArray) && langArray.length > 0) {
                        return langArray[0] ?? '';
                    }
                }
            }
            return '';
        }
        
        private async processIIIFManifest(manifest: any): Promise<string[]> {
            const pageLinks: string[] = [];
            
            try {
                // IIIF Presentation API v2 and v3 support
                const sequences = manifest.sequences || [manifest];
                
                for (const sequence of sequences) {
                    const canvases = sequence.canvases || sequence.items || [];
                    
                    for (const canvas of canvases) {
                        const imageUrl = this.extractImageServiceUrl(canvas);
                        
                        if (imageUrl) {
                            // Use maximum resolution for DIAMM manuscripts
                            pageLinks.push(`${imageUrl}/full/max/0/default.jpg`);
                        } else {
                            this.deps.logger?.log({
                                level: 'warn',
                                library: 'diamm',
                                message: `No image service URL found for canvas`,
                                details: { canvasId: canvas['@id'] || canvas.id }
                            });
                        }
                    }
                }
            } catch (error) {
                throw new Error(`Failed to process DIAMM IIIF manifest: ${error instanceof Error ? error.message : String(error)}`);
            }
            
            return pageLinks;
        }
        
        private extractImageServiceUrl(canvas: any): string | null {
            // IIIF v2 format
            if (canvas.images) {
                for (const image of canvas.images) {
                    if (image.resource && image.resource.service) {
                        return image.resource.service['@id'] || image.resource.service.id;
                    }
                }
            }
            
            // IIIF v3 format
            if (canvas.items) {
                for (const item of canvas.items) {
                    if (item.items) {
                        for (const painting of item.items) {
                            if (painting.body && painting.body.service) {
                                const services = Array.isArray(painting.body.service) ? painting.body.service : [painting.body.service];
                                for (const service of services) {
                                    if (service.type === 'ImageService2' || service['@type'] === 'ImageService2' ||
                                        service.profile?.includes('iiif.io/api/image')) {
                                        return service['@id'] || service.id;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            return null;
        }
}