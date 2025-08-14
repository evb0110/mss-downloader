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
                    'RBME page loading'
                );
                
                // Monitor configuration moved to internal implementation
                
                const pageController = (pageProgressMonitor as any)['start']();
                (pageProgressMonitor as any)['updateProgress'](0, 1, 'Loading RBME page...');
                
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
                    console.log(`RBME page content loaded, length: ${pageContent?.length}`);
                    
                } catch (pageError: unknown) {
                    if ((pageError as any)?.name === 'AbortError') {
                        throw new Error('RBME page request timed out. The server may be experiencing high load.');
                    }
                    throw pageError;
                } finally {
                    (pageProgressMonitor as any)['complete']();
                }
                
                // Extract manifest URL from the page content
                // Look for manifest URL in Universal Viewer configuration or meta tags
                const manifestMatch = pageContent.match(/(?:manifest["']?\s*:\s*["']|"manifest"\s*:\s*["'])(https:\/\/rbdigital\.realbiblioteca\.es\/files\/manifests\/[^"']+)/);
                if (!manifestMatch) {
                    console.error('Failed to find manifest URL in page content');
                    console.log('Page content preview:', pageContent?.substring(0, 500) || 'Content is empty');
                    throw new Error('Could not find IIIF manifest URL in RBME page');
                }
                
                const manifestUrl = manifestMatch[1];
                if (!manifestUrl) {
                    throw new Error('RBME manifest URL is empty');
                }
                console.log(`Found RBME manifest URL: ${manifestUrl}`);
                
                // Fetch the IIIF manifest with intelligent monitoring
                const manifestProgressMonitor = this.deps.createProgressMonitor(
                    'RBME manifest loading'
                );
                
                const manifestController = (manifestProgressMonitor as any)['start']();
                (manifestProgressMonitor as any)['updateProgress'](0, 1, 'Loading RBME manifest...');
                
                let iiifManifest: Record<string, unknown>;
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
                    (manifestProgressMonitor as any)['updateProgress'](1, 1, 'RBME manifest loaded successfully');
                    console.log(`RBME manifest loaded successfully for item: ${itemId || ''}`);
                    
                } catch (manifestError: unknown) {
                    if ((manifestError as any)?.name === 'AbortError') {
                        throw new Error('RBME manifest request timed out. The server may be experiencing high load.');
                    }
                    throw manifestError;
                } finally {
                    (manifestProgressMonitor as any)['complete']();
                }
                
                if (!(iiifManifest as Record<string, unknown>)['sequences'] || !((iiifManifest as Record<string, unknown>)['sequences'] as unknown[])[0] || !(((iiifManifest as Record<string, unknown>)['sequences'] as unknown[])[0] as Record<string, unknown>)['canvases']) {
                    throw new Error('Invalid IIIF manifest structure');
                }
                
                const pageLinks: string[] = ((((iiifManifest as Record<string, unknown>)['sequences'] as unknown[])[0] as Record<string, unknown>)['canvases'] as Record<string, unknown>[]).map((canvas: Record<string, unknown>) => {
                    const resource = ((canvas['images'] as unknown[])[0] as Record<string, unknown>)['resource'] as Record<string, unknown>;
                    const serviceUrl = (resource['service'] as any)?.['@id'] || (resource['service'] as any)?.['id'];
                    
                    if (serviceUrl) {
                        // Use IIIF Image API to get full resolution images
                        return `${serviceUrl}/full/max/0/default.jpg`;
                    } else {
                        // Fallback to direct image URL
                        return resource['@id'] || resource['id'];
                    }
                }).filter((link: unknown): link is string => typeof link === 'string' && link.length > 0);
                
                if (pageLinks?.length === 0) {
                    throw new Error('No images found in RBME manifest');
                }
                
                // Extract title and metadata
                const label = iiifManifest['label'] || 'RBME Manuscript';
                const displayName = typeof label === 'string' ? label : ((label as any)?.['@value'] || (label as any)?.value || 'RBME Manuscript');
                
                // Sanitize display name for filesystem
                const safeName = displayName || 'manuscript';
                const sanitizedName = safeName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\.+$/, '').substring(0, 100);
                
                return {
                    displayName: sanitizedName,
                    totalPages: pageLinks?.length,
                    pageLinks,
                    library: 'rbme' as const,
                    originalUrl: rbmeUrl
                };
                
            } catch (error: any) {
                console.error(`RBME manifest loading failed:`, error);
                throw new Error(`Failed to load RBME manuscript: ${(error as Error).message}`);
            }
        }
}