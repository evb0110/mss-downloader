import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class LocLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'loc';
    }
    
    async loadManifest(locUrl: string): Promise<ManuscriptManifest> {
            const startTime = Date.now();
            this.deps.logger.log({
                level: 'info',
                library: 'loc',
                url: locUrl,
                message: 'Starting LOC manifest load'
            });
            
            // Create progress monitor for LOC loading
            const progressMonitor = this.deps.createProgressMonitor(
                'Library of Congress manifest loading'
            );
            
            // Start progress monitor
            (progressMonitor as any)['start']();
            
            let manifestUrl = locUrl;
            try {
                
                console.log(`[loadLocManifest] Processing URL pattern...`);
                
                // Handle different LOC URL patterns
                if (locUrl.includes('/item/')) {
                    // Extract item ID: https://www.loc.gov/item/2010414164/
                    const itemMatch = locUrl.match(/\/item\/([^/?]+)/);
                    if (itemMatch) {
                        manifestUrl = `https://www.loc.gov/item/${itemMatch[1]}/manifest.json`;
                        console.log(`[loadLocManifest] Transformed item URL to manifest: ${manifestUrl}`);
                        this.deps.logger.log({
                            level: 'debug',
                            library: 'loc',
                            url: locUrl,
                            message: 'Transformed item URL to manifest URL',
                            details: { originalUrl: locUrl, manifestUrl }
                        });
                    }
                } else if (locUrl.includes('/resource/')) {
                    // Extract resource ID: https://www.loc.gov/resource/rbc0001.2022vollb14164/?st=gallery
                    const resourceMatch = locUrl.match(/\/resource\/([^/?]+)/);
                    if (resourceMatch) {
                        // Try to construct manifest URL from resource pattern
                        manifestUrl = `https://www.loc.gov/resource/${resourceMatch[1]}/manifest.json`;
                        console.log(`[loadLocManifest] Transformed resource URL to manifest: ${manifestUrl}`);
                        this.deps.logger.log({
                            level: 'debug',
                            library: 'loc',
                            url: locUrl,
                            message: 'Transformed resource URL to manifest URL',
                            details: { originalUrl: locUrl, manifestUrl }
                        });
                    }
                }
                
                (progressMonitor as any)['updateProgress'](1, 10, 'Fetching manifest...');
                
                let displayName = 'Library of Congress Manuscript';
                
                console.log(`[loadLocManifest] Fetching manifest from: ${manifestUrl}`);
                const fetchStartTime = Date.now();
                
                // Load IIIF manifest
                const response = await this.deps.fetchDirect(manifestUrl, {});
                
                const fetchElapsed = Date.now() - fetchStartTime;
                console.log(`[loadLocManifest] Manifest fetch completed - Status: ${response.status}, Time: ${fetchElapsed}ms`);
                
                if (!response.ok) {
                    console.error(`[loadLocManifest] Failed to load manifest - HTTP ${response.status}: ${response.statusText}`);
                    this.deps.logger.log({
                        level: 'error',
                        library: 'loc',
                        url: manifestUrl,
                        message: `Failed to load manifest - HTTP ${response.status}`,
                        details: { status: response.status, statusText: response.statusText }
                    });
                    throw new Error(`Failed to load LOC manifest: HTTP ${response.status}`);
                }
                
                const manifest = await response.json();
                console.log(`[loadLocManifest] Manifest parsed successfully - Type: ${manifest['@type'] || 'unknown'}`);
                
                (progressMonitor as any)['updateProgress'](3, 10, 'Parsing manifest...');
                
                // Extract title from IIIF v2.0 manifest
                if (manifest.label) {
                    if (typeof manifest.label === 'string') {
                        displayName = manifest.label;
                    } else if (Array.isArray(manifest.label)) {
                        displayName = manifest.label[0]?.['@value'] || manifest.label[0] || displayName;
                    } else if (manifest.label['@value']) {
                        displayName = manifest.label['@value'];
                    }
                }
                
                // Extract page links from IIIF v2.0 structure
                const pageLinks: string[] = [];
                let totalPages = 0;
                
                if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
                    const canvases = manifest.sequences[0].canvases;
                    totalPages = canvases?.length;
                    
                    console.log(`[loadLocManifest] Found ${totalPages} canvases in manifest`);
                    (progressMonitor as any)['updateProgress'](5, 10, `Processing ${totalPages} pages...`);
                    
                    for (let i = 0; i < canvases?.length; i++) {
                        const canvas = canvases[i];
                        if (canvas.images && canvas.images[0]) {
                            const image = canvas.images[0];
                            if (image.resource && image.resource.service && image.resource.service['@id']) {
                                // Use IIIF service for maximum resolution
                                // Testing showed full/full/0/default.jpg provides excellent quality (3+ MB per page)
                                const serviceId = image.resource.service['@id'];
                                const maxResUrl = `${serviceId}/full/full/0/default.jpg`;
                                pageLinks.push(maxResUrl);
                                
                                if (i === 0 || i === canvases?.length - 1 || i % 10 === 0) {
                                    console.log(`[loadLocManifest] Page ${i + 1}/${totalPages}: ${maxResUrl}`);
                                }
                            } else if (image.resource && image.resource['@id']) {
                                // Fallback to direct resource URL
                                pageLinks.push(image.resource['@id']);
                                console.log(`[loadLocManifest] Page ${i + 1} using fallback URL`);
                            }
                        }
                    }
                }
                
                if (pageLinks?.length === 0) {
                    throw new Error('No pages found in LOC IIIF manifest');
                }
                
                const locManifest = {
                    pageLinks,
                    totalPages: pageLinks?.length,
                    library: 'loc' as const,
                    displayName,
                    originalUrl: locUrl,
                };
                
                // Cache the manifest
                this.deps.manifestCache.set(locUrl, locManifest).catch(console.warn);
                
                (progressMonitor as any)['complete']();
                
                const totalElapsed = Date.now() - startTime;
                console.log(`[loadLocManifest] Successfully loaded manifest - Total pages: ${pageLinks?.length}, Time: ${totalElapsed}ms`);
                console.log(`[loadLocManifest] Display name: ${displayName}`);
                
                this.deps.logger.logManifestLoad('loc', locUrl, totalElapsed);
                this.deps.logger.log({
                    level: 'info',
                    library: 'loc',
                    url: locUrl,
                    message: `Manifest loaded successfully with ${pageLinks?.length} pages`,
                    duration: totalElapsed,
                    details: { totalPages: pageLinks?.length, displayName }
                });
                
                return locManifest;
                
            } catch (error: any) {
                (progressMonitor as any)['abort']();
                
                const elapsed = Date.now() - startTime;
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`[loadLocManifest] FAILED after ${elapsed}ms:`, errorMessage);
                console.error(`[loadLocManifest] Error details:`, {
                    url: locUrl,
                    manifestUrl: manifestUrl || 'not determined',
                    errorName: error instanceof Error ? (error as any)?.name : 'Unknown',
                    errorMessage: errorMessage,
                    stack: error instanceof Error ? error.stack : undefined
                });
                
                this.deps.logger.logManifestLoad(locUrl, 'loc', 0);
                
                throw new Error(`Failed to load Library of Congress manuscript: ${errorMessage}`);
            }
        }
}