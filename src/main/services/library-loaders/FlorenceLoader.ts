import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class FlorenceLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'florence';
    }
    
    async loadManifest(originalUrl: string): Promise<ManuscriptManifest> {
            // Log the start of Florence manifest loading
            this.deps.logger.log({
                level: 'info',
                library: 'florence',
                url: originalUrl,
                message: 'Starting Florence manifest load',
                details: { method: 'loadFlorenceManifest' }
            });
            
            try {
                const urlMatch = originalUrl.match(/cdm21059\.contentdm\.oclc\.org\/digital\/collection\/plutei\/id\/(\d+)/);
                if (!urlMatch) {
                    const error = new Error('Could not extract item ID from Florence URL');
                    this.deps.logger.logDownloadError('florence', originalUrl, error);
                    throw error;
                }
    
                const itemId = urlMatch[1];
                console.log(`🔍 Florence: itemId=${itemId}`);
    
                const compoundXmlUrl = `https://cdm21059.contentdm.oclc.org/utils/getfile/collection/plutei/id/${itemId}`;
                console.log('📄 Fetching Florence compound object XML structure...');
    
                // Use fetchWithHTTPS for Florence to handle connection issues
                const xmlResponse = await this.deps.fetchWithHTTPS(compoundXmlUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                        'Accept': 'application/xml, text/xml, */*',
                        'Referer': originalUrl
                    }
                });
    
                if (!xmlResponse.ok) {
                    console.log('📄 No compound structure found, treating as single page');
                    const iiifUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${itemId}/full/6000,/0/default.jpg`;
                    
                    return {
                        pageLinks: [iiifUrl],
                        totalPages: 1,
                        library: 'florence',
                        displayName: 'Florence Manuscript',
                        originalUrl: originalUrl,
                    };
                }
    
                const xmlText = await xmlResponse.text();
                console.log(`📄 XML structure retrieved (${xmlText.length} characters)`);
    
                const pageMatches = xmlText.match(/<page>[\s\S]*?<\/page>/g);
                if (!pageMatches || pageMatches.length === 0) {
                    console.log('📄 No compound pages found, treating as single page');
                    const iiifUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${itemId}/full/6000,/0/default.jpg`;
                    
                    return {
                        pageLinks: [iiifUrl],
                        totalPages: 1,
                        library: 'florence',
                        displayName: 'Florence Manuscript',
                        originalUrl: originalUrl,
                    };
                }
    
                console.log(`📄 Found ${pageMatches.length} pages in compound object`);
    
                const pages: Array<{
                    pagePtr: string;
                    title: string;
                }> = [];
    
                let displayName = 'Florence Manuscript';
    
                for (let i = 0; i < pageMatches.length; i++) {
                    const pageXml = pageMatches[i];
    
                    const titleMatch = pageXml.match(/<pagetitle>(.*?)<\/pagetitle>/);
                    const ptrMatch = pageXml.match(/<pageptr>(.*?)<\/pageptr>/);
    
                    if (!ptrMatch) {
                        console.warn(`No pageptr found for page ${i + 1}, skipping`);
                        continue;
                    }
    
                    const pagePtr = ptrMatch[1];
                    const title = titleMatch ? titleMatch[1] : `Page ${i + 1}`;
    
                    if (i === 0 && titleMatch && titleMatch[1]) {
                        const cleanTitle = titleMatch[1]
                            .replace(/^\s*carta:\s*/i, '')
                            .replace(/^\s*page\s*\d+[rv]?\s*/i, '')
                            .trim();
                        if (cleanTitle && cleanTitle.length > 3) {
                            displayName = cleanTitle;
                        }
                    }
    
                    pages.push({
                        pagePtr: pagePtr,
                        title: title
                    });
    
                    console.log(`📄 Page ${i + 1}: ${title} (ptr: ${pagePtr})`);
                }
    
                if (pages.length === 0) {
                    throw new Error('No valid pages found in Florence compound object');
                }
    
                const pageLinks = pages.map(page => 
                    `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${page.pagePtr}/full/6000,/0/default.jpg`
                );
    
                console.log(`📄 Florence manuscript processed: ${pages.length} pages with maximum resolution (6000px width)`);
    
                return {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'florence',
                    displayName: displayName,
                    originalUrl: originalUrl,
                };
    
            } catch (error: any) {
                this.deps.logger.logDownloadError('florence', originalUrl, error as Error);
                throw new Error(`Failed to load Florence manuscript: ${(error as Error).message}`);
            }
        }
}