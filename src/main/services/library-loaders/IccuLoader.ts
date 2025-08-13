import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class IccuLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'iccu';
    }
        async loadManifest(originalUrl: string): Promise<ManuscriptManifest> {
            try {
                console.log(`Loading ICCU API manuscript from: ${originalUrl}`);
                
                // Extract manuscript ID from URL
                const idMatch = originalUrl.match(/[?&]id=(\d+)/);
                if (!idMatch) {
                    throw new Error('Invalid ICCU URL format - cannot extract manuscript ID');
                }
                
                const manuscriptId = idMatch[1];
                console.log(`Extracted manuscript ID: ${manuscriptId}`);
                
                // Use the ICCU API to get manifest URLs
                const apiUrl = `/o/manus-api/title?_method=get&_path=%2Fo%2Fmanus-api%2Ftitle&id=${manuscriptId}`;
                const fullApiUrl = `https://manus.iccu.sbn.it${apiUrl}`;
                
                console.log(`Fetching ICCU API data from: ${fullApiUrl}`);
                
                const apiResponse = await this.deps.fetchDirect(fullApiUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
                        'Cache-Control': 'no-cache',
                        'Referer': originalUrl
                    }
                });
                
                if (!apiResponse.ok) {
                    throw new Error(`Failed to fetch ICCU API data: HTTP ${apiResponse.status}`);
                }
                
                const apiData = await apiResponse.json();
                console.log(`ICCU API response status:`, apiData.status);
                
                if (!apiData.data || !apiData.data.img || !apiData.data.img.src) {
                    throw new Error('No thumbnail URL found in ICCU API response');
                }
                
                // Extract thumbnail URL and derive manifest URL
                const thumbnailUrl = apiData.data.img.src;
                console.log(`Found thumbnail URL: ${thumbnailUrl}`);
                
                // Convert thumbnail URL to manifest URL
                const manifestUrl = thumbnailUrl.replace('/thumbnail', '/manifest');
                console.log(`Derived manifest URL: ${manifestUrl}`);
                
                // Get the manuscript title for display
                const displayName = apiData.data.title || `ICCU Manuscript ${manuscriptId}`;
                console.log(`Display name: ${displayName}`);
                
                // Load the manifest using the vallicelliana handler (since it's a DAM URL)
                if (!this.deps.loadVallicellianManifest) {
                    throw new Error('Vallicelliana manifest loader not available');
                }
                const manifest = await this.deps.loadVallicellianManifest(manifestUrl);
                
                // Update the display name with the API-provided title
                manifest.displayName = displayName;
                
                return manifest;
                
            } catch (error: unknown) {
                console.error('ICCU API manifest loading error:', error);
                throw new Error(`Failed to load ICCU manuscript: ${(error as Error).message}`);
            }
        }
}