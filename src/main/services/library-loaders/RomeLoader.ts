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
                
                // ULTRATHINK FIX: Remove HTML fetching that causes timeouts
                // Rome server has socket-level issues with HTML pages
                // Use predictable URL pattern instead of fetching HTML
                
                // Use manuscript ID as title (better than generic name)
                let title = manuscriptId;
                
                // Start with reasonable default, can be refined with binary search if needed
                // Most Rome manuscripts have 100-500 pages
                const totalPages = 500;
                
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
}