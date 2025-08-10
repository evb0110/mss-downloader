import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class RbmeLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'rbme';
    }
    
    async loadManifest(rbmeUrl: string): Promise<ManuscriptManifest> {
            try {
                console.log(`Loading RBME manuscript: ${rbmeUrl}`);
                
                // Extract the item ID from the URL
                // Pattern: https://rbme.patrimonionacional.es/s/rbme/item/14374
                const idMatch = rbmeUrl.match(/\/item\/(\d+)/);
                if (!idMatch) {
                    throw new Error('Invalid RBME URL format - could not extract item ID');
                }
                
                const itemId = idMatch[1];
                console.log(`Extracted RBME item ID: ${itemId}`);
                
                // Fetch the RBME page to extract the manifest URL with intelligent monitoring
                console.log('Fetching RBME page content...');
                const pageProgressMonitor = this.deps.createProgressMonitor(
                    'RBME page loading',
                    'rbme',
                    { initialTimeout: 30000, maxTimeout: 120000 },
                    {
                        onStuckDetected: (state: any) => {
                            console.warn(`[RBME] ${state.statusMessage} - Item: ${itemId}`);
                        }
                    }
                );
                
                const pageController = pageProgressMonitor.start();
                pageProgressMonitor.updateProgress(0, 1, 'Loading RBME page...');
                
                let pageContent: string;
                try {
                    const pageResponse = await this.deps.fetchDirect(rbmeUrl, {
                        signal: pageController.signal,
                        headers: {
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                            'Cache-Control': 'no-cache'
                        }
                    });
                    
                    if (!pageResponse.ok) {
                        throw new Error(`Failed to fetch RBME page: HTTP ${pageResponse.status} ${pageResponse.statusText}`);
                    }
                    
                    pageContent = await pageResponse.text();
                    console.log(`RBME page content loaded, length: ${pageContent.length}`);
                    
                } catch (pageError: any) {
                    if (pageError.name === 'AbortError') {
                        throw new Error('RBME page request timed out. The server may be experiencing high load.');
                    }
                    throw pageError;
                } finally {
                    pageProgressMonitor.complete();
                }
                
                // Extract manifest URL from the page content
                // Look for manifest URL in Universal Viewer configuration or meta tags
                const manifestMatch = pageContent.match(/(?:manifest["']?\s*:\s*["']|"manifest"\s*:\s*["'])(https:\/\/rbdigital\.realbiblioteca\.es\/files\/manifests\/[^"']+)/);
                if (!manifestMatch) {
                    console.error('Failed to find manifest URL in page content');
                    console.log('Page content preview:', pageContent.substring(0, 500));
                    throw new Error('Could not find IIIF manifest URL in RBME page');
                }
                
                const manifestUrl = manifestMatch[1];
                console.log(`Found RBME manifest URL: ${manifestUrl}`);
                
                // Fetch the IIIF manifest with intelligent monitoring
                const manifestProgressMonitor = this.deps.createProgressMonitor(
                    'RBME manifest loading',
                    'rbme',
                    { initialTimeout: 30000, maxTimeout: 120000 },
                    {
                        onStuckDetected: (state: any) => {
                            console.warn(`[RBME] ${state.statusMessage} - URL: ${manifestUrl}`);
                        }
                    }
                );
                
                const manifestController = manifestProgressMonitor.start();
                manifestProgressMonitor.updateProgress(0, 1, 'Loading RBME manifest...');
                
                let iiifManifest: any;
                try {
                    const manifestResponse = await this.deps.fetchDirect(manifestUrl, {
                        signal: manifestController.signal,
                        headers: {
                            'Accept': 'application/json',
                            'Cache-Control': 'no-cache'
                        }
                    });
                    
                    if (!manifestResponse.ok) {
                        throw new Error(`Failed to fetch RBME manifest: HTTP ${manifestResponse.status} ${manifestResponse.statusText}`);
                    }
                    
                    iiifManifest = await manifestResponse.json();
                    manifestProgressMonitor.updateProgress(1, 1, 'RBME manifest loaded successfully');
                    console.log(`RBME manifest loaded successfully for item: ${itemId}`);
                    
                } catch (manifestError: any) {
                    if (manifestError.name === 'AbortError') {
                        throw new Error('RBME manifest request timed out. The server may be experiencing high load.');
                    }
                    throw manifestError;
                } finally {
                    manifestProgressMonitor.complete();
                }
                
                if (!iiifManifest.sequences || !iiifManifest.sequences[0] || !iiifManifest.sequences[0].canvases) {
                    throw new Error('Invalid IIIF manifest structure');
                }
                
                const pageLinks = iiifManifest.sequences[0].canvases.map((canvas: any) => {
                    const resource = canvas.images[0].resource;
                    const serviceUrl = resource.service?.['@id'] || resource.service?.id;
                    
                    if (serviceUrl) {
                        // Use IIIF Image API to get full resolution images
                        return `${serviceUrl}/full/max/0/default.jpg`;
                    } else {
                        // Fallback to direct image URL
                        return resource['@id'] || resource.id;
                    }
                }).filter((link: string) => link);
                
                if (pageLinks.length === 0) {
                    throw new Error('No images found in RBME manifest');
                }
                
                // Extract title and metadata
                const label = iiifManifest.label || 'RBME Manuscript';
                const displayName = typeof label === 'string' ? label : (label?.['@value'] || label?.value || 'RBME Manuscript');
                
                // Sanitize display name for filesystem
                const sanitizedName = displayName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\.+$/, '').substring(0, 100);
                
                return {
                    displayName: sanitizedName,
                    totalPages: pageLinks.length,
                    pageLinks,
                    library: 'rbme' as any,
                    originalUrl: rbmeUrl
                };
                
            } catch (error: any) {
                console.error(`RBME manifest loading failed:`, error);
                throw new Error(`Failed to load RBME manuscript: ${(error as Error).message}`);
            }
        }
}