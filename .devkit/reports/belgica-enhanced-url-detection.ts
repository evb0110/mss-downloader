/**
 * Enhanced Belgica KBR URL Detection and Routing
 * 
 * This module bridges the gap between original document URLs and the tile engine system
 * by implementing intelligent URL detection and routing logic.
 */

import { TileEngineService } from '../src/main/services/tile-engine/TileEngineService';

export class BelgicaKbrUrlRouter {
    private tileEngine: TileEngineService;

    constructor(tileEngine: TileEngineService) {
        this.tileEngine = tileEngine;
    }

    /**
     * Detect the type of Belgica KBR URL and route accordingly
     */
    detectBelgicaKbrUrlType(url: string): {
        type: 'document' | 'zoomtiles' | 'unknown';
        pattern: string;
        shouldUseTileEngine: boolean;
    } {
        try {
            const urlObj = new URL(url);
            
            // Document URLs: https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415
            if (urlObj.hostname === 'belgica.kbr.be' && 
                urlObj.pathname.includes('/doc/') && 
                urlObj.pathname.includes('SYRACUSE')) {
                return {
                    type: 'document',
                    pattern: 'belgica.kbr.be/BELGICA/doc/SYRACUSE/',
                    shouldUseTileEngine: true // Try tile engine first, fallback to thumbnail handler
                };
            }
            
            // Direct zoomtiles URLs: https://viewerd.kbr.be/display/.../zoomtiles/...
            if (urlObj.hostname === 'viewerd.kbr.be' && 
                urlObj.pathname.includes('/display/') && 
                urlObj.pathname.includes('zoomtiles')) {
                return {
                    type: 'zoomtiles',
                    pattern: 'viewerd.kbr.be/display/.../zoomtiles/',
                    shouldUseTileEngine: true // Direct tile engine usage
                };
            }
            
            return {
                type: 'unknown',
                pattern: 'unrecognized',
                shouldUseTileEngine: false
            };
        } catch (error) {
            return {
                type: 'unknown',
                pattern: 'invalid-url',
                shouldUseTileEngine: false
            };
        }
    }

    /**
     * Convert document URL to tile engine URL via manuscript chain extraction
     */
    async convertDocumentToTileUrl(documentUrl: string): Promise<{
        success: boolean;
        tileUrl?: string;
        manuscriptChain?: {
            documentId: string;
            uurlInfo: { url: string; id: string };
            galleryInfo: { url: string; mapPath: string };
            ajaxZoomConfig: { parameters: string; path: string };
        };
        error?: string;
    }> {
        try {
            // Use the BelgicaKbrAdapter's manuscript chain extraction
            const adapter = this.tileEngine.getAdapterInfo('belgica-kbr-ajaxzoom');
            
            if (!adapter) {
                throw new Error('BelgicaKbrAdapter not found in tile engine');
            }

            // Extract manuscript chain (this uses the Agent 3 implementation)
            const manuscriptChain = await (adapter as any).extractManuscriptChain(documentUrl);
            
            // Generate tile URL pattern
            const tileUrl = `https://viewerd.kbr.be/display/SYRACUSE/zoomtiles/${manuscriptChain.documentId}_0001/`;
            
            return {
                success: true,
                tileUrl,
                manuscriptChain
            };
        } catch (error) {
            return {
                success: false,
                error: (error as Error).message
            };
        }
    }

