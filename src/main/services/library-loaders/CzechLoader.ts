import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class CzechLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'czech';
    }
    
    async loadManifest(czechUrl: string): Promise<ManuscriptManifest> {
            console.log('Loading Czech Digital Library manifest for:', czechUrl);
            
            try {
                // Parse the URL to extract manuscript ID and base path
                // URL format: https://dig.vkol.cz/dig/mii87/0001rx.htm
                const urlMatch = czechUrl.match(/dig\.vkol\.cz\/dig\/([^/]+)\/(\d{4})[rv]x\.htm/);
                if (!urlMatch) {
                    throw new Error('Could not parse Czech Digital Library URL format');
                }
    
                const [, manuscriptId] = urlMatch;
                
                console.log(`Czech library: manuscript ID ${manuscriptId}`);
    
                // Fetch the main page to get manuscript metadata
                const response = await this.deps.fetchWithProxyFallback(czechUrl);
                if (!response.ok) {
                    throw new Error(`Failed to load Czech library page: HTTP ${response.status}`);
                }
    
                const htmlContent = await response.text();
                
                // Extract title/name from HTML - look for the manuscript title
                let title = `Czech Manuscript ${manuscriptId}`;
                const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
                if (titleMatch) {
                    title = titleMatch[1]?.trim().replace(/\s+/g, ' ') ?? "";
                }
    
                // Try to extract total page count from HTML content
                // Look for patterns like "185 ff." (folios) or similar folio count indicators
                let maxFolio = 185; // Default based on the example analysis
                
                const folioMatch = htmlContent.match(/(\d+)\s*ff?\.|Obsah.*?(\d+)\s*ff?\./i);
                if (folioMatch) {
                    const detectedFolios = parseInt((folioMatch[1] || folioMatch[2]) || '0');
                    if (detectedFolios > 0 && detectedFolios < 1000) { // Sanity check
                        maxFolio = detectedFolios;
                        console.log(`Czech library: detected ${maxFolio} folios from HTML content`);
                    }
                }
    
                const pageLinks: string[] = [];
    
                // Generate page URLs for recto and verso pages
                // Pattern: 0001r, 0001v, 0002r, 0002v, etc.
                for (let folioNum = 1; folioNum <= maxFolio; folioNum++) {
                    const paddedNum = folioNum.toString().padStart(4, '0');
                    
                    // Add recto page (r)
                    const rectoImageUrl = `https://dig.vkol.cz/dig/${manuscriptId}/inet/${paddedNum}r.jpg`;
                    pageLinks.push(rectoImageUrl);
                    
                    // Add verso page (v)
                    const versoImageUrl = `https://dig.vkol.cz/dig/${manuscriptId}/inet/${paddedNum}v.jpg`;
                    pageLinks.push(versoImageUrl);
                }
    
                console.log(`Czech Digital Library: Generated ${pageLinks?.length} page URLs for "${title}"`);
                
                return {
                    pageLinks,
                    totalPages: pageLinks?.length,
                    library: 'czech',
                    displayName: title,
                    originalUrl: czechUrl
                };
                
            } catch (error: any) {
                console.error('Error loading Czech Digital Library manifest:', error);
                throw new Error(`Failed to load Czech Digital Library manuscript: ${(error as Error).message}`);
            }
        }
}