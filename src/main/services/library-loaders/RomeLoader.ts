import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class RomeLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'rome';
    }
    
    async loadManifest(romeUrl: string): Promise<ManuscriptManifest> {
            console.log('Loading Rome National Library manifest for:', romeUrl);
            
            try {
                // Extract manuscript ID and collection type from URL
                // Expected formats: 
                // - http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1
                // - http://digitale.bnc.roma.sbn.it/tecadigitale/libroantico/BVEE112879/BVEE112879/1
                const urlMatch = romeUrl.match(/\/(manoscrittoantico|libroantico)\/([^/]+)\/([^/]+)\/(\d+)/);
                if (!urlMatch) {
                    throw new Error('Invalid Rome National Library URL format');
                }
                
                const [, collectionType, manuscriptId1, manuscriptId2] = urlMatch;
                
                if (!collectionType || !manuscriptId1 || !manuscriptId2) {
                    throw new Error('Could not extract manuscript details from Rome URL');
                }
                
                // Verify that both parts of the manuscript ID are the same
                if (manuscriptId1 !== manuscriptId2) {
                    throw new Error('Inconsistent manuscript ID in Rome URL');
                }
                
                const manuscriptId = manuscriptId1;
                console.log(`Processing Rome ${collectionType} manuscript: ${manuscriptId}`);
                
                // ULTRATHINK FIX: Use binary search for dynamic page discovery
                // No more hardcoded limits!
                console.log('Starting binary search page discovery for Rome manuscript...');
                
                let totalPages: number;
                try {
                    totalPages = await this.discoverPageCount(collectionType, manuscriptId);
                    console.log(`Rome: Discovered ${totalPages} pages through binary search`);
                } catch (error) {
                    console.error('Rome: Page discovery failed:', error);
                    throw new Error(`Could not determine page count for Rome manuscript ${manuscriptId}: ${error instanceof Error ? error.message : String(error)}`);
                }
                
                // Use manuscript ID as title (better than generic name)
                let title = manuscriptId;
                
                // Use the maximum resolution /original URL pattern for highest quality
                // /original provides 3-5x larger images compared to /full (tested 2025-07-02)
                // This pattern is known to work: http://digitale.bnc.roma.sbn.it/tecadigitale/img/libroantico/BVEE112879/BVEE112879/2/original
                const imageUrlTemplate = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/${collectionType}/${manuscriptId}/${manuscriptId}/PAGENUM/original`;
                console.log(`Using maximum resolution /original URL template for ${collectionType} collection: ${imageUrlTemplate.replace('PAGENUM', '1')} (first page example)`);
                
                // Generate page links using the determined template
                const pageLinks: string[] = [];
                for (let i = 1; i <= totalPages; i++) {
                    pageLinks.push(imageUrlTemplate.replace('PAGENUM', i.toString()));
                }
                
                console.log(`Rome National Library: Found ${totalPages} pages for "${title}"`);
                console.log(`Using maximum resolution image URL template: ${imageUrlTemplate.replace('PAGENUM', '1')} (first page example)`);
                
                return {
                    pageLinks,
                    totalPages: totalPages,
                    library: 'rome',
                    displayName: title || 'Rome Manuscript',
                    originalUrl: romeUrl
                };
                
            } catch (error: any) {
                console.error('Error loading Rome National Library manifest:', error);
                
                // Pass through enhanced error messages without modification
                if ((error as Error).message.includes('BNC Roma server infrastructure failure') || 
                    (error as Error).message.includes('BNC Roma server error') || 
                    (error as Error).message.includes('BNC Roma service unavailable') || 
                    (error as Error).message.includes('BNC Roma manuscript not found') || 
                    (error as Error).message.includes('BNC Roma access denied') || 
                    (error as Error).message.includes('BNC Roma network connection failed')) {
                    throw error;
                }
                
                // For other errors, provide general context
                if ((error as Error).message.includes('Invalid Rome National Library URL format') || 
                    (error as Error).message.includes('Inconsistent manuscript ID')) {
                    throw new Error(`BNC Roma URL format error: ${(error as Error).message}. Please ensure you're using a valid BNC Roma manuscript URL from digitale.bnc.roma.sbn.it`);
                }
                
                if ((error as Error).message.includes('Could not extract page count')) {
                    throw new Error(`BNC Roma page parsing error: ${(error as Error).message}. The manuscript page format may have changed or the page content is incomplete.`);
                }
                
                throw new Error(`BNC Roma manuscript loading failed: ${(error as Error).message}. Please check the URL and try again, or contact support if the issue persists.`);
            }
        }
        
        /**
         * Binary search to discover actual page count
         * Uses HEAD requests to avoid downloading full images
         */
        private async discoverPageCount(collectionType: string, manuscriptId: string): Promise<number> {
            console.log(`[Rome] Starting binary search for ${manuscriptId}`);
            
            // Phase 1: Exponential search to find upper bound
            let upperBound = 1;
            let attempts = 0;
            const maxAttempts = 20; // Prevent infinite loops
            
            // Find a page that doesn't exist (exponential growth)
            while (attempts < maxAttempts) {
                const pageExists = await this.checkPageExists(collectionType, manuscriptId, upperBound);
                if (!pageExists) {
                    console.log(`[Rome] Found upper bound at page ${upperBound}`);
                    break;
                }
                upperBound *= 2;
                attempts++;
                
                // Sanity check - manuscripts rarely exceed 5000 pages
                if (upperBound > 5000) {
                    console.log(`[Rome] Reached maximum search limit at ${upperBound} pages`);
                    break;
                }
            }
            
            // Phase 2: Binary search between known bounds
            let low = Math.floor(upperBound / 2);
            let high = upperBound;
            
            console.log(`[Rome] Binary search between pages ${low} and ${high}`);
            
            while (low < high - 1) {
                const mid = Math.floor((low + high) / 2);
                const exists = await this.checkPageExists(collectionType, manuscriptId, mid);
                
                if (exists) {
                    low = mid;
                } else {
                    high = mid;
                }
                
                console.log(`[Rome] Binary search: page ${mid} ${exists ? 'exists' : 'not found'}, range now ${low}-${high}`);
            }
            
            // Final check to get exact count
            const finalPage = await this.checkPageExists(collectionType, manuscriptId, high) ? high : low;
            console.log(`[Rome] Final page count: ${finalPage}`);
            
            return finalPage;
        }
        
        /**
         * Check if a specific page exists using HEAD request
         */
        private async checkPageExists(collectionType: string, manuscriptId: string, pageNum: number): Promise<boolean> {
            const imageUrl = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/${collectionType}/${manuscriptId}/${manuscriptId}/${pageNum}/original`;
            
            try {
                // Use fetchWithHTTPS for reliability (Rome is in the HTTPS bypass list)
                const response = await this.deps.fetchWithHTTPS(imageUrl, {
                    method: 'HEAD'
                    // Note: timeout is handled at a different layer
                });
                
                // Check if response is valid and has content
                if (response.ok) {
                    const contentLength = response.headers.get('content-length');
                    const contentType = response.headers.get('content-type');
                    
                    // Valid image should be > 1KB and have image content type
                    const isValidImage = contentLength && parseInt(contentLength) > 1000 && 
                                        contentType && contentType.includes('image');
                    
                    return isValidImage || false;
                }
                
                return false;
            } catch (error) {
                // Page doesn't exist or network error
                return false;
            }
        }
}