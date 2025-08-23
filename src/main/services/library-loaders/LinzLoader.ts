import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';
import { AnubisSolver } from '../AnubisSolver';

export class LinzLoader extends BaseLibraryLoader {
    private anubisSolver: AnubisSolver;
    
    constructor(deps: LoaderDependencies) {
        super(deps);
        this.anubisSolver = new AnubisSolver();
    }
    
    getLibraryName(): string {
        return 'linz';
    }
    
    async loadManifest(url: string): Promise<ManuscriptManifest> {
        console.log('[LinzLoader] Processing URL:', url);
        
        // Extract manuscript ID from URL pattern like /viewer/image/116/
        let manuscriptId: string;
        const idMatch = url.match(/\/viewer\/image\/([^/]+)/);
        
        if (idMatch) {
            manuscriptId = idMatch[1] || '';
        } else {
            // Try other patterns
            const altMatch = url.match(/\/(\d+)$/);
            if (altMatch) {
                manuscriptId = altMatch[1] || '';
            } else {
                throw new Error('Could not extract manuscript ID from Linz URL');
            }
        }
        
        console.log('[LinzLoader] Manuscript ID:', manuscriptId);
        
        // Linz uses Goobi viewer with standard IIIF manifest endpoint
        const manifestUrl = `https://digi.landesbibliothek.at/viewer/api/v1/records/${manuscriptId}/manifest/`;
        console.log('[LinzLoader] Fetching IIIF manifest from:', manifestUrl);
        
        try {
            let response = await this.deps.fetchWithHTTPS(manifestUrl, {
                headers: {
                    'Accept': 'application/json, application/ld+json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch Linz manifest: ${response.status}`);
            }
            
            let manifest: any;
            
            // Check if we got an Anubis anti-bot challenge instead of JSON
            try {
                manifest = await response.json();
            } catch (jsonError) {
                const html = await response.text();
                
                // Check for Anubis anti-bot protection
                if (html.includes('Making sure you\'re not a bot') || html.includes('anubis_challenge')) {
                    console.log('[LinzLoader] Anubis anti-bot protection detected, solving challenge...');
                    
                    // Extract and solve the challenge
                    const challenge = this.anubisSolver.extractChallengeFromPage(html);
                    if (!challenge) {
                        throw new Error('Could not extract Anubis challenge from Linz page');
                    }
                    
                    console.log(`[LinzLoader] Solving Anubis challenge with difficulty ${challenge.difficulty}...`);
                    const solution = await this.anubisSolver.solveChallenge(challenge);
                    if (!solution) {
                        throw new Error('Failed to solve Anubis challenge for Linz library');
                    }
                    
                    console.log('[LinzLoader] Anubis challenge solved, retrying manifest request...');
                    
                    // Submit solution (this may set cookies for future requests)
                    const baseUrl = 'https://digi.landesbibliothek.at';
                    await this.anubisSolver.submitSolution(solution, baseUrl, this.deps.fetchWithHTTPS);
                    
                    // Retry the original request with any cookies that were set
                    response = await this.deps.fetchWithHTTPS(manifestUrl, {
                        headers: {
                            'Accept': 'application/json, application/ld+json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error(`Linz manifest request failed after solving Anubis challenge: ${response.status}`);
                    }
                    
                    try {
                        manifest = await response.json();
                    } catch (retryJsonError) {
                        throw new Error(`Linz still returning non-JSON after solving Anubis challenge. This may require browser-specific implementation.`);
                    }
                } else {
                    throw new Error(`Failed to parse Linz manifest as JSON: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
                }
            }
            const images: Array<{ url: string; label: string }> = [];
            
            // Extract images from IIIF manifest
            if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
                const canvases = manifest.sequences[0].canvases;
                console.log(`[LinzLoader] Found ${canvases?.length} pages in manifest`);
                
                for (let i = 0; i < canvases?.length; i++) {
                    const canvas = canvases[i];
                    if (canvas.images && canvas.images[0]) {
                        const image = canvas.images[0];
                        let imageUrl: string | null = null;
                        
                        // Handle different IIIF image formats
                        if (image.resource) {
                            if (typeof image.resource === 'string') {
                                imageUrl = image.resource;
                            } else if (image.resource['@id']) {
                                imageUrl = image.resource['@id'];
                            } else if (image.resource.id) {
                                imageUrl = image.resource.id;
                            }
                        }
                        
                        // If it's a IIIF image service, construct full resolution URL
                        if (imageUrl && imageUrl.includes('/info.json')) {
                            imageUrl = imageUrl.replace('/info.json', '/full/max/0/default.jpg');
                        } else if (imageUrl && imageUrl.includes('/full/!')) {
                            // Linz returns URLs with size restrictions like /full/!400,400/, change to full resolution
                            imageUrl = imageUrl.replace(/\/full\/![^/]+\//, '/full/max/');
                        }
                        
                        if (imageUrl) {
                            images.push({
                                url: imageUrl,
                                label: canvas.label || `Page ${i + 1}`
                            });
                        }
                    }
                }
            }
            
            if (images?.length === 0) {
                throw new Error('No images found in Linz manifest');
            }
            
            console.log(`[LinzLoader] Successfully extracted ${images?.length} pages`);
            
            return {
                pageLinks: images.map(img => img.url),
                totalPages: images?.length,
                library: 'linz' as const,
                displayName: manifest.label || `Linz - ${manuscriptId}`,
                originalUrl: url
            };
            
        } catch (error) {
            console.error('[LinzLoader] Error loading manifest:', error);
            throw new Error(`Failed to load Linz manuscript: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}