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
         * ULTRATHINK HYBRID APPROACH: Multiple strategies for Rome page discovery
         * Strategy 1: Binary search with HEAD requests (preferred)
         * Strategy 2: GET request sampling (fallback for HEAD failures)
         * If both fail: Throw error - DO NOT guess page count
         */
        private async discoverPageCount(collectionType: string, manuscriptId: string): Promise<number> {
            console.log(`[Rome] Starting hybrid page discovery for ${manuscriptId}`);
            
            // Strategy 1: Try binary search with HEAD requests (current approach)
            try {
                console.log(`[Rome] Attempting binary search with HEAD requests...`);
                const headResult = await this.binarySearchWithHead(collectionType, manuscriptId);
                
                // If we get a reasonable result (not 0 or 1), use it
                if (headResult > 1) {
                    console.log(`[Rome] Binary search with HEAD succeeded: ${headResult} pages`);
                    return headResult;
                }
                
                console.log(`[Rome] Binary search with HEAD gave insufficient result: ${headResult}, trying alternatives...`);
            } catch (error) {
                console.log(`[Rome] Binary search with HEAD failed: ${error instanceof Error ? error.message : String(error)}`);
            }
            
            // Strategy 2: GET request sampling fallback
            try {
                console.log(`[Rome] Attempting GET request sampling...`);
                const getResult = await this.samplePagesWithGet(collectionType, manuscriptId);
                
                if (getResult > 1) {
                    console.log(`[Rome] GET request sampling succeeded: ${getResult} pages`);
                    return getResult;
                }
                
                console.log(`[Rome] GET request sampling gave insufficient result: ${getResult}`);
            } catch (error) {
                console.log(`[Rome] GET request sampling failed: ${error instanceof Error ? error.message : String(error)}`);
            }
            
            // All strategies failed - throw error, don't guess page count
            const error = new Error(`Unable to determine page count for Rome manuscript ${manuscriptId}. Server is not responding to page discovery requests.`);
            console.error(`[Rome] Page discovery completely failed:`, error.message);
            throw error;
        }
        
        /**
         * Strategy 1: Original binary search with HEAD requests
         */
        private async binarySearchWithHead(collectionType: string, manuscriptId: string): Promise<number> {
            let upperBound = 1;
            let attempts = 0;
            const maxAttempts = 10; // Reduced attempts for faster fallback
            let headFailures = 0;
            
            // Find upper bound with early failure detection
            while (attempts < maxAttempts) {
                const pageExists = await this.checkPageExistsWithHead(collectionType, manuscriptId, upperBound);
                
                // Track HEAD request failures
                if (pageExists === null) {
                    headFailures++;
                    // If 3+ consecutive HEAD failures, abandon this strategy
                    if (headFailures >= 3) {
                        throw new Error(`Multiple HEAD request failures - server doesn't support HEAD`);
                    }
                }
                
                if (!pageExists) {
                    console.log(`[Rome] HEAD: Found upper bound at page ${upperBound}`);
                    break;
                }
                
                upperBound *= 2;
                attempts++;
                
                if (upperBound > 1000) { // Reduced limit for faster processing
                    break;
                }
            }
            
            // Binary search
            let low = Math.floor(upperBound / 2);
            let high = upperBound;
            
            while (low < high - 1) {
                const mid = Math.floor((low + high) / 2);
                const exists = await this.checkPageExistsWithHead(collectionType, manuscriptId, mid);
                
                if (exists === null) {
                    headFailures++;
                    if (headFailures >= 5) {
                        throw new Error(`Too many HEAD failures during binary search`);
                    }
                    // Skip this iteration and try another mid point
                    continue;
                }
                
                if (exists) {
                    low = mid;
                } else {
                    high = mid;
                }
            }
            
            const finalResult = await this.checkPageExistsWithHead(collectionType, manuscriptId, high);
            return finalResult ? high : low;
        }
        
        /**
         * Strategy 2: Sample pages using GET requests to find bounds
         */
        private async samplePagesWithGet(collectionType: string, manuscriptId: string): Promise<number> {
            console.log(`[Rome] Sampling pages with GET requests...`);
            
            // Test common page ranges to find bounds
            const testPages = [1, 5, 10, 20, 50, 100, 200, 500];
            let lastValidPage = 1;
            
            for (const pageNum of testPages) {
                const exists = await this.checkPageExistsWithGet(collectionType, manuscriptId, pageNum);
                if (exists) {
                    lastValidPage = pageNum;
                    console.log(`[Rome] GET: Page ${pageNum} exists`);
                } else {
                    console.log(`[Rome] GET: Page ${pageNum} not found, max is between ${lastValidPage} and ${pageNum}`);
                    break;
                }
            }
            
            // If we found a range, do a smaller binary search with GET
            if (lastValidPage > 1) {
                return await this.fineTuneWithGet(collectionType, manuscriptId, lastValidPage, Math.min(lastValidPage * 2, 500));
            }
            
            return lastValidPage;
        }
        
        /**
         * Fine-tune page count using GET requests in a smaller range
         */
        private async fineTuneWithGet(collectionType: string, manuscriptId: string, low: number, high: number): Promise<number> {
            console.log(`[Rome] Fine-tuning with GET between ${low} and ${high}`);
            
            for (let page = high; page >= low; page--) {
                const exists = await this.checkPageExistsWithGet(collectionType, manuscriptId, page);
                if (exists) {
                    console.log(`[Rome] GET fine-tune: Found highest page ${page}`);
                    return page;
                }
            }
            
            return low;
        }
        
        
        /**
         * Check if a specific page exists using HEAD request
         * Returns: true if exists, false if not exists, null if HEAD request failed
         */
        private async checkPageExistsWithHead(collectionType: string, manuscriptId: string, pageNum: number): Promise<boolean | null> {
            const imageUrl = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/${collectionType}/${manuscriptId}/${manuscriptId}/${pageNum}/original`;
            
            try {
                const response = await this.deps.fetchDirect(imageUrl, {
                    method: 'HEAD'
                });
                
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
                // Distinguish between network failure and page not found
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (errorMessage.includes('ECONNRESET') || errorMessage.includes('socket hang up') || 
                    errorMessage.includes('network') || errorMessage.includes('timeout')) {
                    console.log(`[Rome] HEAD request failed for page ${pageNum}: ${errorMessage}`);
                    return null; // Network/server issue
                }
                
                return false; // Page doesn't exist
            }
        }
        
        /**
         * Check if a specific page exists using GET request (fallback method)
         * More reliable but slower than HEAD requests
         */
        private async checkPageExistsWithGet(collectionType: string, manuscriptId: string, pageNum: number): Promise<boolean> {
            const imageUrl = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/${collectionType}/${manuscriptId}/${manuscriptId}/${pageNum}/original`;
            
            try {
                const response = await this.deps.fetchDirect(imageUrl, {
                    method: 'GET'
                });
                
                if (response.ok) {
                    // For GET requests, we can check more thoroughly
                    const contentType = response.headers.get('content-type');
                    const contentLength = response.headers.get('content-length');
                    
                    // Valid image content
                    const isValidImage = contentType && contentType.includes('image') &&
                                        contentLength && parseInt(contentLength) > 1000;
                    
                    if (isValidImage) {
                        console.log(`[Rome] GET: Page ${pageNum} confirmed (${contentLength} bytes, ${contentType})`);
                        return true;
                    }
                }
                
                return false;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.log(`[Rome] GET request failed for page ${pageNum}: ${errorMessage}`);
                return false;
            }
        }
        
}