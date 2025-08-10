import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class IrhtLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'irht';
    }
    
    async loadManifest(url: string): Promise<ManuscriptManifest> {
            const arkMatch = url.match(/ark:\/(\d+)\/([^/?]+)/);
            if (!arkMatch) {
                throw new Error('Invalid IRHT URL format - could not extract ARK ID');
            }
            const [, authority, name] = arkMatch;
            
            // Add retry logic for server errors
            let lastError: Error = new Error('Unknown error');
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const response = await this.deps.fetchDirect(url, {}, attempt);
                    
                    if (response.status === 500) {
                        throw new Error(`IRHT server error (HTTP 500) - this appears to be a server-side issue with the IRHT digital archive. The manuscript may be temporarily unavailable. Please try again later or verify the URL: ${url}`);
                    }
                    
                    if (!response.ok) {
                        throw new Error(`Failed to load IRHT page: HTTP ${response.status} - ${response.statusText}`);
                    }
                    
                    const html = await response.text();
                    
                    // Enhanced IIIF pattern matching - try multiple patterns for robustness
                    const patterns = [
                        // Original pattern for fully qualified URLs
                        /https:\/\/iiif\.irht\.cnrs\.fr\/iiif\/ark:\/\d+\/([^/\s"']+)\/full\/[^/\s"']+\/\d+\/default\.jpg/g,
                        // Broader pattern to catch partial URLs and extract image IDs
                        /https:\/\/iiif\.irht\.cnrs\.fr\/iiif\/ark:\/\d+\/([^/\s"']+)/g,
                        // Pattern specifically for src attributes
                        /src="https:\/\/iiif\.irht\.cnrs\.fr\/iiif\/ark:\/\d+\/([^/\s"']+)/g,
                        // Pattern for commented IIIF URLs
                        /<!-- a href="https:\/\/iiif\.irht\.cnrs\.fr\/iiif\/ark:\/\d+\/([^/\s"']+)/g
                    ];
                    
                    let imageIds: string[] = [];
                    for (const pattern of patterns) {
                        const matches = [...html.matchAll(pattern)];
                        const ids = matches.map((m) => m[1]);
                        imageIds.push(...ids);
                    }
                    
                    // Remove duplicates and filter out invalid IDs
                    imageIds = [...new Set(imageIds)].filter(id => id && id.length > 5);
                    
                    if (imageIds.length === 0) {
                        throw new Error(`No IIIF images found in IRHT page. The manuscript may not be digitized or may require authentication. URL: ${url}`);
                    }
                    
                    const pageLinks = imageIds.map((id) =>
                        `https://iiif.irht.cnrs.fr/iiif/ark:/${authority}/${id}/full/max/0/default.jpg`,
                    );
                    
                    console.log(`IRHT: Successfully extracted ${pageLinks.length} pages from ${url}`);
                    
                    return {
                        pageLinks,
                        totalPages: pageLinks.length,
                        displayName: `IRHT_${name}`,
                        library: 'irht',
                        originalUrl: url
                    };
                    
                } catch (error: any) {
                    lastError = error;
                    
                    // Only retry for server errors (5xx), not client errors (4xx)
                    if ((error as Error).message.includes('500') && attempt < 3) {
                        console.warn(`IRHT attempt ${attempt} failed with server error, retrying in ${this.calculateRetryDelay(attempt)}ms...`);
                        await this.deps.sleep(this.calculateRetryDelay(attempt));
                        continue;
                    } else {
                        // Don't retry for client errors or final attempt
                        throw error;
                    }
                }
            }
            
            throw new Error(`Failed to load IRHT manuscript after 3 attempts: ${lastError.message}`);
        }
}