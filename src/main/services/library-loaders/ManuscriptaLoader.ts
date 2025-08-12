import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class ManuscriptaLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'manuscripta';
    }
    
    async loadManifest(manuscriptaUrl: string): Promise<ManuscriptManifest> {
            try {
                console.log(`Loading Manuscripta.se manuscript: ${manuscriptaUrl}`);
                
                // Extract manuscript ID from URL: https://manuscripta.se/ms/101124 -> 101124
                const idMatch = manuscriptaUrl.match(/\/ms\/(\d+)/);
                if (!idMatch) {
                    throw new Error('Invalid Manuscripta.se URL format. Expected format: https://manuscripta.se/ms/{id}');
                }
                
                const manuscriptId = idMatch[1];
                const manifestUrl = `https://manuscripta.se/iiif/${manuscriptId}/manifest.json`;
                
                console.log(`Loading Manuscripta.se manifest from: ${manifestUrl}`);
                
                // Use intelligent progress monitoring for Manuscripta.se with enhanced error handling
                const progressMonitor = this.deps.createProgressMonitor({
                    task: 'Manuscripta.se manifest loading',
                    category: 'manuscripta',
                    initialTimeout: 60000,
                    maxTimeout: 300000,
                    progressCheckInterval: 15000,
                    onInitialTimeoutReached: (state: any) => {
                        console.log(`[Manuscripta.se] ${state.statusMessage}`);
                    },
                    onStuckDetected: (state: any) => {
                        console.warn(`[Manuscripta.se] ${state.statusMessage} - ID: ${manuscriptId}`);
                    },
                    onTimeout: (state: any) => {
                        console.error(`[Manuscripta.se] ${state.statusMessage} - ID: ${manuscriptId}`);
                    }
                });
                
                const controller = progressMonitor.start();
                progressMonitor.updateProgress(0, 1, 'Loading Manuscripta.se manifest...');
                
                let iiifManifest: any;
                try {
                    const manifestResponse = await this.deps.fetchWithProxyFallback(manifestUrl, {
                        signal: controller.signal,
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                            'Cache-Control': 'no-cache'
                        }
                    });
                    
                    progressMonitor.updateProgress(1, 1, 'Manuscripta.se manifest loaded successfully');
                    
                    if (!manifestResponse.ok) {
                        throw new Error(`Failed to fetch Manuscripta.se manifest: HTTP ${manifestResponse.status} ${manifestResponse.statusText}`);
                    }
                    
                    iiifManifest = await manifestResponse.json();
                    
                    // Validate manifest structure
                    if (!iiifManifest) {
                        throw new Error('Empty manifest received from Manuscripta.se');
                    }
                    
                    console.log(`Manuscripta.se manifest loaded successfully for ID: ${manuscriptId}`);
                    
                } catch (fetchError: any) {
                    if (fetchError.name === 'AbortError') {
                        throw new Error('Manuscripta.se manifest request timed out. The server may be experiencing high load.');
                    }
                    throw fetchError;
                } finally {
                    progressMonitor.complete();
                }
                
                // Extract title from manifest
                let displayName = 'Manuscripta_' + manuscriptId;
                if (iiifManifest.label) {
                    if (typeof iiifManifest.label === 'string') {
                        displayName = iiifManifest.label;
                    } else if (Array.isArray(iiifManifest.label)) {
                        displayName = iiifManifest.label[0];
                    } else if (typeof iiifManifest.label === 'object') {
                        // IIIF 3.0 format with language maps
                        const labelValues = Object.values(iiifManifest.label);
                        if (labelValues.length > 0 && Array.isArray(labelValues[0])) {
                            displayName = (labelValues[0] as string[])[0];
                        }
                    }
                }
                
                // Parse IIIF manifest structure - support both IIIF 2.x and 3.x
                let canvases: any[] = [];
                
                if (iiifManifest.sequences && iiifManifest.sequences[0] && iiifManifest.sequences[0].canvases) {
                    // IIIF 2.x structure
                    canvases = iiifManifest.sequences[0].canvases;
                } else if (iiifManifest.items) {
                    // IIIF 3.x structure
                    canvases = iiifManifest.items;
                } else {
                    throw new Error('Invalid IIIF manifest structure - no canvases found');
                }
                
                const pageLinks = canvases.map((canvas: any) => {
                    let imageUrl: string | null = null;
                    
                    // IIIF 2.x format
                    if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                        const resource = canvas.images[0].resource;
                        imageUrl = resource['@id'] || resource.id;
                    }
                    // IIIF 3.x format
                    else if (canvas.items && canvas.items[0] && canvas.items[0].items && canvas.items[0].items[0]) {
                        const annotation = canvas.items[0].items[0];
                        if (annotation.body && annotation.body.id) {
                            imageUrl = annotation.body.id;
                        }
                    }
                    
                    if (!imageUrl) {
                        return null;
                    }
                    
                    // Convert to full resolution IIIF image URL if needed
                    if (imageUrl.includes('/iiif/') && !imageUrl.includes('/full/')) {
                        // Ensure proper IIIF Image API format: {scheme}://{server}{/prefix}/{identifier}/full/max/0/default.jpg
                        const iiifBase = imageUrl.split('/info.json')[0];
                        return `${iiifBase}/full/max/0/default.jpg`;
                    }
                    
                    return imageUrl;
                }).filter((link: string | null): link is string => link !== null);
                
                if (pageLinks.length === 0) {
                    throw new Error('No pages found in manifest');
                }
                
                console.log(`Successfully loaded Manuscripta.se manifest: ${pageLinks.length} pages found`);
                
                // Sanitize display name for filesystem
                const sanitizedName = displayName
                    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
                    .replace(/\.+$/, '')
                    .substring(0, 150) || `Manuscripta_${manuscriptId}`;
                
                return {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'manuscripta' as any,
                    displayName: sanitizedName,
                    originalUrl: manuscriptaUrl,
                };
                
            } catch (error: any) {
                console.error(`Manuscripta.se manifest loading failed:`, error);
                throw new Error(`Failed to load Manuscripta.se manuscript: ${(error as Error).message}`);
            }
        }
}