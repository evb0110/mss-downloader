import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class HhuLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'hhu';
    }
    
    async loadManifest(hhuUrl: string): Promise<ManuscriptManifest> {
            const startTime = Date.now();
            console.log(`[HHU] Starting manifest load from URL: ${hhuUrl}`);
            
            try {
                // Extract manuscript ID from URL
                // URL format: https://digital.ulb.hhu.de/i3f/v20/7674176/manifest
                let manifestUrl: string;
                let manuscriptId: string | null = null;
                
                console.log('[HHU] Parsing URL to extract manuscript ID...');
                
                if (hhuUrl.includes('/manifest')) {
                    // Already a manifest URL
                    manifestUrl = hhuUrl;
                    const idMatch = hhuUrl.match(/\/v20\/(\d+)\/manifest/);
                    if (idMatch) {
                        manuscriptId = idMatch[1];
                    }
                    console.log(`[HHU] Found manifest URL, manuscript ID: ${manuscriptId}`);
                } else {
                    // Extract ID from various URL formats
                    let idMatch = hhuUrl.match(/\/v20\/(\d+)/);
                    if (!idMatch) {
                        // Try content/titleinfo format
                        idMatch = hhuUrl.match(/\/titleinfo\/(\d+)/);
                    }
                    if (!idMatch) {
                        // Try content/pageview format
                        idMatch = hhuUrl.match(/\/pageview\/(\d+)/);
                    }
                    if (!idMatch) {
                        throw new Error('Could not extract manuscript ID from HHU URL');
                    }
                    manuscriptId = idMatch[1];
                    manifestUrl = `https://digital.ulb.hhu.de/i3f/v20/${manuscriptId}/manifest`;
                    console.log(`[HHU] Extracted manuscript ID: ${manuscriptId}, manifest URL: ${manifestUrl}`);
                }
                
                let displayName = `HHU Düsseldorf - ${manuscriptId || 'Manuscript'}`;
                
                console.log(`[HHU] Loading manifest from: ${manifestUrl}`);
                
                // Set a timeout for the manifest fetch
                const fetchTimeout = 60000; // 60 seconds timeout for manifest loading
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => {
                        reject(new Error(`HHU manifest loading timeout after ${fetchTimeout / 1000} seconds`));
                    }, fetchTimeout);
                });
                
                try {
                    const response = await Promise.race([
                        this.deps.fetchWithHTTPS(manifestUrl),
                        timeoutPromise
                    ]);
                    
                    // Check if we got a valid Response object
                    if (!response || typeof response.text !== 'function') {
                        console.error('[HHU] Invalid response object:', response);
                        throw new Error('Invalid response received from HHU server - expected Response object');
                    }
                    
                    console.log(`[HHU] Manifest fetch completed in ${Date.now() - startTime}ms`);
                    console.log(`[HHU] Parsing manifest JSON...`);
                    
                    const responseText = await response.text();
                    
                    // Additional validation before parsing
                    if (!responseText || responseText.trim().length === 0) {
                        throw new Error('Empty response received from HHU server');
                    }
                    
                    // Check if response is HTML error page
                    if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
                        console.error('[HHU] Received HTML instead of JSON, first 500 chars:', responseText.substring(0, 500));
                        throw new Error('Received HTML error page instead of JSON manifest from HHU server');
                    }
                    
                    let manifest;
                    try {
                        manifest = JSON.parse(responseText);
                    } catch (parseError: unknown) {
                        console.error('[HHU] JSON parse error:', parseError);
                        console.error('[HHU] Response text (first 500 chars):', responseText.substring(0, 500));
                        throw new Error(`Failed to parse HHU manifest JSON: ${parseError.message}`);
                    }
                
                    // Extract metadata from IIIF manifest
                    if (manifest.label) {
                        displayName = `HHU - ${manifest.label}`;
                        console.log(`[HHU] Manuscript label: ${manifest.label}`);
                    }
                    
                    if (!manifest.sequences || !manifest.sequences[0] || !manifest.sequences[0].canvases) {
                        console.error('[HHU] Invalid manifest structure:', {
                            hasSequences: !!manifest.sequences,
                            hasFirstSequence: !!(manifest.sequences && manifest.sequences[0]),
                            hasCanvases: !!(manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases)
                        });
                        throw new Error('Invalid IIIF manifest structure - missing sequences or canvases');
                    }
                    
                    const canvases = manifest.sequences[0].canvases;
                    const pageLinks: string[] = [];
                    
                    console.log(`[HHU] Processing ${canvases.length} pages from manuscript`);
                    
                    // Process each canvas to extract maximum quality image URLs
                    for (let i = 0; i < canvases.length; i++) {
                        const canvas = canvases[i];
                        if (!canvas.images || !canvas.images[0]) {
                            console.warn(`[HHU] Canvas ${i + 1} has no images, skipping`);
                            continue;
                        }
                        
                        const image = canvas.images[0];
                        const resource = image.resource;
                        
                        if (resource.service && resource.service['@id']) {
                            const serviceId = resource.service['@id'];
                            // Use maximum resolution - full/full/0/default.jpg
                            const imageUrl = `${serviceId}/full/full/0/default.jpg`;
                            pageLinks.push(imageUrl);
                            if (i < 3 || i === canvases.length - 1) {
                                console.log(`[HHU] Page ${i + 1} image URL: ${imageUrl}`);
                            }
                        } else if (resource['@id']) {
                            // Fallback to direct image URL
                            pageLinks.push(resource['@id']);
                            console.log(`[HHU] Page ${i + 1} using direct URL: ${resource['@id']}`);
                        } else {
                            console.warn(`[HHU] Page ${i + 1} has no accessible image URL`);
                        }
                    }
                    
                    if (pageLinks.length === 0) {
                        console.error('[HHU] No valid image URLs found in manifest');
                        throw new Error('No images found in HHU manifest');
                    }
                    
                    console.log(`[HHU] Successfully extracted ${pageLinks.length} pages in ${Date.now() - startTime}ms`);
                    this.deps.logger.logDownloadComplete('hhu', manifestUrl, {
                        totalPages: pageLinks.length,
                        processingTime: Date.now() - startTime,
                        firstPageUrl: pageLinks[0]?.substring(0, 100) + '...'
                    });
                    
                    return {
                        displayName,
                        totalPages: pageLinks.length,
                        library: 'hhu',
                        pageLinks,
                        originalUrl: hhuUrl
                    };
                    
                } catch (fetchError: unknown) {
                    console.error(`[HHU] Manifest fetch/parse error: ${fetchError.message}`);
                    throw fetchError;
                }
                
            } catch (error: unknown) {
                const duration = Date.now() - startTime;
                console.error(`[HHU] Failed to load manifest after ${duration}ms:`, {
                    url: hhuUrl,
                    error: error.message,
                    stack: error.stack
                });
                
                // Provide more specific error messages
                if (error.message.includes('timeout')) {
                    throw new Error(`HHU Düsseldorf manifest loading timed out after ${duration / 1000} seconds. The server may be slow or unresponsive. Please try again later or check if the manuscript is accessible at ${hhuUrl}`);
                } else if (error.message.includes('Could not extract manuscript ID')) {
                    throw new Error(`Invalid HHU URL format. Expected formats: /i3f/v20/[ID]/manifest, /content/titleinfo/[ID], or /content/pageview/[ID]. Received: ${hhuUrl}`);
                } else if (error.message.includes('Invalid IIIF manifest structure')) {
                    throw new Error(`HHU server returned an invalid IIIF manifest. The manuscript may not be available or the server format may have changed.`);
                } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
                    throw new Error(`Cannot connect to HHU Düsseldorf server. Please check your internet connection and verify the URL is correct.`);
                } else {
                    throw new Error(`Failed to load HHU Düsseldorf manuscript: ${error.message}`);
                }
            }
        }
}