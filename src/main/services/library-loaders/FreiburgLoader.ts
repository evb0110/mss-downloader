import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class FreiburgLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'freiburg';
    }
    
    async loadManifest(originalUrl: string): Promise<ManuscriptManifest> {
            try {
                console.log(`Loading Freiburg manuscript from: ${originalUrl}`);
                
                // Extract manuscript ID from URL - matches patterns like:
                // https://dl.ub.uni-freiburg.de/diglit/codal_25
                // https://dl.ub.uni-freiburg.de/diglit/codal_25/0001
                const manuscriptMatch = originalUrl.match(/\/diglit\/([^/?]+)/);
                if (!manuscriptMatch) {
                    throw new Error('Invalid Freiburg URL format - cannot extract manuscript ID');
                }
                
                const manuscriptId = manuscriptMatch[1];
                console.log(`Extracted manuscript ID: ${manuscriptId}`);
                
                // Get manuscript metadata from the main page
                const metadataUrl = `https://dl.ub.uni-freiburg.de/diglit/${manuscriptId}`;
                console.log(`Fetching metadata from: ${metadataUrl}`);
                
                const metadataResponse = await this.deps.fetchDirect(metadataUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
                        'Cache-Control': 'no-cache'
                    }
                });
                
                if (!metadataResponse.ok) {
                    throw new Error(`HTTP ${metadataResponse.status}: ${metadataResponse.statusText}`);
                }
                
                const metadataHtml = await metadataResponse.text();
                
                // Extract display name from metadata page
                let displayName = `Freiburg Manuscript ${manuscriptId}`;
                const dom = new JSDOM(metadataHtml);
                const document = dom.window.document;
                
                // Try multiple selectors for title extraction
                const titleSelectors = [
                    'h1.page-header',
                    '.metadata-title',
                    'h1',
                    'title'
                ];
                
                for (const selector of titleSelectors) {
                    const titleElement = document.querySelector(selector);
                    if (titleElement && titleElement.textContent?.trim()) {
                        displayName = titleElement.textContent.trim();
                        break;
                    }
                }
                
                console.log(`Extracted display name: ${displayName}`);
                
                // Use thumbs page for complete page discovery (METS XML returns 302 redirects)
                const thumbsUrl = `https://dl.ub.uni-freiburg.de/diglit/${manuscriptId}/0001/thumbs`;
                console.log(`Fetching thumbs page: ${thumbsUrl}`);
                
                const thumbsResponse = await this.deps.fetchDirect(thumbsUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
                        'Cache-Control': 'no-cache'
                    }
                });
                
                if (!thumbsResponse.ok) {
                    throw new Error(`Failed to fetch thumbs page: HTTP ${thumbsResponse.status}`);
                }
                
                const thumbsHtml = await thumbsResponse.text();
                console.log(`Thumbs HTML length: ${thumbsHtml.length} characters`);
                
                // Extract all unique page numbers from thumbs page
                const thumbsDom = new JSDOM(thumbsHtml);
                const allLinks = thumbsDom.window.document.querySelectorAll('a[href*="/diglit/"]');
                
                const uniquePages = new Set<string>();
                allLinks.forEach(link => {
                    const href = link.getAttribute('href');
                    if (href) {
                        const pageMatch = href.match(/\/diglit\/[^/]+\/(\d{4})/);
                        if (pageMatch) {
                            uniquePages.add(pageMatch[1]);
                        }
                    }
                });
                
                const sortedPages = Array.from(uniquePages).sort((a, b) => parseInt(a) - parseInt(b));
                console.log(`Found ${sortedPages.length} unique pages`);
                
                if (sortedPages.length === 0) {
                    throw new Error('No pages found in thumbs page');
                }
                
                // Extract image URLs from pages in batches
                const pageLinks: string[] = [];
                const batchSize = 10;
                
                for (let i = 0; i < sortedPages.length; i += batchSize) {
                    const batch = sortedPages.slice(i, i + batchSize);
                    const batchPromises = batch.map(async (pageNumber) => {
                        const pageUrl = `https://dl.ub.uni-freiburg.de/diglit/${manuscriptId}/${pageNumber}`;
                        
                        try {
                            const pageResponse = await this.deps.fetchDirect(pageUrl, {
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                                    'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
                                    'Cache-Control': 'no-cache'
                                }
                            });
                            
                            if (pageResponse.ok) {
                                const pageHtml = await pageResponse.text();
                                const pageDom = new JSDOM(pageHtml);
                                
                                const imageElements = pageDom.window.document.querySelectorAll('img[src*="diglitData"]');
                                
                                if (imageElements.length > 0) {
                                    const imageUrl = imageElements[0].getAttribute('src');
                                    if (imageUrl) {
                                        const fullImageUrl = imageUrl.startsWith('http') ? imageUrl : `https://dl.ub.uni-freiburg.de${imageUrl}`;
                                        // Upgrade to maximum resolution level 4 for highest quality
                                        const maxResolutionUrl = fullImageUrl.replace(/\/\d+\//, '/4/');
                                        return maxResolutionUrl;
                                    }
                                }
                            }
                            
                            return null;
                        } catch (error) {
                            console.warn(`Failed to fetch page ${pageNumber}: ${(error as Error).message}`);
                            return null;
                        }
                    });
                    
                    const batchResults = await Promise.all(batchPromises);
                    pageLinks.push(...batchResults.filter((url): url is string => url !== null));
                    
                    // Progress logging
                    if (i % 50 === 0) {
                        console.log(`Processed ${Math.min(i + batchSize, sortedPages.length)} of ${sortedPages.length} pages`);
                    }
                }
                
                if (pageLinks.length === 0) {
                    throw new Error('No valid page images found');
                }
                
                console.log(`Successfully extracted ${pageLinks.length} page links`);
                
                // Create manifest structure
                const manifest: ManuscriptManifest = {
                    pageLinks: pageLinks,
                    totalPages: pageLinks.length,
                    library: 'freiburg' as any,
                    displayName: displayName,
                    originalUrl: originalUrl
                };
                
                console.log(`Freiburg manifest created successfully with ${pageLinks.length} pages`);
                return manifest;
                
            } catch (error: any) {
                console.error('Freiburg manifest loading error:', error);
                throw new Error(`Failed to load Freiburg manuscript: ${(error as Error).message}`);
            }
        }
}