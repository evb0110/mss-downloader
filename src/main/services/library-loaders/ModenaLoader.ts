import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class ModenaLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'modena';
    }
    
    async loadManifest(modenaUrl: string): Promise<ManuscriptManifest> {
            try {
                console.log(`Loading Modena Diocesan Archive manuscript: ${modenaUrl}`);
                
                // Extract manuscript ID from URL
                // Expected format: https://archiviodiocesano.mo.it/archivio/flip/ACMo-OI-7/
                const manuscriptIdMatch = modenaUrl.match(/\/flip\/([^/]+)\/?$/);
                if (!manuscriptIdMatch) {
                    throw new Error('Invalid Modena URL format. Expected: https://archiviodiocesano.mo.it/archivio/flip/MANUSCRIPT_ID/');
                }
                
                const manuscriptId = manuscriptIdMatch[1];
                console.log(`Extracted manuscript ID: ${manuscriptId}`);
                
                // Access mobile interface to determine page count
                const mobileUrl = `${modenaUrl.replace(/\/$/, '')}/mobile/index.html`;
                console.log(`Fetching mobile interface: ${mobileUrl}`);
                
                const mobileResponse = await this.deps.fetchDirect(mobileUrl);
                const mobileHtml = await mobileResponse.text();
                
                // Extract total pages from JavaScript configuration
                // Look for total page count in mobile interface
                let totalPages = 0;
                
                // Try to extract from mobile page display (e.g., "Page: 1/11")
                const pageDisplayMatch = mobileHtml.match(/Page:\s*\d+\/(\d+)/);
                if (pageDisplayMatch) {
                    const displayedTotal = parseInt(pageDisplayMatch[1]);
                    console.log(`Found page display total: ${displayedTotal}`);
                    if (!totalPages || displayedTotal > totalPages) {
                        totalPages = displayedTotal;
                    }
                }
                
                // Try to extract from JavaScript config (more reliable for actual total)
                const totalPagesMatch = mobileHtml.match(/totalPages['":\s]*(\d+)/i);
                if (totalPagesMatch) {
                    const jsTotal = parseInt(totalPagesMatch[1]);
                    console.log(`Found JavaScript total pages: ${jsTotal}`);
                    if (!totalPages || jsTotal > totalPages) {
                        totalPages = jsTotal;
                    }
                }
                
                // Try to extract from data-pages attribute or similar
                const dataPagesMatch = mobileHtml.match(/data-pages[='"\s]*(\d+)/i);
                if (dataPagesMatch) {
                    const dataTotal = parseInt(dataPagesMatch[1]);
                    console.log(`Found data-pages total: ${dataTotal}`);
                    if (!totalPages || dataTotal > totalPages) {
                        totalPages = dataTotal;
                    }
                }
                
                // Try to extract from pages array or configuration
                const pagesArrayMatch = mobileHtml.match(/pages\s*[:=]\s*\[(.*?)\]/s);
                if (pagesArrayMatch) {
                    const pagesContent = pagesArrayMatch[1];
                    const pageCount = (pagesContent.match(/,/g) || []).length + 1;
                    console.log(`Found pages array with ${pageCount} items`);
                    if (!totalPages || pageCount > totalPages) {
                        totalPages = pageCount;
                    }
                }
                
                // Fallback: try to determine by checking sequential image availability
                if (!totalPages) {
                    console.log('No explicit page count found, attempting to determine by checking image availability');
                    const baseImageUrl = `${modenaUrl.replace(/\/$/, '')}/files/mobile/`;
                    
                    // Binary search to find the last available page
                    let low = 1;
                    let high = 500; // Reasonable upper bound
                    let lastFound = 0;
                    
                    while (low <= high) {
                        const mid = Math.floor((low + high) / 2);
                        const testUrl = `${baseImageUrl}${mid}.jpg`;
                        
                        try {
                            const testResponse = await this.deps.fetchDirect(testUrl, { timeout: 5000 });
                            if (testResponse.ok) {
                                lastFound = mid;
                                low = mid + 1;
                            } else {
                                high = mid - 1;
                            }
                        } catch {
                            high = mid - 1;
                        }
                    }
                    
                    if (lastFound > 0) {
                        totalPages = lastFound;
                        console.log(`Determined page count by availability check: ${totalPages}`);
                    }
                }
                
                // Ultimate fallback only as last resort
                if (!totalPages) {
                    console.warn('Could not determine page count, using fallback of 231 pages');
                    totalPages = 231;
                }
                
                console.log(`Final determined page count: ${totalPages}`);
                
                // Verify that images are accessible by testing first page
                const baseImageUrl = `${modenaUrl.replace(/\/$/, '')}/files/mobile/`;
                const firstPageUrl = `${baseImageUrl}1.jpg`;
                
                console.log(`Testing image access: ${firstPageUrl}`);
                const testResponse = await this.deps.fetchDirect(firstPageUrl);
                if (!testResponse.ok) {
                    throw new Error(`Cannot access manuscript images. Status: ${testResponse.status}`);
                }
                
                console.log(`Image access confirmed. Generating URLs for ${totalPages} pages`);
                
                // Generate page URLs using the discovered pattern
                const pageLinks: string[] = [];
                for (let page = 1; page <= totalPages; page++) {
                    pageLinks.push(`${baseImageUrl}${page}.jpg`);
                }
                
                const displayName = `Modena_${manuscriptId}`;
                console.log(`Generated ${pageLinks.length} page URLs for "${displayName}"`);
                
                return {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'modena',
                    displayName,
                    originalUrl: modenaUrl
                };
                
            } catch (error: unknown) {
                console.error('Error loading Modena Diocesan Archive manifest:', error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new Error(`Failed to load Modena manuscript: ${errorMessage}`);
            }
        }
}