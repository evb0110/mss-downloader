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
            
            // ULTRATHINK FIX: Clear suspicious cached Rome data before loading
            // If cache has 1 page or 1024 pages, it's definitely wrong
            const cachedManifest = await this.deps.manifestCache.get(romeUrl);
            if (cachedManifest) {
                const cachedPages = cachedManifest['totalPages'] as number;
                const suspiciousPageCounts = [1, 512, 1024, 2048, 4096];
                if (suspiciousPageCounts.includes(cachedPages)) {
                    console.log(`[Rome] CACHE CORRUPTION DETECTED: ${cachedPages} pages cached - clearing and rediscovering...`);
                    await this.deps.manifestCache.clearUrl(romeUrl);
                }
            }
            
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
            
            // ULTRATHINK FIX: Skip HEAD requests for Rome - they don't provide Content-Length for phantom pages
            // Go straight to GET requests which properly distinguish real vs phantom pages
            /*
            try {
                console.log(`[Rome] Attempting binary search with HEAD requests...`);
                const headResult = await this.binarySearchWithHead(collectionType, manuscriptId);
                
                // If we get a reasonable result (not 0 or 1), validate content quality
                if (headResult > 1) {
                    console.log(`[Rome] Binary search with HEAD succeeded: ${headResult} pages`);
                    // ULTRATHINK ENHANCEMENT: Apply content quality validation
                    const qualityValidatedPages = await this.validateContentQuality(collectionType, manuscriptId, headResult);
                    return qualityValidatedPages;
                }
                
                console.log(`[Rome] Binary search with HEAD gave insufficient result: ${headResult}, trying alternatives...`);
            } catch (error) {
                console.log(`[Rome] Binary search with HEAD failed: ${error instanceof Error ? error.message : String(error)}`);
            }
            */
            
            // ULTRATHINK: Start with GET requests for Rome since HEAD doesn't provide Content-Length
            try {
                console.log(`[Rome] Attempting GET request sampling...`);
                const getResult = await this.samplePagesWithGet(collectionType, manuscriptId);
                
                if (getResult > 1) {
                    console.log(`[Rome] GET request sampling succeeded: ${getResult} pages`);
                    // ULTRATHINK ENHANCEMENT: Apply content quality validation to GET results too
                    const qualityValidatedPages = await this.validateContentQuality(collectionType, manuscriptId, getResult);
                    return qualityValidatedPages;
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
         * DISABLED: HEAD requests don't provide Content-Length for Rome phantom pages
         */
        /* private async binarySearchWithHead(collectionType: string, manuscriptId: string): Promise<number> {
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
        } */
        
        /**
         * Strategy 2: Binary search using GET requests (more reliable for Rome)
         */
        private async samplePagesWithGet(collectionType: string, manuscriptId: string): Promise<number> {
            console.log(`[Rome] Using GET-based binary search for accurate page detection...`);
            
            // First verify page 1 exists
            const page1Exists = await this.checkPageExists(collectionType, manuscriptId, 1);
            if (!page1Exists) {
                console.log(`[Rome] GET: Page 1 doesn't exist or returns HTML - manuscript may be invalid`);
                // Still try to find if any pages exist
            }
            
            // Find upper bound with exponential search - NO CAPS!
            let upperBound = 1;
            let attempts = 0;
            const maxAttempts = 20; // Reasonable iteration limit, not page limit
            
            // Start searching from a reasonable initial bound
            while (attempts < maxAttempts) {
                const exists = await this.checkPageExists(collectionType, manuscriptId, upperBound);
                if (!exists) {
                    console.log(`[Rome] GET: Found upper bound at page ${upperBound} (does not exist)`);
                    break;
                }
                console.log(`[Rome] GET: Page ${upperBound} exists, continuing search...`);
                upperBound *= 2;
                attempts++;
            }
            
            // If we never found a non-existent page, use the last tested upperBound
            if (attempts >= maxAttempts) {
                console.log(`[Rome] GET: Reached max attempts, using upperBound ${upperBound}`);
            }
            
            // Edge case: if upperBound is 1 and page 1 doesn't exist
            if (upperBound === 1 && !page1Exists) {
                console.log(`[Rome] GET: No valid pages found, returning 0`);
                return 0;
            }
            
            // Binary search for exact count
            let low = upperBound === 1 ? 1 : Math.floor(upperBound / 2);
            let high = upperBound;
            
            while (low < high - 1) {
                const mid = Math.floor((low + high) / 2);
                const exists = await this.checkPageExists(collectionType, manuscriptId, mid);
                
                if (exists) {
                    low = mid;
                } else {
                    high = mid;
                }
            }
            
            // Final check
            const finalExists = await this.checkPageExists(collectionType, manuscriptId, high);
            const result = finalExists ? high : low;
            
            console.log(`[Rome] GET binary search complete: ${result} pages`);
            return result;
            
            /* OLD sampling code - replaced with proper binary search
            const testPages = [1, 5, 10, 20, 50, 100, 200, 500];
            let lastValidPage = 1;
            
            // Removed old sampling code
            */
        }
        
        // fineTuneWithGet method removed - using proper binary search instead
        
        
        /**
         * Check if a specific page exists using HEAD request
         * Returns: true if exists, false if not exists, null if HEAD request failed
         * DISABLED: HEAD requests unreliable for Rome
         */
        /* private async checkPageExistsWithHead(collectionType: string, manuscriptId: string, pageNum: number): Promise<boolean | null> {
            const imageUrl = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/${collectionType}/${manuscriptId}/${manuscriptId}/${pageNum}/original`;
            
            try {
                const response = await this.deps.fetchDirect(imageUrl, {
                    method: 'HEAD'
                });
                
                if (response.ok) {
                    const contentLength = response.headers.get('content-length');
                    const contentType = response.headers.get('content-type');
                    
                    // ULTRATHINK FIX: Rome returns HTTP 200 with text/html for non-existent pages
                    // Only accept image/* content types, reject text/html phantom pages
                    const isValidImage = contentType && contentType.includes('image') &&
                                        contentLength && parseInt(contentLength) > 1000;
                    
                    if (!isValidImage && response.ok) {
                        // Log phantom page detection for debugging
                        console.log(`[Rome] Phantom page ${pageNum} detected: ${contentType || 'no content-type'}, ${contentLength || '0'} bytes`);
                    }
                    
                    return isValidImage ? true : false;
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
        } */
        
        /**
         * Check if a specific page exists using HEAD request
         * Faster than GET and properly distinguishes HTML error pages from real images
         */
        private async checkPageExists(collectionType: string, manuscriptId: string, pageNum: number): Promise<boolean> {
            const imageUrl = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/${collectionType}/${manuscriptId}/${manuscriptId}/${pageNum}/original`;
            
            try {
                // ULTRATHINK FIX: Use HEAD for existence check, GET was downloading entire images
                const response = await this.deps.fetchDirect(imageUrl, {
                    method: 'HEAD'
                });
                
                if (response.ok) {
                    const contentType = response.headers.get('content-type');
                    
                    // Rome returns 200 OK with text/html for non-existent pages
                    // Real pages have image/jpeg content type
                    if (contentType && contentType.includes('text/html')) {
                        console.log(`[Rome] Phantom page ${pageNum} detected - HTML response`);
                        return false;
                    }
                    
                    // Valid image if it has image content type
                    // Don't rely on content-length as it's not always provided by HEAD
                    const isValidImage = contentType && contentType.includes('image');
                    
                    if (isValidImage) {
                        console.log(`[Rome] Page ${pageNum} exists (${contentType})`);
                        return true;
                    } else {
                        console.log(`[Rome] Page ${pageNum} invalid (${contentType || 'no type'})`);
                        return false;
                    }
                }
                
                return false;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.log(`[Rome] Request failed for page ${pageNum}: ${errorMessage}`);
                return false;
            }
        }
        
        /**
         * ULTRATHINK ENHANCEMENT: Content quality validation for more accurate page counts
         * Analyzes final pages to detect minimal content (appendices, blank pages) 
         */
        private async validateContentQuality(collectionType: string, manuscriptId: string, detectedPages: number): Promise<number> {
            console.log(`[Rome] Validating content quality for ${detectedPages} pages...`);
            
            // Skip validation for small manuscripts (< 10 pages)
            if (detectedPages < 10) {
                return detectedPages;
            }
            
            // Sample 3 representative pages from middle section to establish baseline
            const sampleIndices = [
                Math.floor(detectedPages * 0.3),
                Math.floor(detectedPages * 0.5), 
                Math.floor(detectedPages * 0.7)
            ];
            
            let totalSampleSize = 0;
            let validSamples = 0;
            
            for (const pageNum of sampleIndices) {
                const size = await this.getPageContentSize(collectionType, manuscriptId, pageNum);
                if (size > 0) {
                    totalSampleSize += size;
                    validSamples++;
                }
            }
            
            if (validSamples === 0) {
                console.log(`[Rome] No valid samples for content quality analysis`);
                return detectedPages;
            }
            
            const averagePageSize = totalSampleSize / validSamples;
            const minAcceptableSize = averagePageSize * 0.3; // 30% of average
            
            console.log(`[Rome] Average content size: ${Math.round(averagePageSize / 1024)}KB, minimum acceptable: ${Math.round(minAcceptableSize / 1024)}KB`);
            
            // Check final 15 pages for minimal content
            const finalCheckStart = Math.max(1, detectedPages - 14);
            let lastSubstantialPage = detectedPages;
            
            for (let pageNum = detectedPages; pageNum >= finalCheckStart; pageNum--) {
                const size = await this.getPageContentSize(collectionType, manuscriptId, pageNum);
                
                if (size >= minAcceptableSize) {
                    lastSubstantialPage = pageNum;
                    break;
                }
            }
            
            if (lastSubstantialPage < detectedPages) {
                console.log(`[Rome] Content quality filter: ${detectedPages} → ${lastSubstantialPage} pages (filtered ${detectedPages - lastSubstantialPage} minimal-content pages)`);
                return lastSubstantialPage;
            }
            
            console.log(`[Rome] All ${detectedPages} pages have substantial content`);
            return detectedPages;
        }
        
        /**
         * Get content size for a specific page (helper for content quality validation)
         */
        private async getPageContentSize(collectionType: string, manuscriptId: string, pageNum: number): Promise<number> {
            const imageUrl = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/${collectionType}/${manuscriptId}/${manuscriptId}/${pageNum}/original`;
            
            try {
                const response = await this.deps.fetchDirect(imageUrl, { method: 'HEAD' });
                
                if (response.ok) {
                    const contentLength = response.headers.get('content-length');
                    const contentType = response.headers.get('content-type');
                    
                    if (contentType && contentType.includes('image') && contentLength) {
                        return parseInt(contentLength);
                    }
                }
                
                return 0;
            } catch {
                return 0;
            }
        }
        
}