    /**
     * Enhanced routing logic that attempts tile engine first, then falls back
     */
    async routeOptimalDownload(url: string): Promise<{
        strategy: 'tile-engine' | 'thumbnail-handler' | 'error';
        finalUrl: string;
        qualityLevel: 'high-resolution' | 'standard' | 'unknown';
        estimatedResolution: string;
        reasoning: string;
    }> {
        const urlType = this.detectBelgicaKbrUrlType(url);
        
        if (urlType.type === 'unknown') {
            return {
                strategy: 'error',
                finalUrl: url,
                qualityLevel: 'unknown',
                estimatedResolution: 'N/A',
                reasoning: 'URL not recognized as Belgica KBR format'
            };
        }

        // For document URLs, try to convert to tile URL first
        if (urlType.type === 'document') {
            const conversionResult = await this.convertDocumentToTileUrl(url);
            
            if (conversionResult.success && conversionResult.tileUrl) {
                // Test if tile engine can handle this URL
                const canUseTileEngine = await this.tileEngine.isTileBasedUrl(conversionResult.tileUrl);
                
                if (canUseTileEngine) {
                    return {
                        strategy: 'tile-engine',
                        finalUrl: conversionResult.tileUrl,
                        qualityLevel: 'high-resolution',
                        estimatedResolution: '6144x7680 pixels (47 megapixels)',
                        reasoning: 'Tile engine available for maximum resolution'
                    };
                } else {
                    return {
                        strategy: 'thumbnail-handler',
                        finalUrl: url,
                        qualityLevel: 'standard',
                        estimatedResolution: '215x256 pixels (standard quality)',
                        reasoning: 'Tile engine not accessible, using thumbnail handler fallback'
                    };
                }
            } else {
                return {
                    strategy: 'thumbnail-handler',
                    finalUrl: url,
                    qualityLevel: 'standard',
                    estimatedResolution: '215x256 pixels (standard quality)',
                    reasoning: `Manuscript chain extraction failed: ${conversionResult.error}`
                };
            }
        }

        // For direct zoomtiles URLs, use tile engine directly
        if (urlType.type === 'zoomtiles') {
            const canUseTileEngine = await this.tileEngine.isTileBasedUrl(url);
            
            if (canUseTileEngine) {
                return {
                    strategy: 'tile-engine',
                    finalUrl: url,
                    qualityLevel: 'high-resolution',
                    estimatedResolution: '6144x7680 pixels (47 megapixels)',
                    reasoning: 'Direct tile engine usage for maximum resolution'
                };
            } else {
                return {
                    strategy: 'error',
                    finalUrl: url,
                    qualityLevel: 'unknown',
                    estimatedResolution: 'N/A',
                    reasoning: 'Tile engine cannot process this zoomtiles URL'
                };
            }
        }

        return {
            strategy: 'error',
            finalUrl: url,
            qualityLevel: 'unknown',
            estimatedResolution: 'N/A',
            reasoning: 'Unhandled URL type'
        };
    }

    /**
     * Provide user with quality options
     */
    async getQualityOptions(url: string): Promise<{
        available: Array<{
            strategy: 'tile-engine' | 'thumbnail-handler';
            quality: 'high-resolution' | 'standard';
            resolution: string;
            downloadTime: string;
            fileSize: string;
            description: string;
        }>;
        recommended: string;
    }> {
        const routing = await this.routeOptimalDownload(url);
        const options = [];

        // Always include thumbnail handler as an option for document URLs
        if (this.detectBelgicaKbrUrlType(url).type === 'document') {
            options.push({
                strategy: 'thumbnail-handler' as const,
                quality: 'standard' as const,
                resolution: '215x256 pixels',
                downloadTime: '< 1 minute',
                fileSize: '~8KB per page',
                description: 'Fast download of cover/binding images using thumbnail API'
            });
        }

        // Include tile engine if available
        if (routing.strategy === 'tile-engine') {
            options.push({
                strategy: 'tile-engine' as const,
                quality: 'high-resolution' as const,
                resolution: '6144x7680 pixels (47 megapixels)',
                downloadTime: '2-3 minutes per page',
                fileSize: '~50MB per page',
                description: 'Maximum resolution using tile engine system (requires browser automation)'
            });
        }

        const recommended = routing.strategy === 'tile-engine' ? 'high-resolution' : 'standard';

        return {
            available: options,
            recommended
        };
    }
}

/**
 * Enhanced library detection that supports both URL types
 */
export function detectBelgicaKbrLibrary(url: string): 'belgica_kbr' | 'belgica_kbr_tiles' | null {
    try {
        const urlObj = new URL(url);
        
        // Document URLs
        if (urlObj.hostname === 'belgica.kbr.be' && 
            urlObj.pathname.includes('/doc/') && 
            urlObj.pathname.includes('SYRACUSE')) {
            return 'belgica_kbr';
        }
        
        // Direct tile URLs
        if (urlObj.hostname === 'viewerd.kbr.be' && 
            urlObj.pathname.includes('/display/') && 
            urlObj.pathname.includes('zoomtiles')) {
            return 'belgica_kbr_tiles';
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Integration patch for EnhancedManuscriptDownloaderService
 */
export class BelgicaKbrIntegrationPatch {
    static async enhanceLibraryDetection(originalUrl: string): Promise<{
        detectedLibrary: string;
        routingStrategy: any;
        qualityOptions: any;
    }> {
        const detectedLibrary = detectBelgicaKbrLibrary(originalUrl);
        
        if (detectedLibrary) {
            const tileEngine = new TileEngineService();
            const router = new BelgicaKbrUrlRouter(tileEngine);
            
            const routingStrategy = await router.routeOptimalDownload(originalUrl);
            const qualityOptions = await router.getQualityOptions(originalUrl);
            
            return {
                detectedLibrary,
                routingStrategy,
                qualityOptions
            };
        }
        
        return {
            detectedLibrary: 'unknown',
            routingStrategy: null,
            qualityOptions: null
        };
    }
}