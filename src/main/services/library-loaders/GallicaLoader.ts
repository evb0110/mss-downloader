import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class GallicaLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'gallica';
    }
    
    async loadManifest(gallicaUrl: string): Promise<ManuscriptManifest> {
        try {
            const arkMatch = gallicaUrl.match(/ark:\/[^/]+\/[^/?\s]+/);
            if (!arkMatch) {
                throw new Error('Invalid Gallica URL format');
            }
            
            const ark = arkMatch[0];
            
            // Try IIIF manifest first to get page count and metadata (modern approach)
            const manifestUrl = `https://gallica.bnf.fr/iiif/${ark}/manifest.json`;
            
            try {
                const manifestResponse = await this.deps.fetchDirect(manifestUrl);
                if (manifestResponse.ok) {
                    const manifest = await manifestResponse.json();
                    
                    // Extract page count and metadata from IIIF manifest
                    let displayName = `Gallica Document ${ark}`;
                    let totalPages = 0;
                    
                    if (manifest.label) {
                        displayName = typeof manifest.label === 'string' ? manifest.label : 
                                     manifest.label.en?.[0] || manifest.label.fr?.[0] || displayName;
                    }
                    
                    // IIIF Presentation API v2 or v3
                    const sequences = manifest.sequences || [manifest];
                    
                    for (const sequence of sequences) {
                        const canvases = sequence.canvases || sequence.items || [];
                        totalPages += canvases.length;
                    }
                    
                    if (totalPages > 0) {
                        // Use the working .highres format instead of broken IIIF URLs
                        const pageLinks: string[] = [];
                        for (let i = 1; i <= totalPages; i++) {
                            const imageUrl = `https://gallica.bnf.fr/${ark}/f${i}.highres`;
                            pageLinks.push(imageUrl);
                        }
                        
                        const gallicaManifest = {
                            pageLinks,
                            totalPages: pageLinks.length,
                            library: 'gallica' as const,
                            displayName,
                            originalUrl: gallicaUrl,
                        };
                        
                        // Cache the manifest
                        this.deps.manifestCache.set(gallicaUrl, gallicaManifest).catch(console.warn);
                        
                        return gallicaManifest;
                    }
                }
            } catch {
                // IIIF manifest failed, try fallback
            }
            
            // Fallback: Direct .highres testing approach (using working URL format)
            
            // Test if we can access .highres images directly and find the page count
            let totalPages = 0;
            
            // Binary search to find total pages efficiently
            let low = 1;
            let high = 1000; // reasonable upper bound
            let lastValidPage = 0;
            
            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                const testUrl = `https://gallica.bnf.fr/${ark}/f${mid}.highres`;
                
                try {
                    const response = await this.deps.fetchDirect(testUrl);
                    if (response.ok) {
                        lastValidPage = mid;
                        low = mid + 1;
                    } else {
                        high = mid - 1;
                    }
                } catch {
                    high = mid - 1;
                }
            }
            
            totalPages = lastValidPage;
            
            if (totalPages === 0) {
                // Try a few common page counts
                const commonCounts = [1, 2, 5, 10, 20, 50, 100];
                for (const count of commonCounts) {
                    const testUrl = `https://gallica.bnf.fr/${ark}/f${count}.highres`;
                    try {
                        const response = await this.deps.fetchDirect(testUrl);
                        if (response.ok) {
                            totalPages = count;
                        } else {
                            break;
                        }
                    } catch {
                        break;
                    }
                }
            }
            
            if (totalPages === 0) {
                throw new Error('Could not determine page count for Gallica document');
            }
            
            // Generate .highres image URLs
            const pageLinks = [];
            for (let i = 1; i <= totalPages; i++) {
                const imageUrl = `https://gallica.bnf.fr/${ark}/f${i}.highres`;
                pageLinks.push(imageUrl);
            }
            
            
            const gallicaManifest = {
                pageLinks,
                totalPages,
                library: 'gallica' as const,
                displayName: `Gallica Document ${ark}`,
                originalUrl: gallicaUrl,
            };
            
            // Cache the manifest
            this.deps.manifestCache.set(gallicaUrl, gallicaManifest).catch(console.warn);
            
            return gallicaManifest;
            
        } catch (error: unknown) {
            throw new Error(`Failed to load Gallica document: ${(error as Error).message}`);
        }
    }
}