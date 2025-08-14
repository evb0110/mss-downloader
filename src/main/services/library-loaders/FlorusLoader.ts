import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class FlorusLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'florus';
    }
    
    async loadManifest(florusUrl: string): Promise<ManuscriptManifest> {
            console.log('Loading Florus manifest for:', florusUrl);
            try {
                const response = await this.deps.fetchDirect(florusUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch Florus page: HTTP ${response.status}`);
                }
                
                const html = await response.text();
                console.log('Florus page fetched, length:', html?.length);
                
                // Extract manuscript code and current page from URL
                const urlParams = new URLSearchParams(florusUrl.split('?')[1]);
                const cote = urlParams.get('cote') || '';
                const currentVue = parseInt(urlParams.get('vue') || '1');
                
                if (!cote) {
                    throw new Error('Invalid Florus URL: missing cote parameter');
                }
                
                // Parse the HTML to find the navigation structure and determine total pages
                console.log('Extracting Florus image URLs...');
                const pageLinks = await this.extractFlorusImageUrls(html, cote, currentVue);
                
                console.log(`Found ${pageLinks?.length} pages for Florus manuscript`);
                if (pageLinks?.length === 0) {
                    throw new Error('No pages found in Florus manuscript');
                }
                
                // For Florus, we now have all pages loaded
                const manifest = {
                    pageLinks,
                    totalPages: pageLinks?.length,
                    library: 'florus' as const,
                    displayName: `BM_Lyon_${cote}`,
                    originalUrl: florusUrl,
                };
                
                console.log(`Florus manifest loaded: ${manifest.displayName}, total pages: ${pageLinks?.length}`);
                return manifest;
                
            } catch (error: any) {
                throw new Error(`Failed to load Florus manuscript: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        
        /**
         * Extract image URLs from Florus HTML page
         */
        private async extractFlorusImageUrls(html: string, cote: string, currentVue: number): Promise<string[]> {
            console.log('Extracting Florus URLs for manuscript:', cote);

            // Extract the image path from current page to understand the pattern
            const imagePathMatch = html.match(/FIF=([^&\s'"]+)/) ||
                                  html.match(/image\s*:\s*'([^']+)'/) ||
                                  html.match(/image\s*:\s*"([^"]+)"/);

            if (!imagePathMatch) {
                throw new Error('Could not find image path pattern in Florus page');
            }

            const currentImagePath = imagePathMatch[1];
            console.log('Current image path:', currentImagePath);

            // Extract the base path and manuscript ID
            // Example: /var/www/florus/web/ms/B693836101_MS0425/B693836101_MS0425_129_62V.JPG.tif
            const pathParts = currentImagePath?.match(/(.+\/)([^/]+)\.JPG\.tif$/);
            if (!pathParts) {
                throw new Error('Could not parse Florus image path structure');
            }

            // const basePath = pathParts[1]; // unused
            const filenameParts = pathParts[2]?.match(/^(.+?)_(\d+)_(.+)$/);
            if (!filenameParts) {
                throw new Error('Could not parse Florus filename structure');
            }

            // Find the total number of pages from navigation
            let maxPage = currentVue + 20; // Conservative fallback

            const navNumbers = [...html.matchAll(/naviguer\((\d+)\)/g)]
                .map(match => parseInt(match?.[1] || '0'))
                .filter(num => !isNaN(num) && num > 0);

            if (navNumbers?.length > 0) {
                maxPage = Math.max(...navNumbers);
            }

            // Also check for pagination links
            const pageLinks: string[] = [];
            const baseUrl = 'https://florus-app.huma-num.fr/fcgi-bin/iipsrv.fcgi';

            // Generate URLs for all pages
            for (let page = 1; page <= maxPage; page++) {
                // Fetch each page to get its specific image URL
                try {
                    const pageUrl = `https://florus-app.huma-num.fr/florus.php?vue=${page}&cote=${cote}`;
                    const pageResponse = await this.deps.fetchDirect(pageUrl);
                    
                    if (pageResponse.ok) {
                        const pageHtml = await pageResponse.text();
                        const pageImageMatch = pageHtml.match(/FIF=([^&\s'"]+)/) ||
                                             pageHtml.match(/image\s*:\s*'([^']+)'/) ||
                                             pageHtml.match(/image\s*:\s*"([^"]+)"/);
                        
                        if (pageImageMatch) {
                            const imagePath = pageImageMatch[1];
                            // Construct the full IIIF URL for maximum resolution
                            const fullUrl = `${baseUrl}?FIF=${imagePath}&CVT=jpeg`;
                            pageLinks.push(fullUrl);
                        }
                    }
                } catch {
                    console.warn(`Failed to fetch Florus page ${page}, stopping here`);
                    break;
                }
            }

            console.log(`Extracted ${pageLinks?.length} Florus page URLs`);
            return pageLinks;
        }
}