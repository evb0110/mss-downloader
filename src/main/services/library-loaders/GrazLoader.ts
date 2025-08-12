import fs from 'fs/promises';
import path from 'path';
import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';
import { getAppPath } from '../ElectronCompat';

export class GrazLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'graz';
    }
    
    async loadManifest(grazUrl: string): Promise<ManuscriptManifest> {
            let manifestUrl: string | undefined;
            
            try {
                console.log(`Loading University of Graz manifest: ${grazUrl}`);
                
                // Add error logging to file for crash recovery
                const crashLogPath = path.join(getAppPath('userData'), 'crash-recovery.log');
                await fs.appendFile(crashLogPath, `\n[${new Date().toISOString()}] Loading Graz manifest: ${grazUrl}\n`).catch(() => {});
                
                // Extract manuscript ID from URL
                // URL patterns: 
                // - https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538
                // - https://unipub.uni-graz.at/obvugrscript/content/pageview/8224540
                // - https://unipub.uni-graz.at/download/webcache/1504/8224544 (direct image URL)
                let manuscriptId: string;
                
                // Handle direct image download URL pattern
                if (grazUrl.includes('/download/webcache/')) {
                    // For webcache URLs, we can't reliably determine the manuscript ID from the page ID alone
                    // These URLs are meant to be accessed directly, not used to load full manuscripts
                    throw new Error('Direct webcache image URLs cannot be used to download full manuscripts. Please use a titleinfo or pageview URL instead (e.g., https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538)');
                } else {
                    // Handle standard content URLs
                    const manuscriptIdMatch = grazUrl.match(/\/(\d+)$/);
                    if (!manuscriptIdMatch) {
                        throw new Error('Could not extract manuscript ID from Graz URL');
                    }
                    
                    manuscriptId = manuscriptIdMatch[1];
                    
                    // If this is a pageview URL, convert to titleinfo ID using known pattern
                    // Pattern: pageview ID - 2 = titleinfo ID (e.g., 8224540 -> 8224538)
                    if (grazUrl.includes('/pageview/')) {
                        const pageviewId = parseInt(manuscriptId);
                        const titleinfoId = (pageviewId - 2).toString();
                        console.log(`Converting pageview ID ${pageviewId} to titleinfo ID ${titleinfoId}`);
                        manuscriptId = titleinfoId;
                    }
                }
                
                // Construct IIIF manifest URL
                const manifestUrl = `https://unipub.uni-graz.at/i3f/v20/${manuscriptId}/manifest`;
                console.log(`Fetching IIIF manifest from: ${manifestUrl}`);
                
                // Fetch the IIIF manifest with intelligent progress monitoring
                const headers = {
                    'Accept': 'application/json, application/ld+json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                };
                
                // FIXED: Enhanced progress monitoring for Graz's large IIIF manifests with better timeout handling
                const progressMonitor = this.deps.createProgressMonitor({
                    task: 'University of Graz manifest loading',
                    category: 'graz',
                    initialTimeout: 240000,     // 4 minutes initial (increased)
                    maxTimeout: 1200000,        // 20 minutes max (increased)
                    progressCheckInterval: 15000, // Check every 15 seconds
                    minProgressThreshold: 0.01,   // Any progress is good progress
                    onInitialTimeoutReached: (state: any) => {
                        console.log(`[Graz] ${state.statusMessage}`);
                    },
                    onStuckDetected: (state: any) => {
                        console.warn(`[Graz] ${state.statusMessage}`);
                    },
                    onProgressResumed: (state: any) => {
                        console.log(`[Graz] ${state.statusMessage}`);
                    },
                    onTimeout: (state: any) => {
                        console.error(`[Graz] ${state.statusMessage}`);
                    }
                });
                
                progressMonitor.start();
                progressMonitor.updateProgress(0, 1, 'Loading University of Graz IIIF manifest...');
                
                let response: Response;
                let manifestData: any;
                try {
                    console.log(`[Graz] Starting manifest fetch with extended timeout for Issue #2...`);
                    // ULTRA-PRIORITY FIX for Issue #2: Extended timeout for Windows IPC stability
                    const isWindows = process.platform === 'win32';
                    const timeout = isWindows ? 600000 : 300000; // 10 minutes for Windows, 5 for others
                    
                    response = await this.deps.fetchWithHTTPS(manifestUrl, { 
                        headers,
                        timeout // Dynamic timeout based on platform
                    });
                    
                    if (!response.ok) {
                        throw new Error(`Failed to fetch IIIF manifest: ${response.status} ${response.statusText}`);
                    }
                    
                    progressMonitor.updateProgress(0.5, 1, 'IIIF manifest downloaded, parsing...');
                    
                    // Parse JSON with timeout protection
                    const jsonText = await response.text();
                    console.log(`Graz manifest size: ${(jsonText.length / 1024).toFixed(1)} KB`);
                    
                    try {
                        manifestData = JSON.parse(jsonText);
                    } catch (parseError) {
                        throw new Error(`Failed to parse IIIF manifest JSON: ${(parseError as Error).message}`);
                    }
                    
                    progressMonitor.updateProgress(1, 1, 'IIIF manifest parsed successfully');
                } catch (error: any) {
                    console.error(`[Graz] Manifest loading error:`, error);
                    console.error(`[Graz] Error code: ${error.code}, Error name: ${error.name}`);
                    console.error(`[Graz] Full error details:`, JSON.stringify(error, null, 2));
                    
                    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
                        throw new Error('University of Graz manifest loading timed out. The server may be experiencing high load. Please try again in a few moments.');
                    }
                    if (error.code === 'ECONNRESET') {
                        throw new Error('University of Graz connection was reset. This often happens with large manuscripts. Please try again.');
                    }
                    if (error.code === 'ENOTFOUND') {
                        throw new Error('University of Graz server could not be found. Please check your internet connection.');
                    }
                    if (error.code === 'ECONNREFUSED') {
                        throw new Error('University of Graz server refused the connection. The server may be down for maintenance.');
                    }
                    throw error;
                } finally {
                    progressMonitor.complete();
                }
                
                // Use already-parsed manifestData
                const manifest = manifestData;
                console.log(`IIIF manifest loaded, processing canvases...`);
                
                const pageLinks: string[] = [];
                let displayName = 'University of Graz Manuscript';
                
                // Extract title from manifest metadata
                if (manifest.label) {
                    if (typeof manifest.label === 'string') {
                        displayName = manifest.label;
                    } else if (manifest.label['@value']) {
                        displayName = manifest.label['@value'];
                    } else if (manifest.label.en) {
                        displayName = Array.isArray(manifest.label.en) ? manifest.label.en[0] : manifest.label.en;
                    } else if (manifest.label.de) {
                        displayName = Array.isArray(manifest.label.de) ? manifest.label.de[0] : manifest.label.de;
                    }
                }
                
                // Process IIIF sequences and canvases
                if (manifest.sequences && manifest.sequences.length > 0) {
                    const sequence = manifest.sequences[0];
                    console.log(`[Graz] Processing ${sequence.canvases?.length || 0} canvases from manifest`);
                    
                    if (sequence.canvases) {
                        for (const canvas of sequence.canvases) {
                            if (canvas.images && canvas.images.length > 0) {
                                const image = canvas.images[0];
                                let imageUrl = '';
                                
                                // Use webcache URLs for highest resolution
                                if (image.resource && image.resource['@id']) {
                                    const resourceId = image.resource['@id'];
                                    
                                    // Convert webcache URLs to highest available resolution
                                    // Pattern: https://unipub.uni-graz.at/download/webcache/SIZE/PAGE_ID
                                    if (resourceId.includes('/download/webcache/')) {
                                        // Extract page ID from the URL
                                        const pageIdMatch = resourceId.match(/\/webcache\/\d+\/(\d+)$/);
                                        if (pageIdMatch) {
                                            const pageId = pageIdMatch[1];
                                            // Use highest available resolution (2000px)
                                            imageUrl = `https://unipub.uni-graz.at/download/webcache/2000/${pageId}`;
                                        } else {
                                            console.warn(`University of Graz: Unexpected webcache URL format: ${resourceId}`);
                                            // Fallback to original URL if pattern doesn't match
                                            imageUrl = resourceId;
                                        }
                                    } else {
                                        // Not a webcache URL, use as-is
                                        imageUrl = resourceId;
                                    }
                                } else if (image.resource && image.resource.service && image.resource.service['@id']) {
                                    // Legacy fallback to IIIF service URL (shouldn't be needed for Graz)
                                    const serviceId = image.resource.service['@id'];
                                    imageUrl = `${serviceId}/full/full/0/default.jpg`;
                                    console.warn(`University of Graz: Using legacy IIIF service URL: ${imageUrl}`);
                                }
                                
                                if (imageUrl) {
                                    pageLinks.push(imageUrl);
                                }
                            }
                        }
                    }
                }
                
                if (pageLinks.length === 0) {
                    console.error(`[Graz] No page images found in manifest structure`);
                    console.error(`[Graz] Manifest sequences: ${manifest.sequences?.length || 0}`);
                    console.error(`[Graz] First sequence canvases: ${manifest.sequences?.[0]?.canvases?.length || 0}`);
                    throw new Error('No page images found in IIIF manifest. The manifest structure may be different than expected.');
                }
                
                // Sanitize display name for filesystem
                const sanitizedName = displayName
                    .replace(/[<>:"/\\|?*]/g, '_')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .replace(/\.$/, ''); // Remove trailing period
                
                console.log(`University of Graz manifest loaded: ${pageLinks.length} pages`);
                if (pageLinks.length > 0) {
                    console.log(`First page URL: ${pageLinks[0]}`);
                    console.log(`Last page URL: ${pageLinks[pageLinks.length - 1]}`);
                }
                
                return {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'graz' as any,
                    displayName: sanitizedName,
                    originalUrl: grazUrl,
                };
                
            } catch (error: any) {
                console.error(`[Graz] loadGrazManifest failed:`, error);
                console.error(`[Graz] Error stack:`, error.stack);
                console.error(`[Graz] Original URL: ${grazUrl}`);
                console.error(`[Graz] Manifest URL attempted: ${manifestUrl || 'not constructed'}`);
                
                // Write error to crash log file to persist even if app crashes
                try {
                    const crashLogPath = path.join(getAppPath('userData'), 'crash-recovery.log');
                    const errorDetails = `
    [${new Date().toISOString()}] Graz Manifest Error:
    URL: ${grazUrl}
    Manifest URL: ${manifestUrl || 'not constructed'}
    Error: ${error.message || 'Unknown error'}
    Code: ${error.code || 'N/A'}
    Stack: ${error.stack || 'No stack trace'}
    ---
    `;
                    await fs.appendFile(crashLogPath, errorDetails).catch(() => {});
                } catch (logErr) {
                    console.error('Failed to write crash log:', logErr);
                }
                
                // Log to download logger for better debugging
                this.deps.logger.logError('manifest_load_error', error, {
                    library: 'graz',
                    url: grazUrl,
                    manifestUrl: manifestUrl || 'not constructed',
                    errorCode: error.code,
                    errorName: error.name
                });
                
                // Enhanced error messages for specific network issues
                if (error.code === 'ETIMEDOUT') {
                    throw new Error(`University of Graz connection timeout. The server is not responding - this may be due to high load or network issues. Please try again later or check if the manuscript is accessible through the Graz website at unipub.uni-graz.at`);
                }
                
                if (error.code === 'ECONNRESET') {
                    throw new Error(`University of Graz connection was reset. The server closed the connection unexpectedly. This often happens with large manuscripts. Please try again in a few moments.`);
                }
                
                if (error.code === 'ENOTFOUND') {
                    throw new Error(`University of Graz server could not be reached. Please check your internet connection and verify that unipub.uni-graz.at is accessible.`);
                }
                
                if (error.message?.includes('timeout')) {
                    throw new Error(`University of Graz request timed out. Large manuscripts from Graz can take several minutes to load. The system automatically extends timeouts for Graz, but the server may still be experiencing issues. Please try again.`);
                }
                
                if (error.message?.includes('AbortError')) {
                    throw new Error(`University of Graz manifest loading was cancelled. The manifest may be very large or the server may be experiencing issues. Please try again.`);
                }
                
                if (error.message?.includes('Could not extract manuscript ID')) {
                    throw new Error(`Invalid Graz URL format. Please use a URL like: https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538`);
                }
                
                throw new Error(`Failed to load University of Graz manuscript: ${(error as Error).message}`);
            }
        }
}