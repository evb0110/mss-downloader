import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class TorontoLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'toronto';
    }
    
    async loadManifest(torontoUrl: string): Promise<ManuscriptManifest> {
            try {
                let manifestUrl = torontoUrl;
                let displayName = 'University of Toronto Manuscript';
                
                // Handle collections.library.utoronto.ca URLs
                if (torontoUrl.includes('collections.library.utoronto.ca')) {
                    // Extract item ID from URL: https://collections.library.utoronto.ca/view/fisher2:F6521
                    const viewMatch = torontoUrl.match(/\/view\/([^/]+)/);
                    if (viewMatch) {
                        const itemId = viewMatch[1];
                        displayName = `University of Toronto - ${itemId}`;
                        
                        // Try different manifest URL patterns
                        const manifestPatterns = [
                            `https://iiif.library.utoronto.ca/presentation/v2/${itemId || ''}/manifest`,
                            `https://iiif.library.utoronto.ca/presentation/v2/${itemId?.replace(':', '%3A') || ''}/manifest`,
                            `https://iiif.library.utoronto.ca/presentation/v3/${itemId || ''}/manifest`,
                            `https://iiif.library.utoronto.ca/presentation/v3/${itemId?.replace(':', '%3A') || ''}/manifest`,
                            `https://collections.library.utoronto.ca/iiif/${itemId}/manifest`,
                            `https://collections.library.utoronto.ca/iiif/${itemId!.replace(':', '%3A')}/manifest`,
                            `https://collections.library.utoronto.ca/api/iiif/${itemId}/manifest`,
                            `https://collections.library.utoronto.ca/api/iiif/${itemId!.replace(':', '%3A')}/manifest`
                        ];
                        
                        let manifestFound = false;
                        const urlErrors: Array<{url: string, error: string, code?: string}> = [];
                        
                        for (const testUrl of manifestPatterns) {
                            try {
                                const response = await this.deps.fetchDirect(testUrl);
                                if (response.ok) {
                                    const content = await response.text();
                                    if (content.includes('"@context"') && (content.includes('manifest') || content.includes('Manifest'))) {
                                        manifestUrl = testUrl;
                                        manifestFound = true;
                                        break;
                                    }
                                }
                            } catch (error: any) {
                                // Collect error details for better diagnostics
                                urlErrors.push({
                                    url: testUrl,
                                    error: error?.message || 'Unknown error',
                                    code: error?.code
                                });
                                console.warn(`Toronto manifest pattern failed: ${testUrl} - ${error?.message || 'Unknown error'} (code: ${error?.code || 'none'})`);
                            }
                        }
                        
                        if (!manifestFound) {
                            // Analyze collected errors to provide better diagnostics
                            const networkTimeoutErrors = urlErrors.filter(e => e.code === 'ETIMEDOUT' || e.error.toLowerCase().includes('timeout'));
                            const connectionRefusedErrors = urlErrors.filter(e => e.code === 'ECONNREFUSED');
                            const dnsErrors = urlErrors.filter(e => e.code === 'ENOTFOUND');
                            const httpErrors = urlErrors.filter(e => e.error.includes('HTTP') || e.error.includes('404') || e.error.includes('403'));
                            
                            let diagnosticMessage = `No working manifest URL found for University of Toronto item '${itemId}'. `;
                            
                            if (networkTimeoutErrors.length === urlErrors.length && urlErrors.length > 0) {
                                // All requests timed out - clear network connectivity issue
                                diagnosticMessage += `All ${urlErrors.length} URL patterns failed due to network timeouts. ` +
                                    `This indicates University of Toronto servers are unreachable from your location. ` +
                                    `This is likely a temporary server outage or network connectivity issue. ` +
                                    `Please try again later or check if your network can access University of Toronto resources. ` +
                                    `Technical details: ${urlErrors.slice(0, 3).map(e => `${e.code || 'TIMEOUT'}: ${e.error.split('\n')[0]}`).join('; ')}`;
                            } else if (connectionRefusedErrors.length > 0 || dnsErrors.length > 0) {
                                // DNS or connection issues
                                diagnosticMessage += `Connection problems detected (${connectionRefusedErrors.length} refused, ${dnsErrors.length} DNS failures). ` +
                                    `University of Toronto servers appear to be unreachable. Check network connectivity to .utoronto.ca domains. ` +
                                    `Technical details: ${urlErrors.slice(0, 3).map(e => `${e.code || 'CONNECTION'}: ${e.error.split('\n')[0]}`).join('; ')}`;
                            } else if (httpErrors.length > 0) {
                                // HTTP errors suggest servers are reachable but manuscript not found
                                diagnosticMessage += `Manuscript not found - tried ${manifestPatterns.length} URL patterns but item does not exist ` +
                                    `or has been moved. Please verify the manuscript ID '${itemId}' is correct.`;
                            } else {
                                // Mixed or unknown errors
                                diagnosticMessage += `Mixed connectivity issues encountered across ${urlErrors.length} URL attempts. ` +
                                    `This may indicate: (1) Temporary network issues, (2) University of Toronto server maintenance, ` +
                                    `(3) Firewall restrictions, or (4) IIIF structure changes. ` +
                                    `Technical details: ${urlErrors.slice(0, 3).map(e => `${e.code || 'HTTP'}: ${e.error.split('\n')[0]}`).join('; ')}`;
                            }
                            
                            throw new Error(diagnosticMessage);
                        }
                    } else {
                        throw new Error('Could not extract item ID from collections URL');
                    }
                }
                
                // Handle direct IIIF URLs
                else if (torontoUrl.includes('iiif.library.utoronto.ca')) {
                    if (!torontoUrl.includes('/manifest')) {
                        manifestUrl = torontoUrl.endsWith('/') ? `${torontoUrl}manifest` : `${torontoUrl}/manifest`;
                    }
                }
                
                // Load IIIF manifest
                const response = await this.deps.fetchDirect(manifestUrl);
                if (!response.ok) {
                    throw new Error(`Failed to load manifest: HTTP ${response.status}`);
                }
                
                const manifest = await response.json();
                
                // Extract metadata from IIIF manifest
                if (manifest.label) {
                    if (typeof manifest.label === 'string') {
                        displayName = manifest.label;
                    } else if (Array.isArray(manifest.label)) {
                        displayName = manifest.label[0]?.['@value'] || manifest.label[0] || displayName;
                    } else if (manifest.label['@value']) {
                        displayName = manifest.label['@value'];
                    }
                }
                
                const pageLinks: string[] = [];
                
                // Handle IIIF v2 structure
                if (manifest.sequences && manifest.sequences?.length > 0) {
                    const sequence = manifest.sequences[0];
                    if (sequence.canvases && Array.isArray(sequence.canvases)) {
                        // Extract image URLs with maximum resolution
                        for (const canvas of sequence.canvases) {
                            if (canvas.images && canvas.images?.length > 0) {
                                const image = canvas.images[0];
                                if (image.resource && image.resource['@id']) {
                                    let maxResUrl = image.resource['@id'];
                                    
                                    if (image.resource.service && image.resource.service['@id']) {
                                        const serviceId = image.resource.service['@id'];
                                        // Test different resolution parameters for maximum quality
                                        maxResUrl = `${serviceId}/full/max/0/default.jpg`;
                                    } else {
                                        // Fallback: construct from resource URL if service not available
                                        const serviceBase = maxResUrl.split('/full/')[0];
                                        maxResUrl = `${serviceBase}/full/max/0/default.jpg`;
                                    }
                                    
                                    pageLinks.push(maxResUrl);
                                }
                            }
                        }
                    }
                }
                
                // Handle IIIF v3 structure
                else if (manifest.items && manifest.items?.length > 0) {
                    for (const item of manifest.items) {
                        if (item.items && item.items?.length > 0) {
                            const annotationPage = item.items[0];
                            if (annotationPage.items && annotationPage.items?.length > 0) {
                                const annotation = annotationPage.items[0];
                                if (annotation.body) {
                                    let maxResUrl = annotation.body.id;
                                    
                                    if (annotation.body.service) {
                                        const service = Array.isArray(annotation.body.service) ? annotation.body.service[0] : annotation.body.service;
                                        if (service && service.id) {
                                            maxResUrl = `${service.id}/full/max/0/default.jpg`;
                                        }
                                    }
                                    
                                    pageLinks.push(maxResUrl);
                                }
                            }
                        }
                    }
                }
                
                if (pageLinks?.length === 0) {
                    throw new Error('No pages found in IIIF manifest');
                }
                
                const torontoManifest = {
                    pageLinks,
                    totalPages: pageLinks?.length,
                    library: 'toronto' as const,
                    displayName,
                    originalUrl: torontoUrl,
                };
                
                // Cache the manifest
                this.deps.manifestCache.set(torontoUrl, torontoManifest).catch(console.warn);
                
                return torontoManifest;
                
            } catch (error: any) {
                // Enhanced error handling with network classification
                const networkError = error as Error;
                
                // Check if this error already contains our enhanced diagnostic message
                // If so, preserve it rather than re-wrapping
                if (networkError.message.includes('University of Toronto servers are unreachable') ||
                    networkError.message.includes('All 8 URL patterns failed') ||
                    networkError.message.includes('Connection problems detected') ||
                    networkError.message.includes('Mixed connectivity issues')) {
                    // This is already an enhanced error from our inner error handling - preserve it
                    throw networkError;
                }
                
                // Check if this is a network connectivity issue
                const errorCode = (networkError as any)?.code;
                const errorMessage = networkError.message.toLowerCase();
                
                let enhancedErrorMessage: string;
                
                // Detect specific network connectivity issues
                if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout')) {
                    enhancedErrorMessage = `Network timeout connecting to University of Toronto servers. ` +
                        `The servers at collections.library.utoronto.ca and iiif.library.utoronto.ca appear to be unreachable. ` +
                        `This is likely a temporary network issue or server maintenance. ` +
                        `Please try again later or check if your network can access University of Toronto resources.`;
                } else if (errorCode === 'ECONNREFUSED' || errorCode === 'ENOTFOUND') {
                    enhancedErrorMessage = `Unable to connect to University of Toronto servers. ` +
                        `DNS resolution or connection failed for University of Toronto manuscript services. ` +
                        `This may indicate: (1) Temporary server outage, (2) Network connectivity issues, ` +
                        `(3) Firewall blocking access to .utoronto.ca domains, or (4) DNS resolution problems. ` +
                        `Please verify your internet connection and try again later.`;
                } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
                    // Extract item ID for better error message
                    const viewMatch = torontoUrl.match(/\/view\/([^/]+)/);
                    const itemId = viewMatch ? viewMatch[1] : 'unknown';
                    enhancedErrorMessage = `University of Toronto manuscript not found. ` +
                        `The item '${itemId}' was not found at any of the 8 URL patterns tested. ` +
                        `This may indicate: (1) The manuscript ID is incorrect, (2) The manuscript has been moved or removed, ` +
                        `(3) University of Toronto changed their IIIF structure, or (4) Access restrictions apply. ` +
                        `Please verify the manuscript ID and URL are correct.`;
                } else {
                    // Generic network error with specific Toronto context
                    enhancedErrorMessage = `Failed to load University of Toronto manuscript due to network connectivity issues. ` +
                        `Attempted to connect to University of Toronto servers but encountered: ${networkError.message}. ` +
                        `This appears to be a network-level problem accessing .utoronto.ca domains. ` +
                        `Please check your internet connection and try again later.`;
                }
                
                throw new Error(enhancedErrorMessage);
            }
        }
}