import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class CologneLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'cologne';
    }
    
    async loadManifest(cologneUrl: string): Promise<ManuscriptManifest> {
            try {
                console.log(`Loading Cologne Dom Library manifest: ${cologneUrl}`);
                
                // Determine collection and ID from URL
                // URL patterns:
                // - https://digital.dombibliothek-koeln.de/hs/content/zoom/156145
                // - https://digital.dombibliothek-koeln.de/schnuetgen/Handschriften/content/pageview/652610
                // - https://digital.dombibliothek-koeln.de/ddbkhd/Handschriften/content/pageview/94078
                
                let collection = 'hs'; // default collection
                let pageId = '';
                let displayName = 'Cologne Dom Library Manuscript';
                
                // Extract collection and page ID
                const hsMatch = cologneUrl.match(/\/hs\/content\/zoom\/(\d+)/);
                const schnuetgenMatch = cologneUrl.match(/\/schnuetgen\/[^/]+\/content\/pageview\/(\d+)/);
                const ddbkhdMatch = cologneUrl.match(/\/ddbkhd\/[^/]+\/content\/pageview\/(\d+)/);
                
                if (hsMatch) {
                    collection = 'hs';
                    pageId = hsMatch[1] || '';
                    displayName = 'Cologne Dom Library Manuscript';
                } else if (schnuetgenMatch) {
                    collection = 'schnuetgen';
                    pageId = schnuetgenMatch[1] || '';
                    displayName = 'Cologne Schnütgen Museum Manuscript';
                } else if (ddbkhdMatch) {
                    collection = 'ddbkhd';
                    pageId = ddbkhdMatch[1] || '';
                    displayName = 'Cologne DDBKHD Manuscript';
                } else {
                    throw new Error('Could not extract collection and page ID from Cologne URL');
                }
                
                console.log(`Detected collection: ${collection}, page ID: ${pageId}`);
                
                // Fetch the viewer page to extract all page IDs
                const headers = {
                    'Cookie': 'js_enabled=1',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Cache-Control': 'no-cache'
                };
                
                const response = await this.deps.fetchDirect(cologneUrl, { headers });
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch Cologne page: ${response.status} ${response.statusText}`);
                }
                
                const html = await response.text();
                console.log(`Cologne page fetched, extracting page list...`);
                
                // Extract page IDs - try different methods based on page structure
                const pageIds: string[] = [];
                
                // Method 1: Try pageList div (for HS collection with zoom viewer)
                const pageListMatch = html.match(/<div id="pageList"[^>]*>.*?<\/div>/s);
                if (pageListMatch) {
                    const pageListHtml = pageListMatch[0];
                    const pageIdRegex = /data-id="(\d+)"/g;
                    let match;
                    while ((match = pageIdRegex.exec(pageListHtml)) !== null) {
                        pageIds.push(match?.[1] || '');
                    }
                    console.log(`Found ${pageIds?.length} pages using pageList method`);
                }
                
                // Method 2: Try select dropdown options (for Schnütgen and DDBKHD collections)
                if (pageIds?.length === 0) {
                    const selectMatch = html.match(/<select[^>]*id="goToPages"[^>]*>.*?<\/select>/s);
                    if (selectMatch) {
                        const selectHtml = selectMatch[0];
                        const optionRegex = /option value="(\d+)"/g;
                        let match;
                        while ((match = optionRegex.exec(selectHtml)) !== null) {
                            pageIds.push(match?.[1] || '');
                        }
                        console.log(`Found ${pageIds?.length} pages using select dropdown method`);
                    }
                }
                
                if (pageIds?.length === 0) {
                    throw new Error('No page IDs found in Cologne page using any method');
                }
                
                console.log(`Found ${pageIds?.length} pages`);
                
                // Extract manuscript title from page metadata if available
                const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
                if (titleMatch) {
                    const title = titleMatch[1]
                        ?.replace(/Handschriften der Diözesan- und Dombibliothek \/ /, '')
                        .replace(/ \[.*$/, '') // Remove trailing bracket content
                        .trim();
                    
                    if (title && title !== 'Handschriften der Diözesan- und Dombibliothek') {
                        displayName = title;
                    }
                }
                
                // Build image URLs for highest resolution (2000px)
                const pageLinks: string[] = [];
                const baseUrl = 'https://digital.dombibliothek-koeln.de';
                
                for (const id of pageIds) {
                    const imageUrl = `${baseUrl}/${collection}/download/webcache/2000/${id}`;
                    pageLinks.push(imageUrl);
                }
                
                // Sanitize display name for filesystem
                const sanitizedName = displayName
                    .replace(/[<>:"/\\|?*]/g, '_')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .replace(/\.$/, ''); // Remove trailing period
                
                console.log(`Cologne Dom Library manifest loaded: ${pageLinks?.length} pages`);
                
                return {
                    pageLinks,
                    totalPages: pageLinks?.length,
                    library: 'cologne',
                    displayName: sanitizedName,
                    originalUrl: cologneUrl,
                };
                
            } catch (error: any) {
                console.error(`Cologne Dom Library manifest loading failed:`, error);
                throw new Error(`Failed to load Cologne Dom Library manuscript: ${(error as Error).message}`);
            }
        }
}