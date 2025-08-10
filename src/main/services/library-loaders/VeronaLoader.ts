import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class VeronaLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'verona';
    }
    
    async loadManifest(originalUrl: string): Promise<ManuscriptManifest> {
            try {
                let manifestUrl: string;
                let displayName: string;
                
                if (originalUrl.includes('nbm.regione.veneto.it') && originalUrl.includes('/manifest/')) {
                    // Direct manifest URL
                    manifestUrl = originalUrl;
                    const manifestMatch = originalUrl.match(/manifest\/([^.]+)\.json/);
                    displayName = `Verona_NBM_${manifestMatch?.[1] || 'unknown'}`;
                    
                } else if (originalUrl.includes('nuovabibliotecamanoscritta.it')) {
                    // Extract codice from viewer page URL
                    let codiceDigital: string | undefined;
                    
                    if (originalUrl.includes('codice=')) {
                        const codiceMatch = originalUrl.match(/codice=(\d+)/);
                        codiceDigital = codiceMatch?.[1];
                    } else if (originalUrl.includes('codiceDigital=')) {
                        const codiceDigitalMatch = originalUrl.match(/codiceDigital=(\d+)/);
                        codiceDigital = codiceDigitalMatch?.[1];
                    }
                    
                    if (!codiceDigital) {
                        throw new Error('Cannot extract codiceDigital from Verona URL');
                    }
                    
                    // Extended mapping based on testing and research
                    const manifestMappings: { [key: string]: string } = {
                        '12': 'CXLV1331',
                        '14': 'CVII1001',
                        '15': 'LXXXIX841',
                        '17': 'msClasseIII81',
                        // Note: codice 16 mapping not found yet
                        // Add more mappings as discovered
                    };
                    
                    const manifestId = manifestMappings[codiceDigital];
                    if (!manifestId) {
                        // Try dynamic discovery approach
                        console.log(`Attempting dynamic discovery for Verona codice=${codiceDigital}`);
                        
                        // Common manifest ID patterns observed:
                        // - Roman numerals with Arabic numbers: CVII1001, LXXXIX841
                        // - ms. prefix: msClasseIII81
                        // Since we can't predict the pattern, provide helpful error
                        throw new Error(
                            `Unknown Verona manuscript code: ${codiceDigital}\n` +
                            `Known codes: 12, 14, 15, 17\n` +
                            `To add support for this manuscript:\n` +
                            `1. Find the manifest ID by checking nbm.regione.veneto.it\n` +
                            `2. Add mapping to the manifestMappings object\n` +
                            `Example: '${codiceDigital}': 'MANIFEST_ID'`
                        );
                    }
                    
                    manifestUrl = `https://nbm.regione.veneto.it/documenti/mirador_json/manifest/${manifestId}.json`;
                    displayName = `Verona_NBM_${manifestId}`;
                    
                } else {
                    throw new Error('Unsupported Verona URL format - must be NBM manifest URL or nuovabibliotecamanoscritta.it viewer URL');
                }
                
                // Fetch manifest with proper timeout handling
                console.log(`Loading Verona manifest: ${manifestUrl}`);
                this.deps.logger.logDownloadStart('verona', manifestUrl, {
                    codiceDigital: originalUrl.includes('codice=') ? originalUrl.match(/codice=(\d+)/)?.[1] : undefined,
                    manifestUrl
                });
                
                // Use fetchWithHTTPS for Verona to handle SSL/connection issues
                const response = await this.deps.fetchWithHTTPS(manifestUrl, {
                    headers: {
                        'Accept': 'application/json, application/ld+json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                });
                
                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error(`Manifest not found. The manuscript may have been moved or the ID mapping may be incorrect.`);
                    }
                    throw new Error(`Failed to fetch manifest: HTTP ${response.status}`);
                }
                
                const manifestData = await response.json();
                
                // Validate IIIF manifest structure
                if (!manifestData.sequences || !manifestData.sequences[0] || !manifestData.sequences[0].canvases) {
                    throw new Error('Invalid IIIF manifest structure');
                }
                
                const canvases = manifestData.sequences[0].canvases;
                console.log(`Found ${canvases.length} pages in Verona manuscript`);
                this.deps.logger.log({
                    level: 'info',
                    library: 'verona',
                    url: manifestUrl,
                    message: 'Verona manifest loaded successfully',
                    details: {
                        totalPages: canvases.length,
                        manuscriptLabel: manifestData.label || 'Unknown',
                        manifestSize: JSON.stringify(manifestData).length
                    }
                });
                
                // Log progress every 10 pages during URL extraction
                let lastLoggedProgress = 0;
                
                // Extract page URLs with maximum quality
                const pageLinks = canvases.map((canvas: any, index: number) => {
                    try {
                        const resource = canvas.images[0].resource;
                        
                        // NBM uses IIIF Image API - construct highest quality URL
                        if (resource.service && resource.service['@id']) {
                            const serviceId = resource.service['@id'].replace(/\/$/, ''); // Remove trailing slash to avoid double slashes
                            // Use full/full for maximum native resolution
                            const imageUrl = `${serviceId}/full/full/0/native.jpg`;
                            
                            // Log progress every 10 pages
                            if (index > 0 && index % 10 === 0 && index > lastLoggedProgress) {
                                lastLoggedProgress = index;
                                this.deps.logger.log({
                                    level: 'info',
                                    library: 'verona',
                                    url: manifestUrl,
                                    message: 'Processing page URLs',
                                    details: {
                                        processed: index + 1,
                                        total: canvases.length,
                                        percentage: Math.round(((index + 1) / canvases.length) * 100)
                                    }
                                });
                            }
                            
                            return imageUrl;
                        } else if (resource['@id']) {
                            // Direct resource URL - already at full resolution
                            return resource['@id'];
                        }
                        
                        console.warn(`Page ${index + 1}: No valid image URL found`);
                        return null;
                    } catch (err) {
                        console.warn(`Page ${index + 1}: Error extracting URL - ${err}`);
                        return null;
                    }
                }).filter((link: string) => link);
                
                if (pageLinks.length === 0) {
                    throw new Error('No valid page images found in manifest');
                }
                
                this.deps.logger.logDownloadComplete('verona', manifestUrl, {
                    validPages: pageLinks.length,
                    skippedPages: canvases.length - pageLinks.length,
                    firstPageUrl: pageLinks[0]?.substring(0, 100) + '...'
                });
                
                // Extract title from manifest
                const title = manifestData.label || manifestData['@label'] || displayName;
                
                return {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'verona',
                    displayName: title || displayName,
                    originalUrl: originalUrl,
                };
                
            } catch (error: any) {
                // Provide specific error messages for common issues
                if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT') || 
                    error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
                    // Check if this is actually a processing timeout vs connection timeout
                    if (error.message.includes('Verona server is not responding')) {
                        throw new Error(
                            `Verona NBM processing timeout. The manuscript may contain too many pages for initial loading. ` +
                            `Please try using the direct IIIF manifest URL from https://nbm.regione.veneto.it/ instead.`
                        );
                    }
                    throw new Error(
                        `Verona NBM server connection failed (${error.code || 'TIMEOUT'}). The server may be temporarily unavailable. ` +
                        `Please try again in a few minutes. If the problem persists, the server may be undergoing maintenance.`
                    );
                }
                throw new Error(`Failed to load Verona manuscript: ${(error as Error).message}`);
            }
        }
}