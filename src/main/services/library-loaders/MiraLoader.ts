import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class MiraLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'mira';
    }
    
    async loadManifest(miraUrl: string): Promise<ManuscriptManifest> {
        try {
            const response = await this.deps.fetchDirect(miraUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch MIRA page: HTTP ${response.status}`);
            }
            
            const html = await response.text();
            
            // Look for the manifest in the windows section which shows the default manifest for this MIRA item
            const windowsMatch = html.match(/windows:\s*\[\s*\{\s*manifestId:\s*"([^"]+)"/);
            if (!windowsMatch) {
                throw new Error('No IIIF manifest found in MIRA page windows configuration');
            }
            
            const manifestUrl = windowsMatch[1];
            console.log(`[MIRA] Found manifest URL: ${manifestUrl}`);
            
            const manifestResponse = await this.deps.fetchDirect(manifestUrl);
            if (!manifestResponse.ok) {
                throw new Error(`Failed to fetch MIRA manifest: HTTP ${manifestResponse.status}`);
            }
            
            const manifestText = await manifestResponse.text();
            
            // Check if Trinity Dublin returned HTML instead of JSON (blocked/captcha)
            if (manifestUrl.includes('digitalcollections.tcd.ie') && manifestText.trim().startsWith('<')) {
                throw new Error('Trinity College Dublin manifests are currently blocked due to access restrictions. This MIRA item points to a Trinity Dublin manuscript that cannot be accessed programmatically.');
            }
            
            // Check for other institutions that might return HTML error pages
            if (manifestText.trim().startsWith('<')) {
                // Extract institution name from manifest URL for better error messages
                let institution = 'Unknown institution';
                if (manifestUrl.includes('digitalcollections.tcd.ie')) {
                    institution = 'Trinity College Dublin';
                } else if (manifestUrl.includes('isos.dias.ie')) {
                    institution = 'Irish Script on Screen (ISOS)';
                } else if (manifestUrl.includes('riaconservation.ie')) {
                    institution = 'Royal Irish Academy';
                }
                
                throw new Error(`Failed to access IIIF manifest from ${institution}. The manifest URL returned an HTML page instead of JSON data, indicating access restrictions or server issues. Manifest URL: ${manifestUrl}`);
            }
            
            let iiifManifest;
            try {
                iiifManifest = JSON.parse(manifestText);
            } catch (parseError: any) {
                throw new Error(`Invalid JSON manifest from ${manifestUrl}: ${parseError.message}`);
            }
            
            if (!iiifManifest.sequences || !iiifManifest.sequences[0] || !iiifManifest.sequences[0].canvases) {
                throw new Error('Invalid IIIF manifest structure');
            }
            
            const pageLinks = iiifManifest.sequences[0].canvases.map((canvas: any) => {
                const resource = canvas.images[0].resource;
                return resource['@id'] || resource.id || resource.service?.['@id'] + '/full/max/0/default.jpg';
            }).filter((link: string) => link);
            
            if (pageLinks.length === 0) {
                throw new Error('No pages found in manifest');
            }
            
            const urlMatch = miraUrl.match(/\/(\d+)$/);
            const manuscriptId = urlMatch ? urlMatch[1] : 'unknown';
            
            // Extract manuscript name from the page title if available
            const titleMatch = html.match(/<h1[^>]*>MIrA \d+:\s*([^<]+)<\/h1>/);
            const manuscriptName = titleMatch ? titleMatch[1].trim() : `MIRA_${manuscriptId}`;
            
            return {
                pageLinks,
                totalPages: pageLinks.length,
                library: 'mira',
                displayName: manuscriptName,
                originalUrl: miraUrl,
            };
            
        } catch (error: any) {
            throw new Error(`Failed to load MIRA manuscript: ${(error as Error).message}`);
        }
    }
}