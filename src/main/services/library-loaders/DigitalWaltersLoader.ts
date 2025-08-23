import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class DigitalWaltersLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'digital_walters';
    }
    
    async loadManifest(url: string): Promise<ManuscriptManifest> {
        try {
            // Extract manuscript ID from URL - handle both formats
            // Pattern 1: https://www.thedigitalwalters.org/Data/WaltersManuscripts/html/WXX/
            // Pattern 2: https://manuscripts.thewalters.org/viewer.php?id=W.530#page/1/mode/1up
            let manuscriptId: string;
            
            if (url.includes('thedigitalwalters.org')) {
                const idMatch = url.match(/\/html\/([Ww]\d+)\/?$/);
                if (!idMatch || !idMatch[1]) {
                    throw new Error('Invalid Digital Walters URL format - could not extract manuscript ID');
                }
                manuscriptId = idMatch[1].toUpperCase();
            } else if (url.includes('manuscripts.thewalters.org')) {
                const idMatch = url.match(/[?&]id=([Ww]\.?\d+)/);
                if (!idMatch || !idMatch[1]) {
                    throw new Error('Invalid Walters manuscripts URL format - could not extract manuscript ID');
                }
                // Convert W.530 to W530 format
                manuscriptId = idMatch[1].toUpperCase().replace('.', '');
            } else {
                throw new Error('Unsupported Digital Walters URL format');
            }
            
            // Fetch the main page to extract title
            const pageResponse = await this.deps.fetchDirect(url);
            if (!pageResponse.ok) {
                throw new Error(`Failed to fetch Digital Walters page: HTTP ${pageResponse.status}`);
            }
            
            const pageContent = await pageResponse.text();
            
            // Extract title from page
            let title = `Digital Walters ${manuscriptId}`;
            const titleMatch = pageContent.match(/<title[^>]*>([^<]*)<\/title>/i);
            if (titleMatch && titleMatch[1]) {
                title = titleMatch[1].trim().replace(/\s+/g, ' ') || title;
            }
            
            // Discover actual page count by testing image URLs until 404
            const pageCount = await this.discoverPageCount(manuscriptId);
            
            if (pageCount === 0) {
                throw new Error('No pages found in Digital Walters manuscript');
            }
            
            // Generate page URLs
            const pageLinks: string[] = [];
            for (let i = 1; i <= pageCount; i++) {
                const paddedNumber = i.toString().padStart(6, '0');
                const imageUrl = `https://www.thedigitalwalters.org/Data/WaltersManuscripts/${manuscriptId}/data/${manuscriptId.replace(/^W/, 'W.')}/sap/${manuscriptId}_${paddedNumber}_sap.jpg`;
                pageLinks.push(imageUrl);
            }
            
            // Sanitize title for filesystem
            const sanitizedTitle = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\.+$/, '').substring(0, 150);
            
            return {
                displayName: sanitizedTitle,
                totalPages: pageCount,
                pageLinks,
                library: 'digital_walters' as const,
                originalUrl: url
            };
            
        } catch (error: any) {
            console.error(`Digital Walters manifest loading failed:`, error);
            throw new Error(`Failed to load Digital Walters manuscript: ${(error as Error).message}`);
        }
    }
    
    /**
     * Discover the actual page count by testing image URLs until we get a 404
     */
    private async discoverPageCount(manuscriptId: string): Promise<number> {
        let pageCount = 0;
        let consecutiveFailures = 0;
        const maxConsecutiveFailures = 10; // Stop after 10 consecutive 404s
        
        // Start with a reasonable upper bound and work backwards if needed
        let testPage = 1;
        let stepSize = 100; // Start with large steps to find approximate range
        let lastValidPage = 0;
        
        try {
            // First, find approximate upper bound
            while (stepSize >= 1) {
                const paddedNumber = testPage.toString().padStart(6, '0');
                const imageUrl = `https://www.thedigitalwalters.org/Data/WaltersManuscripts/${manuscriptId}/data/${manuscriptId.replace(/^W/, 'W.')}/sap/${manuscriptId}_${paddedNumber}_sap.jpg`;
                
                try {
                    const response = await this.deps.fetchDirect(imageUrl, { method: 'HEAD' });
                    if (response.ok) {
                        lastValidPage = testPage;
                        if (stepSize === 1) {
                            // Found exact page, continue to next
                            testPage++;
                            consecutiveFailures = 0;
                        } else {
                            // Continue with larger steps
                            testPage += stepSize;
                        }
                    } else {
                        // 404 - step back and reduce step size
                        if (stepSize === 1) {
                            consecutiveFailures++;
                            if (consecutiveFailures >= maxConsecutiveFailures) {
                                break;
                            }
                            testPage++;
                        } else {
                            testPage -= stepSize;
                            stepSize = Math.floor(stepSize / 2);
                            testPage += stepSize;
                        }
                    }
                    
                    // Small delay to be respectful to the server
                    await this.deps.sleep(50);
                    
                } catch (error) {
                    // Network error or other issue - treat as 404
                    if (stepSize === 1) {
                        consecutiveFailures++;
                        if (consecutiveFailures >= maxConsecutiveFailures) {
                            break;
                        }
                        testPage++;
                    } else {
                        testPage -= stepSize;
                        stepSize = Math.floor(stepSize / 2);
                        testPage += stepSize;
                    }
                }
                
                // Safety limit to prevent infinite loops
                if (testPage > 10000) {
                    console.warn(`Digital Walters: Page discovery exceeded safety limit for ${manuscriptId}`);
                    break;
                }
            }
            
            pageCount = lastValidPage;
            
            console.log(`Digital Walters: Discovered ${pageCount} pages for manuscript ${manuscriptId}`);
            
        } catch (error) {
            console.error(`Digital Walters: Error during page discovery for ${manuscriptId}:`, error);
            throw new Error(`Failed to discover page count: ${(error as Error).message}`);
        }
        
        return pageCount;
    }
}