import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

interface GallicaContentInfo {
    arkId: string;
    prefix: string;
    contentType: 'manuscript' | 'book' | 'periodical' | 'image' | 'map' | 'serial';
    preferredFormats: string[];
    requiresIIIF: boolean;
}

export class GallicaLoader extends BaseLibraryLoader {
    // ARK prefix mapping to content types and supported formats
    private readonly ARK_MAPPINGS = new Map<string, Partial<GallicaContentInfo>>([
        // Medieval manuscripts - use .highres
        ['btv1b', { contentType: 'manuscript', preferredFormats: ['.highres', '.item'], requiresIIIF: false }],
        
        // Printed books - require IIIF Image API
        ['bpt6k', { contentType: 'book', preferredFormats: ['iiif', '.item'], requiresIIIF: false }],
        
        // Periodicals - require IIIF Image API  
        ['cb32', { contentType: 'serial', preferredFormats: ['iiif', '.item'], requiresIIIF: false }],
        ['cb', { contentType: 'serial', preferredFormats: ['iiif', '.item'], requiresIIIF: false }],
        
        // Images and prints - mixed approach
        ['btv1c', { contentType: 'image', preferredFormats: ['.item', 'iiif'], requiresIIIF: false }],
        
        // Maps - require IIIF
        ['btv1m', { contentType: 'map', preferredFormats: ['iiif', '.item'], requiresIIIF: false }],
    ]);

    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'gallica';
    }
    
    async loadManifest(gallicaUrl: string): Promise<ManuscriptManifest> {
        try {
            // Clean and extract ARK ID
            const arkId = this.extractAndCleanArkId(gallicaUrl);
            if (!arkId) {
                throw new Error('Invalid Gallica URL format - could not extract ARK ID');
            }

            // Determine content info based on ARK prefix
            const contentInfo = this.analyzeContent(arkId);
            
            this.deps.logger?.log({
                level: 'info',
                library: 'gallica',
                message: `Processing ${contentInfo.contentType}: ${arkId}`,
                details: { contentType: contentInfo.contentType, preferredFormats: contentInfo.preferredFormats }
            });

            // Try different loading strategies based on content type
            const strategies = [
                () => this.tryIIIFManifest(arkId, contentInfo, gallicaUrl),
                () => this.tryDirectImageAccess(arkId, contentInfo, gallicaUrl),
                () => this.tryFallbackFormats(arkId, contentInfo, gallicaUrl)
            ];

            for (const strategy of strategies) {
                try {
                    const result = await strategy();
                    if (result && result.totalPages > 0) {
                        this.deps.logger?.log({
                            level: 'info',
                            library: 'gallica',
                            message: `Success with ${result.totalPages} pages`,
                            details: { totalPages: result.totalPages, strategy: 'successful' }
                        });
                        // Cache the manifest
                        this.deps.manifestCache.set(gallicaUrl, result as any).catch(console.warn);
                        return result;
                    }
                } catch (error) {
                    this.deps.logger?.log({
                        level: 'warn',
                        library: 'gallica',
                        message: `Strategy failed: ${error instanceof Error ? error.message : String(error)}`,
                        details: { error: error instanceof Error ? error.message : String(error) }
                    });
                }
            }

            throw new Error(`All loading strategies failed for ${contentInfo.contentType} content (ARK: ${arkId})`);
            
        } catch (error: any) {
            throw new Error(`Failed to load Gallica document: ${(error as Error).message}`);
        }
    }

    private extractAndCleanArkId(url: string): string | null {
        // Handle various URL formats and clean them
        const patterns = [
            /ark:\/[^/]+\/([^/?\s#]+)/,  // Standard ARK
            /\/ark:\/[^/]+\/([^/?\s#]+)/, // ARK in path
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                // Return full ARK format
                return `ark:/12148/${match[1]}`;
            }
        }

        return null;
    }

    private analyzeContent(arkId: string): GallicaContentInfo {
        const idPart = arkId.split('/').pop() || '';
        
        // Try different prefix lengths (5, 4, 3, 2 chars) to find a match
        for (const prefixLength of [5, 4, 3, 2]) {
            const prefix = idPart.substring(0, prefixLength);
            const mapping = this.ARK_MAPPINGS.get(prefix);
            
            if (mapping) {
                return {
                    arkId,
                    prefix,
                    contentType: mapping.contentType || 'manuscript',
                    preferredFormats: mapping.preferredFormats || ['.highres'],
                    requiresIIIF: mapping.requiresIIIF || false
                };
            }
        }

        // Default fallback for unknown prefixes
        const prefix = idPart.substring(0, 5);
        return {
            arkId,
            prefix,
            contentType: 'manuscript',
            preferredFormats: ['.highres', '.item', 'iiif'],
            requiresIIIF: false
        };
    }

    private async tryIIIFManifest(arkId: string, contentInfo: GallicaContentInfo, originalUrl: string): Promise<ManuscriptManifest | null> {
        const manifestUrls = [
            `https://gallica.bnf.fr/iiif/${arkId}/manifest.json`,
            `https://gallica.bnf.fr/iiif/${arkId.replace('ark:/', '')}/manifest.json`,
        ];

        for (const manifestUrl of manifestUrls) {
            try {
                const response = await this.deps.fetchDirect(manifestUrl);
                if (!response.ok) continue;

                const manifest = await response.json();
                const pageLinks = await this.extractImageLinksFromManifest(manifest, arkId, contentInfo);
                
                if (pageLinks && pageLinks.length > 0) {
                    let displayName = `Gallica ${contentInfo.contentType} ${arkId}`;
                    
                    // Extract title from manifest
                    if (manifest.label) {
                        displayName = typeof manifest.label === 'string' ? manifest.label : 
                                     manifest.label.en?.[0] || manifest.label.fr?.[0] || displayName;
                    }

                    return {
                        pageLinks,
                        totalPages: pageLinks.length,
                        library: 'gallica' as const,
                        displayName,
                        originalUrl,
                    };
                }
            } catch (error) {
                this.deps.logger?.log({
                    level: 'warn',
                    library: 'gallica',
                    message: `IIIF manifest failed for ${manifestUrl}`,
                    details: { manifestUrl, error: String(error) }
                });
            }
        }

        return null;
    }

    private async extractImageLinksFromManifest(manifest: any, arkId: string, contentInfo: GallicaContentInfo): Promise<string[]> {
        const pageLinks: string[] = [];

        try {
            // IIIF Presentation API v2 and v3 support
            const sequences = manifest.sequences || [manifest];
            
            for (const sequence of sequences) {
                const canvases = sequence.canvases || sequence.items || [];
                
                for (let i = 0; i < canvases.length; i++) {
                    const canvas = canvases[i];
                    let imageUrl: string | null = null;

                    // Try to extract IIIF Image API URL
                    imageUrl = this.extractImageServiceUrl(canvas);
                    
                    if (imageUrl) {
                        // For different content types, use different IIIF parameters
                        const iiifParams = this.getIIIFParameters(contentInfo.contentType);
                        pageLinks.push(`${imageUrl}${iiifParams}`);
                    } else {
                        // Fallback to direct access based on content type
                        const format = contentInfo.preferredFormats.find(f => f.startsWith('.')) || '.highres';
                        const directUrl = `https://gallica.bnf.fr/${arkId}/f${i + 1}${format}`;
                        pageLinks.push(directUrl);
                    }
                }
            }
        } catch (error) {
            this.deps.logger?.log({
                level: 'warn',
                library: 'gallica',
                message: `Manifest parsing error`,
                details: { error: String(error) }
            });
        }

        return pageLinks;
    }

    private extractImageServiceUrl(canvas: any): string | null {
        // IIIF v2
        if (canvas.images) {
            for (const image of canvas.images) {
                if (image.resource && image.resource.service) {
                    return image.resource.service['@id'] || image.resource.service.id;
                }
            }
        }

        // IIIF v3
        if (canvas.items) {
            for (const item of canvas.items) {
                if (item.items) {
                    for (const painting of item.items) {
                        if (painting.body && painting.body.service) {
                            const services = Array.isArray(painting.body.service) ? painting.body.service : [painting.body.service];
                            for (const service of services) {
                                return service['@id'] || service.id;
                            }
                        }
                    }
                }
            }
        }

        return null;
    }

    private getIIIFParameters(contentType: string): string {
        switch (contentType) {
            case 'manuscript':
                return '/full/max/0/default.jpg'; // Highest quality for manuscripts
            case 'book':
            case 'periodical':
                return '/full/2000,/0/default.jpg'; // High quality but manageable size
            case 'map':
                return '/full/full/0/default.jpg'; // Full resolution for maps
            case 'image':
                return '/full/1500,/0/default.jpg'; // Medium-high quality for images
            case 'serial':
                return '/full/1200,/0/default.jpg'; // Medium quality for serials
            default:
                return '/full/max/0/default.jpg';
        }
    }

    private async tryDirectImageAccess(arkId: string, contentInfo: GallicaContentInfo, originalUrl: string): Promise<ManuscriptManifest | null> {
        const formats = contentInfo.preferredFormats.filter(f => f.startsWith('.'));
        
        for (const format of formats) {
            try {
                const totalPages = await this.discoverPageCount(arkId, format);
                if (totalPages > 0) {
                    const pageLinks = [];
                    for (let i = 1; i <= totalPages; i++) {
                        pageLinks.push(`https://gallica.bnf.fr/${arkId}/f${i}${format}`);
                    }

                    return {
                        pageLinks,
                        totalPages,
                        library: 'gallica' as const,
                        displayName: `Gallica ${contentInfo.contentType} ${arkId}`,
                        originalUrl,
                    };
                }
            } catch (error) {
                this.deps.logger?.log({
                    level: 'warn',
                    library: 'gallica',
                    message: `Direct access with ${format} failed`,
                    details: { format, error: String(error) }
                });
            }
        }

        return null;
    }

    private async tryFallbackFormats(arkId: string, contentInfo: GallicaContentInfo, originalUrl: string): Promise<ManuscriptManifest | null> {
        // Last resort: try all possible formats for any content type
        const fallbackFormats = ['.item', '.highres', '.zoom', '.medres', '.lowres'];
        
        for (const format of fallbackFormats) {
            try {
                const pageCount = await this.discoverPageCount(arkId, format);
                if (pageCount > 0) {
                    const pageLinks = [];
                    for (let i = 1; i <= pageCount; i++) {
                        pageLinks.push(`https://gallica.bnf.fr/${arkId}/f${i}${format}`);
                    }

                    this.deps.logger?.log({
                        level: 'info',
                        library: 'gallica',
                        message: `Fallback success with ${format} format`,
                        details: { format, pageCount }
                    });
                    
                    return {
                        pageLinks,
                        totalPages: pageCount,
                        library: 'gallica' as const,
                        displayName: `Gallica ${contentInfo.contentType} ${arkId}`,
                        originalUrl,
                    };
                }
            } catch (error) {
                this.deps.logger?.log({
                    level: 'warn',
                    library: 'gallica',
                    message: `Fallback format ${format} failed`,
                    details: { format, error: String(error) }
                });
            }
        }

        return null;
    }

    private async discoverPageCount(arkId: string, format: string): Promise<number> {
        // Binary search to find total pages efficiently
        let low = 1;
        let high = 1000; // reasonable upper bound
        let lastValidPage = 0;
        
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const testUrl = `https://gallica.bnf.fr/${arkId}/f${mid}${format}`;
            
            try {
                const response = await this.deps.fetchDirect(testUrl, { method: 'HEAD' });
                if (response.ok) {
                    lastValidPage = mid;
                    low = mid + 1;
                } else if (response.status === 404) {
                    high = mid - 1;
                } else if (response.status === 400) {
                    // 400 might indicate format not supported for this content
                    throw new Error(`Format ${format} not supported (HTTP 400)`);
                } else {
                    high = mid - 1;
                }
            } catch (error) {
                if (error instanceof Error && error.message.includes('not supported')) {
                    throw error; // Propagate format not supported errors
                }
                high = mid - 1;
            }
        }
        
        return lastValidPage;
    }
}