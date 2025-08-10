import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class MdcCataloniaLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'mdc';
    }
    
    async loadManifest(originalUrl: string): Promise<ManuscriptManifest> {
            try {
                // Extract collection and item ID from URL
                const urlMatch = originalUrl.match(/mdc\.csuc\.cat\/digital\/collection\/([^/]+)\/id\/(\d+)(?:\/rec\/(\d+))?/);
                if (!urlMatch) {
                    throw new Error('Could not extract collection and item ID from MDC Catalonia URL');
                }
                
                const collection = urlMatch[1];
                const parentId = urlMatch[2];
                console.log(`🔍 MDC Catalonia: collection=${collection}, parentId=${parentId}`);
                
                // Step 1: Get ContentDM compound object structure (most reliable method)
                const compoundXmlUrl = `https://mdc.csuc.cat/utils/getfile/collection/${collection}/id/${parentId}`;
                console.log('📄 Fetching compound object XML structure...');
                
                const xmlResponse = await this.deps.fetchDirect(compoundXmlUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                        'Accept': 'application/xml, text/xml, */*',
                        'Referer': originalUrl
                    }
                });
                
                if (!xmlResponse.ok) {
                    throw new Error(`Failed to fetch compound object XML: ${xmlResponse.status} ${xmlResponse.statusText}`);
                }
                
                const xmlText = await xmlResponse.text();
                console.log(`📄 XML structure retrieved (${xmlText.length} characters)`);
                
                // Step 2: Parse XML to extract all page pointers
                const pageMatches = xmlText.match(/<page>[\s\S]*?<\/page>/g);
                if (!pageMatches || pageMatches.length === 0) {
                    throw new Error('No pages found in compound object XML structure');
                }
                
                console.log(`📄 Found ${pageMatches.length} pages in compound object`);
                
                // Step 3: Extract page information with robust parsing
                const pages: Array<{
                    index: number;
                    title: string;
                    filename: string;
                    pagePtr: string;
                }> = [];
                
                for (let i = 0; i < pageMatches.length; i++) {
                    const pageXml = pageMatches[i];
                    
                    const titleMatch = pageXml.match(/<pagetitle>(.*?)<\/pagetitle>/);
                    const fileMatch = pageXml.match(/<pagefile>(.*?)<\/pagefile>/);
                    const ptrMatch = pageXml.match(/<pageptr>(.*?)<\/pageptr>/);
                    
                    if (titleMatch && fileMatch && ptrMatch) {
                        pages.push({
                            index: i + 1,
                            title: titleMatch[1],
                            filename: fileMatch[1],
                            pagePtr: ptrMatch[1]
                        });
                    } else {
                        console.warn(`⚠️ Could not parse page ${i + 1} from XML structure`);
                    }
                }
                
                if (pages.length === 0) {
                    throw new Error('No valid pages could be extracted from XML structure');
                }
                
                console.log(`✅ Successfully parsed ${pages.length} pages from XML`);
                
                // Step 4: Generate image URLs with multiple resolution strategies
                const pageLinks: string[] = [];
                let validPages = 0;
                let consecutiveErrors = 0;
                const maxConsecutiveErrors = 10; // More tolerant
                
                for (const page of pages) {
                    try {
                        // Multiple resolution strategies based on analysis findings:
                        // 1. /full/full/ - Maximum resolution (primary choice)
                        // 2. /full/max/ - Maximum resolution (alternative)  
                        // 3. /full/800,/ - Reduced resolution (fallback)
                        
                        const resolutionStrategies = [
                            'full/full',  // Highest quality
                            'full/max',   // Same as full/full
                            'full/800,'   // Fallback resolution
                        ];
                        
                        let successfulUrl: string | null = null;
                        
                        for (const resolution of resolutionStrategies) {
                            const candidateUrl = `https://mdc.csuc.cat/digital/iiif/${collection}/${page.pagePtr}/${resolution}/0/default.jpg`;
                            
                            try {
                                // Quick validation with HEAD request - MDC doesn't provide content-length reliably
                                const headResponse = await this.deps.fetchDirect(candidateUrl, {
                                    method: 'HEAD',
                                    headers: {
                                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                                        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                                        'Referer': originalUrl
                                    }
                                });
                                
                                // For MDC, if we get 200 + image content-type, the image exists
                                if (headResponse.ok && headResponse.headers.get('content-type')?.includes('image')) {
                                    successfulUrl = candidateUrl;
                                    console.log(`✅ Page ${page.index}: ${page.title} - ${resolution} validated`);
                                    break; // Use first working resolution (full/full is preferred)
                                }
                            } catch (validationError) {
                                // Continue to next resolution strategy
                                continue;
                            }
                        }
                        
                        if (successfulUrl) {
                            pageLinks.push(successfulUrl);
                            validPages++;
                            consecutiveErrors = 0;
                        } else {
                            console.warn(`⚠️ All resolution strategies failed for page ${page.index}: ${page.title}`);
                            consecutiveErrors++;
                            
                            if (consecutiveErrors >= maxConsecutiveErrors) {
                                throw new Error(`Too many consecutive failures (${consecutiveErrors}). Archive may be temporarily unavailable.`);
                            }
                        }
                        
                    } catch (error) {
                        console.warn(`⚠️ Error processing page ${page.index}: ${(error as Error).message}`);
                        consecutiveErrors++;
                        
                        if (consecutiveErrors >= maxConsecutiveErrors) {
                            throw new Error(`MDC Catalonia processing failed after ${consecutiveErrors} consecutive errors at page ${page.index}/${pages.length}: ${(error as Error).message}`);
                        }
                        continue;
                    }
                    
                    // Small delay to be respectful to the server
                    await new Promise(resolve => setTimeout(resolve, 150));
                }
                
                if (pageLinks.length === 0) {
                    throw new Error('No valid image URLs could be generated from any pages');
                }
                
                console.log(`🎯 MDC Catalonia extraction completed: ${validPages} valid pages from ${pages.length} total`);
                
                // Step 5: Return robust manifest with comprehensive metadata
                const title = `MDC Catalonia ${collection} ${parentId}`;
                const displayName = `${title} (${validPages} pages)`;
                
                return {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'mdc_catalonia',
                    displayName: displayName,
                    originalUrl: originalUrl,
                };
                
            } catch (error: any) {
                console.error('❌ MDC Catalonia extraction failed:', error);
                throw new Error(`Failed to load MDC Catalonia manuscript: ${(error as Error).message}`);
            }
        }
}