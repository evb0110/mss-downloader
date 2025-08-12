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

            // Pad manuscript ID to 10 digits (BNE format)
            const manuscriptId = idMatch[1].padStart(10, '0');
            // Remove leading zeros for display name
            const shortId = parseInt(idMatch[1], 10).toString();
            console.log(`BNE: Loading manuscript ${manuscriptId} with ultra-optimized direct PDF access`);

            // Use smart page discovery with binary search for accurate page count
            const totalPages = await this.smartPageDiscovery(manuscriptId);

            // Generate direct PDF URLs
            const pageLinks: string[] = [];
            for (let page = 1; page <= totalPages; page++) {
                pageLinks.push(
                    `https://bdh-rd.bne.es/pdf.raw?query=id:%22${manuscriptId}%22&page=${page}&view=main&lang=es`
                );
            }

            console.log(`BNE: Generated ${totalPages} direct PDF links instantly`);

            // Create a meaningful display name using the short ID (without leading zeros)
            // This follows the pattern of other libraries and avoids folder mixing
            return {
                pageLinks,
                totalPages,
                library: 'bne',
                displayName: `BNE ${shortId}`,
                originalUrl: originalUrl,
            };

        } catch (error: any) {
            throw new Error(`Failed to load BNE manuscript: ${(error as Error).message}`);
        }
    }

    /**
     * Smart page discovery using exponential search + binary search
     * This works with manuscripts of any size without needing a fixed upper limit
     */
    private async smartPageDiscovery(manuscriptId: string): Promise<number> {
        console.log('BNE: Using smart exponential + binary search for page discovery...');

        // First, check if page 1 exists
        const page1Exists = await this.checkPageExists(manuscriptId, 1);
        if (!page1Exists) {
            throw new Error('Page 1 does not exist - invalid manuscript ID');
        }

        let checksPerformed = 1;

        // Phase 1: Exponential search to find upper bound
        let upperBound = 1;
        let exponentialPage = 1;
        
        console.log('BNE: Phase 1 - Finding upper bound with exponential search...');
        while (true) {
            exponentialPage = upperBound * 2;
            const exists = await this.checkPageExists(manuscriptId, exponentialPage);
            checksPerformed++;
            
            if (exists) {
                upperBound = exponentialPage;
                console.log(`BNE: Page ${exponentialPage} exists, doubling to check ${exponentialPage * 2}...`);
            } else {
                console.log(`BNE: Page ${exponentialPage} doesn't exist, found upper bound`);
                break;
            }
            
            // Safety check for extremely large manuscripts
            if (exponentialPage > 100000) {
                console.warn('BNE: Manuscript appears to have over 100,000 pages, stopping search');
                break;
            }
        }

        // Phase 2: Binary search between upperBound/2 and upperBound
        console.log(`BNE: Phase 2 - Binary search between ${upperBound} and ${exponentialPage}...`);
        let low = upperBound;
        let high = exponentialPage;
        let lastValidPage = upperBound; // We know upperBound exists

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const exists = await this.checkPageExists(manuscriptId, mid);
            checksPerformed++;

            if (exists) {
                lastValidPage = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }

            // Progress indicator
            if (checksPerformed % 5 === 0) {
                console.log(`BNE: Narrowing page range [${low}-${high}], found ${lastValidPage} pages so far...`);
            }
        }

        console.log(`BNE: Found ${lastValidPage} total pages using only ${checksPerformed} checks`);
        return lastValidPage;
    }

    /**
     * Check if a specific page exists by doing a HEAD request
     */
    private async checkPageExists(manuscriptId: string, pageNum: number): Promise<boolean> {
        const url = `https://bdh-rd.bne.es/pdf.raw?query=id:%22${manuscriptId}%22&page=${pageNum}&view=main&lang=es`;

        try {
            // Sanitize URL if sanitizer is available
            const sanitizedUrl = this.deps.sanitizeUrl ? this.deps.sanitizeUrl(url) : url;

            // Use fetchWithHTTPS for SSL bypass if available
            const fetchFn = this.deps.fetchWithHTTPS || this.deps.fetchDirect;

            const response = await fetchFn(sanitizedUrl, {
                method: 'HEAD',
                timeout: 3000, // Short timeout for HEAD requests
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/pdf',
                }
            });

            if (response.ok) {
                const contentType = response.headers.get('content-type');
                const contentLength = response.headers.get('content-length');

                // Valid PDF should be application/pdf and have reasonable size
                return contentType && contentType.includes('pdf') &&
                       contentLength && parseInt(contentLength) > 1000;
            }

            return false;
        } catch {
            // Network errors mean page doesn't exist
            return false;
        }
    }

}