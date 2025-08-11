import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class BneLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'bne';
    }
    
    async loadManifest(originalUrl: string): Promise<ManuscriptManifest> {
        try {
            // Extract manuscript ID from URL using regex
            const idMatch = originalUrl.match(/[?&]id=(\d+)/);
            if (!idMatch) {
                throw new Error('Could not extract manuscript ID from BNE URL');
            }
            
            const manuscriptId = idMatch[1];
            console.log(`Extracting BNE manuscript ID: ${manuscriptId}`);
            
            // Use robust page discovery (skip problematic PDF info endpoint)
            console.log('BNE: Using robust page discovery (hanging issue fixed)...');
            return this.robustBneDiscovery(manuscriptId, originalUrl);
            
        } catch (error: any) {
            throw new Error(`Failed to load BNE manuscript: ${(error as Error).message}`);
        }
    }

    /**
     * ULTRA-PRIORITY FIX for Issue #11: Reduced page checking to prevent hanging
     */
    private async robustBneDiscovery(manuscriptId: string, originalUrl: string): Promise<ManuscriptManifest> {
        const discoveredPages: Array<{page: number, contentLength: string, contentType: string}> = [];
        const seenContentHashes = new Set<string>();

        // ULTRA-PRIORITY FIX: Reduced from 500 to 200 to prevent hanging on calculation
        // Most manuscripts have <100 pages, checking 500 causes unnecessary delays
        const maxPages = 200;
        const batchSize = 5; // Reduced from 10 to 5 for better timeout handling

        console.log('BNE: Starting optimized parallel page discovery (Ultra-Priority Fix #11)...');

        // Create progress monitor for BNE discovery with shorter timeouts
        const progressMonitor = this.deps.createProgressMonitor({
            name: 'BNE page discovery',
            library: 'bne',
            options: {
                initialTimeout: 15000,  // Reduced from 30000
                progressCheckInterval: 5000,  // Reduced from 10000
                maxTimeout: 60000  // Reduced from 180000 (1 minute instead of 3)
            }
        });

        try {
            for (let batchStart = 1; batchStart <= maxPages; batchStart += batchSize) {
                const batchEnd = Math.min(batchStart + batchSize - 1, maxPages);

                // Show progress more frequently for better UX
                if (batchStart % 20 === 1) {
                    console.log(`BNE: Processing pages ${batchStart}-${batchEnd}...`);
                }

                // Update progress monitor
                progressMonitor.updateProgress(batchStart, maxPages, `Checking pages ${batchStart}-${batchEnd}...`);

                // Create promises for batch
                const batchPromises: Promise<{page: number, response: Response | null, error: any}>[] = [];
                for (let page = batchStart; page <= batchEnd; page++) {
                    const testUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=${page}&pdf=true`;
                    batchPromises.push(
                        this.fetchBneWithHttps(testUrl, { method: 'HEAD' })
                            .then(response => ({ page, response, error: null }))
                            .catch(error => ({ page, response: null, error }))
                    );
                }

                // Wait for all in batch
                const batchResults = await Promise.all(batchPromises);

                // Process results and check for stop conditions
                let validPagesInBatch = 0;
                let errorsInBatch = 0;

                for (const result of batchResults) {
                    if (result.error) {
                        errorsInBatch++;
                    } else if (result.response && result.response.ok) {
                        const contentLength = result.response.headers.get('content-length');
                        const contentType = result.response.headers.get('content-type');

                        if (contentLength && parseInt(contentLength) > 1000) {
                            const contentHash = `${contentType}-${contentLength}`;

                            if (!seenContentHashes.has(contentHash)) {
                                seenContentHashes.add(contentHash);
                                discoveredPages.push({
                                    page: result.page,
                                    contentLength: contentLength || '0',
                                    contentType: contentType || 'application/pdf'
                                });
                                validPagesInBatch++;
                            }
                        }
                    } else if (result.response && result.response.status === 404) {
                        errorsInBatch++;
                    }
                }

                // ULTRA-PRIORITY FIX: Improved early stop logic
                // Stop if we get too many consecutive errors (indicates end of manuscript)
                if (validPagesInBatch === 0) {
                    if (errorsInBatch >= batchSize / 2 || batchStart > 50) {
                        // If we've already found pages and now hit errors, we've likely reached the end
                        if (discoveredPages.length > 0) {
                            console.log(`BNE: Reached end of manuscript at page ${batchStart - 1}`);
                            break;
                        }
                        // If no pages found at all after checking 50+ pages, stop
                        if (batchStart > 50) {
                            console.log(`BNE: No valid pages found after checking ${batchStart} pages`);
                            break;
                        }
                    }
                }

                // Progress update every 20 pages (more frequent updates)
                if (discoveredPages.length > 0 && discoveredPages.length % 20 === 0) {
                    console.log(`BNE: Discovered ${discoveredPages.length} valid pages so far...`);
                }
            }

            if (discoveredPages.length === 0) {
                throw new Error('No valid pages found for this BNE manuscript');
            }

            // Sort pages by page number
            discoveredPages.sort((a, b) => a.page - b.page);

            // Generate page links using optimal format for maximum resolution
            const pageLinks = discoveredPages.map(page =>
                `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=${page.page}&pdf=true`
            );

            console.log(`BNE optimized discovery completed: ${discoveredPages.length} pages found`);

            progressMonitor.complete();

            return {
                pageLinks,
                totalPages: discoveredPages.length,
                library: 'bne',
                displayName: `BNE Manuscript ${manuscriptId}`,
                originalUrl: originalUrl,
            };

        } catch (error: any) {
            progressMonitor.abort();
            throw error;
        }
    }

    /**
     * ULTRA-PRIORITY FIX for Issue #11: Reduced timeout for HEAD requests
     */
    private async fetchBneWithHttps(url: string, options: { method?: string, timeout?: number } = {}): Promise<Response> {
        // ULTRA-PRIORITY FIX: Sanitize URL before any processing
        url = this.deps.sanitizeUrl(url);

        // Use the fetchWithHTTPS from deps if available, otherwise use regular fetch
        if (this.deps.fetchWithHTTPS) {
            return this.deps.fetchWithHTTPS(url, options);
        }

        // Fallback to regular fetch
        return this.deps.fetchDirect(url, {
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        });
    }
}