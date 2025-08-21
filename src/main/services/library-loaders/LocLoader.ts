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
                
                // Check if this is a partial tile URL (like the stuck download case)
                if (locUrl.includes('tile.loc.gov') && locUrl.includes('/full/full/0/default.')) {
                    console.log(`[loadLocManifest] Detected partial tile URL - extracting service base`);
                    // Extract service ID: tile.loc.gov/image-services/iiif/service:rbc:rbc0001:2022:2022vollb14164:0081/full/full/0/default.jpg
                    const serviceMatch = locUrl.match(/\/service:([^\/]+)\/full\/full\/0\/default\./);
                    if (serviceMatch) {
                        const serviceId = `service:${serviceMatch[1]}`;
                        manifestUrl = `https://tile.loc.gov/image-services/iiif/${serviceId}/info.json`;
                        console.log(`[loadLocManifest] Reconstructed info.json URL: ${manifestUrl}`);
                        
                        // This will be processed as IIIF Image API info.json instead of manifest
                        return await this.loadFromImageInfo(manifestUrl, locUrl);
                    }
                }
                
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
                
                // Load IIIF manifest with rate limiting protection
                const response = await this.fetchWithRateLimit(manifestUrl);
                
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
                    throw new Error(`Failed to load LOC manifest: HTTP ${response.status} - ${manifestUrl}`);
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

    private async loadFromImageInfo(infoUrl: string, originalUrl: string): Promise<ManuscriptManifest> {
        console.log(`[loadFromImageInfo] Loading IIIF Image API info from: ${infoUrl}`);
        
        try {
            const response = await this.fetchWithRateLimit(infoUrl);
            
            if (!response.ok) {
                throw new Error(`Failed to load image info: HTTP ${response.status}`);
            }
            
            const imageInfo = await response.json();
            console.log(`[loadFromImageInfo] Image info loaded:`, {
                width: imageInfo.width,
                height: imageInfo.height,
                id: imageInfo['@id'] || imageInfo.id
            });
            
            // Extract service base URL from info response
            const serviceId = imageInfo['@id'] || imageInfo.id;
            if (!serviceId) {
                throw new Error('No service ID found in image info');
            }
            
            // Create a single high-resolution page URL
            const fullImageUrl = `${serviceId}/full/full/0/default.jpg`;
            console.log(`[loadFromImageInfo] Full image URL: ${fullImageUrl}`);
            
            // Extract title from original URL or use default
            let displayName = 'Library of Congress Manuscript';
            const serviceMatch = originalUrl.match(/service:([^:]+):([^:]+):([^:]+):([^:]+):([^\/]+)/);
            if (serviceMatch) {
                displayName = `${serviceMatch[2]} - ${serviceMatch[4]} (Page ${serviceMatch[5]})`;
            }
            
            const manifest = {
                pageLinks: [fullImageUrl],
                totalPages: 1,
                library: 'loc' as const,
                displayName,
                originalUrl: originalUrl,
            };
            
            console.log(`[loadFromImageInfo] Successfully created manifest for full image`);
            console.log(`[loadFromImageInfo] Display name: ${displayName}`);
            
            return manifest;
            
        } catch (error: any) {
            console.error(`[loadFromImageInfo] Failed:`, error);
            throw new Error(`Failed to load LoC image info: ${error.message}`);
        }
    }

    private async fetchWithRateLimit(url: string, attempt: number = 1, maxAttempts: number = 8): Promise<Response> {
        console.log(`[fetchWithRateLimit] Attempt ${attempt}/${maxAttempts} for: ${url}`);
        
        // Add initial delay for first request to help avoid rate limiting
        if (attempt === 1) {
            const initialDelay = 1 + Math.random() * 2; // 1-3 second random delay
            console.log(`[fetchWithRateLimit] Initial delay: ${initialDelay.toFixed(1)}s`);
            await new Promise(resolve => setTimeout(resolve, initialDelay * 1000));
        }
        
        try {
            const response = await this.deps.fetchDirect(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'application/json, application/ld+json, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (response.status === 429) {
                if (attempt >= maxAttempts) {
                    console.error(`[fetchWithRateLimit] Max retries exceeded for HTTP 429 on: ${url}`);
                    throw new Error(`LoC rate limit exceeded after ${maxAttempts} attempts`);
                }
                
                // Exponential backoff with jitter: 3s, 6s, 12s, 24s, 48s, 96s, 192s, 384s
                const baseDelay = 3 * Math.pow(2, attempt - 1);
                // Add random jitter (±20%) to avoid synchronized retries
                const jitter = 0.2 * baseDelay * (Math.random() * 2 - 1);
                const delaySeconds = Math.max(1, baseDelay + jitter);
                console.log(`[fetchWithRateLimit] HTTP 429 detected - waiting ${delaySeconds.toFixed(1)}s before retry ${attempt + 1}/${maxAttempts}`);
                
                await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
                return this.fetchWithRateLimit(url, attempt + 1, maxAttempts);
            }
            
            if (response.status >= 500) {
                if (attempt >= maxAttempts) {
                    console.error(`[fetchWithRateLimit] Max retries exceeded for HTTP ${response.status} on: ${url}`);
                    throw new Error(`LoC server error ${response.status} after ${maxAttempts} attempts`);
                }
                
                // Shorter delay for server errors: 1s, 2s, 3s, 4s
                const delaySeconds = attempt;
                console.log(`[fetchWithRateLimit] HTTP ${response.status} detected - waiting ${delaySeconds}s before retry ${attempt + 1}/${maxAttempts}`);
                
                await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
                return this.fetchWithRateLimit(url, attempt + 1, maxAttempts);
            }
            
            return response;
            
        } catch (error: any) {
            if (attempt >= maxAttempts) {
                console.error(`[fetchWithRateLimit] Network error after ${maxAttempts} attempts:`, error);
                throw error;
            }
            
            const delaySeconds = attempt;
            console.log(`[fetchWithRateLimit] Network error - waiting ${delaySeconds}s before retry ${attempt + 1}/${maxAttempts}:`, error.message);
            
            await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
            return this.fetchWithRateLimit(url, attempt + 1, maxAttempts);
        }
    }
}