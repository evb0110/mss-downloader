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
                console.log('Florus page fetched, length:', html.length);
                
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
                
                console.log(`Found ${pageLinks.length} pages for Florus manuscript`);
                if (pageLinks.length === 0) {
                    throw new Error('No pages found in Florus manuscript');
                }
                
                // For Florus, we now have all pages loaded
                const manifest = {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'florus' as const,
                    displayName: `BM_Lyon_${cote}`,
                    originalUrl: florusUrl,
                };
                
                console.log(`Florus manifest loaded: ${manifest.displayName}, total pages: ${pageLinks.length}`);
                return manifest;
                
            } catch (error: any) {
                throw new Error(`Failed to load Florus manuscript: ${(error as Error).message}`);
            }
        }
}