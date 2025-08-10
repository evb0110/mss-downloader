import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class RouenLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'rouen';
    }
    
    async loadManifest(originalUrl: string): Promise<ManuscriptManifest> {
            try {
                // Extract manuscript ID from URL pattern: 
                // https://www.rotomagus.fr/ark:/12148/btv1b10052442z/f1.item.zoom
                const arkMatch = originalUrl.match(/ark:\/12148\/([^/?\s]+)/);
                if (!arkMatch) {
                    throw new Error('Invalid Rouen URL format. Expected format: https://www.rotomagus.fr/ark:/12148/MANUSCRIPT_ID/f{page}.item.zoom');
                }
                
                const manuscriptId = arkMatch[1];
                console.log(`Extracting Rouen manuscript ID: ${manuscriptId}`);
                
                // Try to get page count from manifest JSON first
                const manifestUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/manifest.json`;
                console.log(`Fetching Rouen manifest: ${manifestUrl}`);
                
                let totalPages = 0;
                let displayName = `Rouen Manuscript ${manuscriptId}`;
                
                try {
                    const manifestResponse = await this.deps.fetchDirect(manifestUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                            'Accept': 'application/json, text/plain, */*',
                            'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
                            'Accept-Encoding': 'gzip, deflate, br',
                            'Referer': originalUrl
                        }
                    });
                    
                    if (manifestResponse.ok) {
                        const manifestData = await manifestResponse.json();
                        console.log('Rouen manifest loaded successfully, searching for page count...');
                        
                        // The manifest has a complex nested structure with multiple repetitions
                        // Try multiple approaches to find the page count
                        let foundPageCount = null;
                        
                        // Method 1: Search for totalNumberPage in nested PageAViewerFragment structures
                        if (manifestData.PageAViewerFragment?.parameters?.fragmentDownload?.contenu?.libelles?.totalNumberPage) {
                            foundPageCount = manifestData.PageAViewerFragment.parameters.fragmentDownload.contenu.libelles.totalNumberPage;
                            console.log(`Found totalNumberPage in PageAViewerFragment.libelles: ${foundPageCount}`);
                        }
                        
                        // Method 2: Search for totalVues in PageAViewerFragment
                        if (!foundPageCount && manifestData.PageAViewerFragment?.parameters?.totalVues) {
                            foundPageCount = manifestData.PageAViewerFragment.parameters.totalVues;
                            console.log(`Found totalVues in PageAViewerFragment: ${foundPageCount}`);
                        }
                        
                        // Method 3: Search for nbTotalVues in PaginationViewerModel
                        if (!foundPageCount && manifestData.PageAViewerFragment?.contenu?.PaginationViewerModel?.parameters?.nbTotalVues) {
                            foundPageCount = manifestData.PageAViewerFragment.contenu.PaginationViewerModel.parameters.nbTotalVues;
                            console.log(`Found nbTotalVues in PaginationViewerModel: ${foundPageCount}`);
                        }
                        
                        // Method 4: Recursive search through the entire manifest for totalNumberPage or totalVues
                        if (!foundPageCount) {
                            const findPageCount = (obj: any): number | null => {
                                if (typeof obj !== 'object' || obj === null) return null;
                                
                                // Check current level for page count fields
                                if (typeof obj.totalNumberPage === 'number' && obj.totalNumberPage > 0) {
                                    return obj.totalNumberPage;
                                }
                                if (typeof obj.totalVues === 'number' && obj.totalVues > 0) {
                                    return obj.totalVues;
                                }
                                
                                // Recursively search nested objects and arrays
                                for (const key in obj) {
                                    if (Object.prototype.hasOwnProperty.call(obj, key)) {
                                        const result = findPageCount(obj[key]);
                                        if (result !== null) return result;
                                    }
                                }
                                
                                return null;
                            };
                            
                            foundPageCount = findPageCount(manifestData);
                            if (foundPageCount) {
                                console.log(`Found page count via recursive search: ${foundPageCount}`);
                            }
                        }
                        
                        if (foundPageCount && typeof foundPageCount === 'number' && foundPageCount > 0) {
                            totalPages = foundPageCount;
                            console.log(`Successfully determined page count: ${totalPages}`);
                            
                            // Try to extract title from manifest - also search recursively
                            const findTitle = (obj: any, keys: string[]): string | null => {
                                if (typeof obj !== 'object' || obj === null) return null;
                                
                                for (const key of keys) {
                                    if (typeof obj[key] === 'string' && obj[key].trim()) {
                                        return obj[key].trim();
                                    }
                                }
                                
                                // Recursively search
                                for (const key in obj) {
                                    if (Object.prototype.hasOwnProperty.call(obj, key)) {
                                        const result = findTitle(obj[key], keys);
                                        if (result) return result;
                                    }
                                }
                                
                                return null;
                            };
                            
                            const titleKeys = ['title', 'label', 'nom', 'libelle', 'intitule'];
                            const foundTitle = findTitle(manifestData, titleKeys);
                            if (foundTitle) {
                                displayName = foundTitle;
                                console.log(`Found title: ${displayName}`);
                            }
                        }
                    }
                } catch (manifestError) {
                    console.warn(`Failed to fetch Rouen manifest, will attempt page discovery: ${(manifestError as Error).message}`);
                }
                
                // Fallback: Try to get page count from viewer page
                if (totalPages === 0) {
                    try {
                        const viewerUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/f1.item.zoom`;
                        console.log(`Fallback: fetching viewer page for page discovery: ${viewerUrl}`);
                        
                        const viewerResponse = await this.deps.fetchDirect(viewerUrl, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                            }
                        });
                        
                        if (viewerResponse.ok) {
                            const viewerHtml = await viewerResponse.text();
                            
                            // Look for page count patterns in the HTML/JavaScript
                            const patterns = [
                                /"totalNumberPage"\s*:\s*(\d+)/,
                                /"totalVues"\s*:\s*(\d+)/,
                                /"nbTotalVues"\s*:\s*(\d+)/,
                                /totalNumberPage["']?\s*:\s*(\d+)/
                            ];
                            
                            for (const pattern of patterns) {
                                const match = viewerHtml.match(pattern);
                                if (match && match[1]) {
                                    totalPages = parseInt(match[1], 10);
                                    console.log(`Found page count via viewer page pattern: ${totalPages}`);
                                    break;
                                }
                            }
                        }
                    } catch (viewerError) {
                        console.warn(`Failed to fetch viewer page: ${(viewerError as Error).message}`);
                    }
                }
                
                if (totalPages === 0) {
                    throw new Error('Could not determine page count for Rouen manuscript');
                }
                
                // Generate page URLs using the highres resolution for maximum quality
                const pageLinks: string[] = [];
                
                for (let i = 1; i <= totalPages; i++) {
                    const imageUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/f${i}.highres`;
                    pageLinks.push(imageUrl);
                }
                
                console.log(`Generated ${pageLinks.length} page URLs for Rouen manuscript`);
                
                return {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'rouen' as const,
                    displayName,
                    originalUrl: originalUrl,
                };
                
            } catch (error: any) {
                throw new Error(`Failed to load Rouen manuscript: ${(error as Error).message}`);
            }
        }
}