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
                
                // Verify that both parts of the manuscript ID are the same
                if (manuscriptId1 !== manuscriptId2) {
                    throw new Error('Inconsistent manuscript ID in Rome URL');
                }
                
                const manuscriptId = manuscriptId1;
                console.log(`Processing Rome ${collectionType} manuscript: ${manuscriptId}`);
                
                // Fetch the first page to get metadata and examine image URLs
                // Apply enhanced error handling for BNC Roma infrastructure issues
                let pageResponse: Response;
                try {
                    pageResponse = await this.deps.fetchDirect(romeUrl);
                } catch (fetchError: unknown) {
                    // Enhanced error handling for BNC Roma server infrastructure failures
                    if (fetchError.name === 'AbortError' || fetchError.code === 'ECONNRESET' || 
                        fetchError.code === 'ENOTFOUND' || fetchError.code === 'ECONNREFUSED' || 
                        fetchError.code === 'ETIMEDOUT' || fetchError.code === 'ENETUNREACH' ||
                        fetchError.message.includes('timeout') || fetchError.message.includes('ENETUNREACH')) {
                        throw new Error(`BNC Roma server infrastructure failure: The digital library server (digitale.bnc.roma.sbn.it) is currently unreachable. This appears to be a network infrastructure issue affecting the entire server. Please check the BNC Roma website (www.bncrm.beniculturali.it) for service announcements, or try again later. If the issue persists, contact GARR technical support at cert@garr.it or BNC Roma IT at bnc-rm.digitallibrary@beniculturali.it`);
                    }
                    throw new Error(`BNC Roma network connection failed: ${fetchError.message}`);
                }
                
                if (!pageResponse.ok) {
                    if (pageResponse.status === 500) {
                        throw new Error(`BNC Roma server error (HTTP 500): The digital library server is experiencing internal issues. This may be a temporary server-side problem. Please try again in a few minutes, or check the BNC Roma website for service announcements.`);
                    } else if (pageResponse.status === 503) {
                        throw new Error(`BNC Roma service unavailable (HTTP 503): The digital library is temporarily unavailable, possibly due to maintenance or high traffic. Please try again later.`);
                    } else if (pageResponse.status === 404) {
                        throw new Error(`BNC Roma manuscript not found (HTTP 404): The requested manuscript may have been moved, removed, or the URL may be incorrect. Please verify the URL and try again.`);
                    } else if (pageResponse.status === 403) {
                        throw new Error(`BNC Roma access denied (HTTP 403): Access to this manuscript may be restricted. Please check if authentication is required or if the manuscript is publicly available.`);
                    } else if (pageResponse.status >= 500) {
                        throw new Error(`BNC Roma server error (HTTP ${pageResponse.status}): The digital library server is experiencing technical difficulties. Please try again later or contact BNC Roma support.`);
                    } else {
                        throw new Error(`Failed to load Rome page: HTTP ${pageResponse.status} - ${pageResponse.statusText}`);
                    }
                }
                
                const html = await pageResponse.text();
                
                // Extract title from the breadcrumbs or page content
                let title = manuscriptId; // fallback
                const titleMatch = html.match(/<title>([^<]+)<\/title>/) || 
                                  html.match(/Dettaglio manoscritto[^>]*>[^:]*:\s*([^<]+)</) ||
                                  html.match(/data-caption="([^"]+)"/);
                if (titleMatch) {
                    title = titleMatch[1].trim().replace(/\s*-\s*Biblioteca.*/, '');
                }
                
                // Extract total page count from "Totale immagini: 175"
                const pageCountMatch = html.match(/Totale immagini:\s*(\d+)/);
                if (!pageCountMatch) {
                    throw new Error('Could not extract page count from Rome manuscript page');
                }
                
                const totalPages = parseInt(pageCountMatch[1], 10);
                
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
                    displayName: title,
                    originalUrl: romeUrl
                };
                
            } catch (error: unknown) {
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
}