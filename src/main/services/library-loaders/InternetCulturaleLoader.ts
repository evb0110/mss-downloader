import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class InternetCulturaleLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'internetculturale';
    }
    
    async loadManifest(internetCulturaleUrl: string): Promise<ManuscriptManifest> {
            try {
                // Extract OAI identifier from URL
                const oaiMatch = internetCulturaleUrl.match(/id=([^&]+)/);
                if (!oaiMatch) {
                    throw new Error('Invalid Internet Culturale URL: missing OAI identifier');
                }
                
                const oaiId = decodeURIComponent(oaiMatch[1]);
                console.log(`Loading Internet Culturale manuscript with OAI ID: ${oaiId}`);
                
                // Extract teca parameter for institution info
                const tecaMatch = internetCulturaleUrl.match(/teca=([^&]+)/);
                const teca = tecaMatch ? decodeURIComponent(tecaMatch[1]) : 'Unknown';
                
                // CRITICAL FIX: Establish session first by visiting main page
                console.log('Establishing Internet Culturale session...');
                const sessionHeaders = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
                    'Cache-Control': 'max-age=0'
                };
                
                // Visit main page to establish session and get cookies
                await this.deps.fetchDirect(internetCulturaleUrl, { headers: sessionHeaders });
                
                // Construct API URL for manifest data with all required parameters
                const apiUrl = `https://www.internetculturale.it/jmms/magparser?id=${encodeURIComponent(oaiId)}&teca=${encodeURIComponent(teca)}&mode=all&fulltext=0`;
                
                // Set headers similar to browser request
                const headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/xml, application/xml, */*; q=0.01',
                    'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
                    'Referer': internetCulturaleUrl,
                    'X-Requested-With': 'XMLHttpRequest',
                };
                
                console.log(`Fetching Internet Culturale API: ${apiUrl}`);
                
                // Fetch manifest data from API
                const response = await this.deps.fetchDirect(apiUrl, { headers });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                const xmlText = await response.text();
                
                if (!xmlText || xmlText.trim().length === 0) {
                    throw new Error('Empty response from API');
                }
                
                // Parse XML response
                console.log('Parsing Internet Culturale XML manifest...');
                
                // Extract title from bibinfo section
                let displayName = 'Internet Culturale Manuscript';
                const titleMatch = xmlText.match(/<info key="Titolo">\s*<value>(.*?)<\/value>/);
                if (titleMatch) {
                    displayName = titleMatch[1].trim();
                } else {
                    // Fallback: extract from OAI ID
                    const parts = oaiId.split(':');
                    if (parts.length > 0) {
                        displayName = parts[parts.length - 1].replace(/%/g, ' ').trim();
                    }
                }
                
                // Extract page URLs from XML with enhanced parsing and duplicate detection
                const pageLinks: string[] = [];
                
                // Try multiple regex patterns for different XML structures
                const pageRegexPatterns = [
                    /<page[^>]+src="([^"]+)"[^>]*>/g,
                    /<page[^>]*>([^<]+)<\/page>/g,
                    /src="([^"]*cacheman[^"]*\.jpg)"/g,
                    /url="([^"]*cacheman[^"]*\.jpg)"/g,
                    /"([^"]*cacheman[^"]*\.jpg)"/g
                ];
                
                console.log(`[Internet Culturale] XML response length: ${xmlText.length} characters`);
                console.log(`[Internet Culturale] XML preview: ${xmlText.substring(0, 500)}...`);
                
                let foundPages = false;
                for (const pageRegex of pageRegexPatterns) {
                    let match;
                    const tempLinks: string[] = [];
                    
                    while ((match = pageRegex.exec(xmlText)) !== null) {
                        let relativePath = match[1];
                        
                        // Skip non-image URLs
                        if (!relativePath.includes('.jpg') && !relativePath.includes('.jpeg')) {
                            continue;
                        }
                        
                        // Optimize Internet Culturale resolution: use 'normal' for highest quality images
                        if (relativePath.includes('cacheman/web/')) {
                            relativePath = relativePath.replace('cacheman/web/', 'cacheman/normal/');
                        }
                        
                        // Ensure absolute URL
                        const imageUrl = relativePath.startsWith('http') 
                            ? relativePath 
                            : `https://www.internetculturale.it/jmms/${relativePath}`;
                        
                        tempLinks.push(imageUrl);
                    }
                    
                    if (tempLinks.length > 0) {
                        pageLinks.push(...tempLinks);
                        foundPages = true;
                        console.log(`[Internet Culturale] Found ${tempLinks.length} pages using regex pattern ${pageRegex.source}`);
                        break;
                    }
                }
                
                if (!foundPages) {
                    console.error('[Internet Culturale] No pages found with any regex pattern');
                    console.log('[Internet Culturale] Full XML response:', xmlText);
                    throw new Error('No image URLs found in XML manifest');
                }
                
                // Detect and handle duplicate URLs (infinite loop prevention)
                const urlCounts = new Map();
                const uniquePageLinks: string[] = [];
                
                pageLinks.forEach((url, index) => {
                    const count = urlCounts.get(url) || 0;
                    urlCounts.set(url, count + 1);
                    
                    if (count === 0) {
                        uniquePageLinks.push(url);
                    } else {
                        console.warn(`[Internet Culturale] Duplicate URL detected for page ${index + 1}: ${url}`);
                    }
                });
                
                // If only one unique page found, attempt to generate additional pages
                if (uniquePageLinks.length === 1 && pageLinks.length > 1) {
                    console.warn(`[Internet Culturale] Only 1 unique page found but ${pageLinks.length} total pages expected`);
                    console.log('[Internet Culturale] Attempting to generate additional page URLs...');
                    
                    const baseUrl = uniquePageLinks[0];
                    const urlPattern = baseUrl.replace(/\/\d+\.jpg$/, '');
                    
                    // Generate URLs for pages 1-50 (reasonable limit)
                    const generatedLinks: string[] = [];
                    for (let i = 1; i <= Math.min(50, pageLinks.length); i++) {
                        const generatedUrl = `${urlPattern}/${i}.jpg`;
                        generatedLinks.push(generatedUrl);
                    }
                    
                    console.log(`[Internet Culturale] Generated ${generatedLinks.length} page URLs from pattern`);
                    pageLinks.length = 0; // Clear original array
                    pageLinks.push(...generatedLinks);
                } else {
                    // Use unique pages only
                    pageLinks.length = 0;
                    pageLinks.push(...uniquePageLinks);
                }
                
                console.log(`[Internet Culturale] Final page count: ${pageLinks.length} pages`);
                
                if (pageLinks.length === 0) {
                    throw new Error('No valid image URLs found after duplicate removal');
                }
                
                // Add institution info to display name
                if (teca && teca !== 'Unknown') {
                    displayName = `${displayName} (${teca})`;
                }
                
                // Sanitize display name for Windows file system
                const sanitizedName = displayName
                    .replace(/[<>:"/\\|?*]/g, '_')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .replace(/\.$/, ''); // Remove trailing period
                
                console.log(`Internet Culturale manifest loaded: ${pageLinks.length} pages`);
                
                return {
                    pageLinks,
                    totalPages: pageLinks.length,
                    library: 'internet_culturale' as any,
                    displayName: sanitizedName,
                    originalUrl: internetCulturaleUrl,
                };
                
            } catch (error: any) {
                console.error(`Internet Culturale manifest loading failed:`, error);
                throw new Error(`Failed to load Internet Culturale manuscript: ${(error as Error).message}`);
            }
        }
}