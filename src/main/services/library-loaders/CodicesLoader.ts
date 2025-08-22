import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class CodicesLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'codices';
    }
    
    async loadManifest(codicesUrl: string): Promise<ManuscriptManifest> {
        try {
            // Check if this is already a direct IIIF manifest URL
            if (codicesUrl.includes('/iiif/') && /[a-f0-9-]{36}/.test(codicesUrl)) {
                this.deps.logger?.log({
                    level: 'info',
                    library: 'codices',
                    message: `Processing direct IIIF manifest URL`,
                    details: { manifestUrl: codicesUrl }
                });

                const manifest = await this.loadIIIFManifest(codicesUrl, codicesUrl);
                if (manifest) {
                    // Cache the manifest
                    this.deps.manifestCache.set(codicesUrl, manifest as any).catch(console.warn);
                    return manifest;
                }
                throw new Error('Failed to load direct IIIF manifest');
            }

            // Extract manuscript identifier from URL for regular pages
            const manuscriptId = this.extractManuscriptId(codicesUrl);
            if (!manuscriptId) {
                throw new Error('Invalid Codices URL format - could not extract manuscript ID');
            }

            this.deps.logger?.log({
                level: 'info',
                library: 'codices',
                message: `Processing Codices manuscript: ${manuscriptId}`,
                details: { manuscriptId }
            });

            // Try different strategies to find the IIIF manifest
            const strategies = [
                () => this.tryManifestDiscovery(codicesUrl),
                () => this.tryPageScraping(codicesUrl),
                () => this.tryDirectManifestAccess(manuscriptId, codicesUrl)
            ];

            for (const strategy of strategies) {
                try {
                    const result = await strategy();
                    if (result && result.totalPages > 0) {
                        this.deps.logger?.log({
                            level: 'info',
                            library: 'codices',
                            message: `Success with ${result.totalPages} pages`,
                            details: { totalPages: result.totalPages }
                        });
                        // Cache the manifest
                        this.deps.manifestCache.set(codicesUrl, result as any).catch(console.warn);
                        return result;
                    }
                } catch (error) {
                    this.deps.logger?.log({
                        level: 'warn',
                        library: 'codices',
                        message: `Strategy failed: ${error instanceof Error ? error.message : String(error)}`,
                        details: { error: error instanceof Error ? error.message : String(error) }
                    });
                }
            }

            throw new Error(`All loading strategies failed for Codices manuscript (ID: ${manuscriptId}). 

NOTE: Codices library uses a Single Page Application (SPA) that loads manifest URLs dynamically via JavaScript. 
The manifest UUID cannot be reliably extracted from the static HTML.

WORKAROUND: If you have the direct IIIF manifest URL (format: https://admont.codices.at/iiif/[UUID]), 
you can use it directly as input instead of the manuscript page URL.

EXAMPLE: Instead of https://admont.codices.at/codices/169/90299
Use: https://admont.codices.at/iiif/9cec1d04-d5c3-4a2a-9aa8-4279b359e701`);
            
        } catch (error: any) {
            throw new Error(`Failed to load Codices document: ${(error as Error).message}`);
        }
    }

    private extractManuscriptId(url: string): string | null {
        // Extract ID from URLs like: https://admont.codices.at/codices/169/90299
        const patterns = [
            /codices\.at\/codices\/(\d+)\/(\d+)/,  // Standard codices URL pattern captures both collection and manuscript
            /codices\.at\/[^/]+\/(\d+)/,           // Alternative pattern
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                // Return both collection and manuscript for the first pattern
                if (match.length > 2) {
                    return `${match[1]}/${match[2]}`; // e.g., "169/90299"
                }
                return match[1] || null;
            }
        }

        return null;
    }

    private async tryDirectManifestAccess(_manuscriptId: string, _originalUrl: string): Promise<ManuscriptManifest | null> {
        // For Codices, we need to extract the manifest UUID from the page itself
        // The page URL format is: https://admont.codices.at/codices/169/90299
        // But the manifest uses a UUID, so we need to find it in the page
        return null; // Will be handled by manifest discovery
    }

    private async tryManifestDiscovery(codicesUrl: string): Promise<ManuscriptManifest | null> {
        try {
            // First, try to get the page content to find manifest links
            const response = await this.deps.fetchDirect(codicesUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch page: ${response.status}`);
            }

            const html = await response.text();
            
            // Look for IIIF manifest references in the HTML - expanded patterns
            const manifestPatterns = [
                /["']([^"']*iiif[^"']*manifest[^"']*)["']/gi,
                /["']([^"']*manifest\.json[^"']*)["']/gi,
                /data-manifest=["']([^"']+)["']/gi,
                /manifest:\s*["']([^"']+)["']/gi,
                // Look for UUID patterns that might be manifest IDs
                /["']([^"']*iiif[^"']*\/[a-f0-9-]{36}[^"']*)["']/gi,
                /["'](https:\/\/[^"']*codices\.at\/iiif\/[a-f0-9-]{36}[^"']*)["']/gi,
                // Look for JavaScript variables
                /manifestUrl[^=]*=\s*["']([^"']+)["']/gi,
                /manifest[^=]*=\s*["']([^"']+)["']/gi,
                // Look in script content
                /iiif\/[a-f0-9-]{36}/gi
            ];

            const foundUrls = new Set<string>();

            for (const pattern of manifestPatterns) {
                const matches = html.matchAll(pattern);
                for (const match of matches) {
                    let manifestUrl = match[1] || match[0];
                    
                    // If we found just a UUID, construct the full manifest URL
                    if (/^[a-f0-9-]{36}$/.test(manifestUrl)) {
                        manifestUrl = `https://admont.codices.at/iiif/${manifestUrl}`;
                    } else if (/iiif\/[a-f0-9-]{36}$/.test(manifestUrl) && !manifestUrl.startsWith('http')) {
                        manifestUrl = `https://admont.codices.at/${manifestUrl}`;
                    } else {
                        manifestUrl = this.resolveUrl(manifestUrl, codicesUrl);
                    }
                    
                    if (manifestUrl.includes('iiif') && !foundUrls.has(manifestUrl)) {
                        foundUrls.add(manifestUrl);
                        try {
                            const manifest = await this.loadIIIFManifest(manifestUrl, codicesUrl);
                            if (manifest) return manifest;
                        } catch (error) {
                            this.deps.logger?.log({
                                level: 'warn',
                                library: 'codices',
                                message: `Failed to load manifest from ${manifestUrl}`,
                                details: { manifestUrl, error: String(error) }
                            });
                        }
                    }
                }
            }

            return null;
        } catch (error) {
            this.deps.logger?.log({
                level: 'warn',
                library: 'codices',
                message: `Manifest discovery failed`,
                details: { error: String(error) }
            });
            return null;
        }
    }

    private async tryPageScraping(codicesUrl: string): Promise<ManuscriptManifest | null> {
        try {
            // Last resort: try to find individual images on the page
            const response = await this.deps.fetchDirect(codicesUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch page: ${response.status}`);
            }

            const html = await response.text();
            
            // Look for IIIF image service URLs
            const imagePatterns = [
                /["']([^"']*iiif\/image\/[^"']+)["']/gi,
                /["']([^"']*\/iiif\/[^"']+)["']/gi
            ];

            const imageUrls: string[] = [];
            for (const pattern of imagePatterns) {
                const matches = html.matchAll(pattern);
                for (const match of matches) {
                    const imageUrl = this.resolveUrl(match[1] || match[0], codicesUrl);
                    if (imageUrl.includes('/iiif/image/')) {
                        // Convert to full resolution IIIF URL
                        const fullResUrl = imageUrl.replace(/\/iiif\/image\/([^\/]+).*/, '/iiif/image/$1/full/full/0/default.jpg');
                        imageUrls.push(fullResUrl);
                    }
                }
            }

            if (imageUrls.length > 0) {
                // Remove duplicates and sort
                const uniqueUrls = [...new Set(imageUrls)].sort();
                
                return {
                    pageLinks: uniqueUrls,
                    totalPages: uniqueUrls.length,
                    library: 'codices' as const,
                    displayName: `Codices manuscript - ${uniqueUrls.length} pages`,
                    originalUrl: codicesUrl,
                };
            }

            return null;
        } catch (error) {
            this.deps.logger?.log({
                level: 'warn',
                library: 'codices',
                message: `Page scraping failed`,
                details: { error: String(error) }
            });
            return null;
        }
    }

    private async loadIIIFManifest(manifestUrl: string, originalUrl: string): Promise<ManuscriptManifest | null> {
        try {
            const response = await this.deps.fetchDirect(manifestUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch manifest: ${response.status}`);
            }

            const manifest = await response.json();
            
            // Extract title
            let displayName = 'Codices manuscript';
            if (manifest.label) {
                if (typeof manifest.label === 'string') {
                    displayName = manifest.label;
                } else if (manifest.label.en && manifest.label.en.length > 0) {
                    displayName = manifest.label.en[0];
                } else if (manifest.label.de && manifest.label.de.length > 0) {
                    displayName = manifest.label.de[0];
                } else {
                    // Take first available language
                    const firstLang = Object.keys(manifest.label)[0];
                    if (firstLang && manifest.label[firstLang].length > 0) {
                        displayName = manifest.label[firstLang][0];
                    }
                }
            }

            // Extract page images from IIIF v3 manifest
            const pageLinks = await this.extractImagesFromManifest(manifest);
            
            if (pageLinks.length > 0) {
                return {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'codices' as const,
                    displayName,
                    originalUrl,
                };
            }

            return null;
        } catch (error) {
            throw new Error(`Failed to parse IIIF manifest: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async extractImagesFromManifest(manifest: any): Promise<string[]> {
        const pageLinks: string[] = [];

        try {
            // IIIF Presentation API v3 structure
            const items = manifest.items || [];
            
            for (const canvas of items) {
                if (canvas.items) {
                    for (const annotationPage of canvas.items) {
                        if (annotationPage.items) {
                            for (const annotation of annotationPage.items) {
                                if (annotation.body && annotation.body.id) {
                                    // Get the image service URL
                                    let imageServiceUrl = null;
                                    
                                    if (annotation.body.service) {
                                        const services = Array.isArray(annotation.body.service) ? annotation.body.service : [annotation.body.service];
                                        for (const service of services) {
                                            if (service.id || service['@id']) {
                                                imageServiceUrl = service.id || service['@id'];
                                                break;
                                            }
                                        }
                                    }

                                    if (imageServiceUrl) {
                                        // Generate full resolution IIIF URL
                                        const fullResUrl = `${imageServiceUrl}/full/full/0/default.jpg`;
                                        pageLinks.push(fullResUrl);
                                    } else if (annotation.body.id) {
                                        // Fallback: use direct image URL if available
                                        pageLinks.push(annotation.body.id);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // IIIF v2 fallback
            if (pageLinks.length === 0 && manifest.sequences) {
                for (const sequence of manifest.sequences) {
                    if (sequence.canvases) {
                        for (const canvas of sequence.canvases) {
                            if (canvas.images) {
                                for (const image of canvas.images) {
                                    if (image.resource && image.resource.service) {
                                        const serviceId = image.resource.service['@id'] || image.resource.service.id;
                                        if (serviceId) {
                                            pageLinks.push(`${serviceId}/full/full/0/default.jpg`);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (error) {
            this.deps.logger?.log({
                level: 'warn',
                library: 'codices',
                message: `Manifest parsing error`,
                details: { error: String(error) }
            });
        }

        return pageLinks;
    }

    private resolveUrl(url: string, baseUrl: string): string {
        try {
            if (url.startsWith('http://') || url.startsWith('https://')) {
                return url;
            }
            const base = new URL(baseUrl);
            return new URL(url, base).toString();
        } catch {
            return url;
        }
    }
}