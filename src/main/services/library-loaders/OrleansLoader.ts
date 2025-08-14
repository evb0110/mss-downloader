import { BaseLibraryLoader, type LoaderDependencies } from './types';
import type { ManuscriptManifest } from '../../../shared/types';

export class OrleansLoader extends BaseLibraryLoader {
    constructor(deps: LoaderDependencies) {
        super(deps);
    }
    
    getLibraryName(): string {
        return 'orleans';
    }
    
    async loadManifest(orleansUrl: string, progressCallback?: (current: number, total: number, message?: string) => void): Promise<ManuscriptManifest> {
            console.log(`Starting Orleans manifest loading for: ${orleansUrl}`);
            
            try {
                // Handle different types of URLs:
                // 1. Media notice pages: https://mediatheques.orleans.fr/recherche/viewnotice/clef/.../id/745380
                // 2. Direct Aurelia URLs: https://aurelia.orleans.fr/s/aurelia/item/257012
                
                let itemId: string;
                const baseApiUrl = 'https://aurelia.orleans.fr/api';
                
                if (orleansUrl.includes('mediatheques.orleans.fr')) {
                    // For media notice pages, search by title since ID mapping is complex
                    let searchQuery = '';
                    
                    if (orleansUrl.includes('FRAGMENTSDEDIFFERENTSLIVRESDELECRITURESAINTE')) {
                        // Direct search for the Augustine manuscript
                        searchQuery = 'Fragments de différents livres de l\'Écriture sainte';
                    } else if (orleansUrl.includes('OUVRAGESDEPSEUDOISIDORE--PSEUDOISIDORE')) {
                        // Direct search for the Pseudo Isidore manuscript
                        searchQuery = 'Ouvrages de Pseudo Isidore';
                    } else {
                        // Try to extract and search for other manuscripts
                        const titleMatch = orleansUrl.match(/clef\/([^/]+)/);
                        if (titleMatch) {
                            const encodedTitle = titleMatch[1];
                            // Handle common Orleans URL patterns
                            let decodedTitle = decodeURIComponent(encodedTitle?.replace(/--/g, ' ') || '');
                            
                            // Apply transformations for common patterns
                            decodedTitle = decodedTitle
                                .replace(/([A-Z]+)DE([A-Z]+)/g, '$1 de $2') // Add "de" between uppercase words
                                .replace(/([A-Z])([A-Z]+)/g, (_match, first, rest) => first + rest.toLowerCase()) // Convert to proper case
                                .replace(/\s+/g, ' ') // Normalize spaces
                                .trim();
                            
                            searchQuery = decodedTitle;
                        } else {
                            throw new Error('Could not extract manuscript title from URL for search');
                        }
                    }
                    
                    // Try multiple search strategies for better results
                    let searchResults: Record<string, unknown>[] = [];
                    const searchStrategies = [
                        searchQuery, // Original full query
                        searchQuery.split(' ').slice(0, 2).join(' '), // First two words
                        searchQuery.split(' ')[0], // First word only
                        searchQuery.toLowerCase(), // Lowercase version
                        searchQuery.toLowerCase().split(' ').slice(0, 2).join(' '), // Lowercase first two words
                        searchQuery.toLowerCase().split(' ')[0], // Lowercase first word
                        // Extract partial terms for complex titles
                        ...searchQuery.toLowerCase().split(' ').filter(word => word?.length > 4) // Words longer than 4 chars
                    ];
                    
                    for (let i = 0; i < searchStrategies?.length && searchResults?.length === 0; i++) {
                        const currentQuery = searchStrategies[i];
                        console.log(`Searching Orleans API (attempt ${i + 1}/${searchStrategies?.length}) for: "${currentQuery}"`);
                        const searchUrl = `${baseApiUrl}/items?search=${encodeURIComponent(currentQuery || '')}`;
                        
                        try {
                            // Use fetchDirect with extended Orleans timeout
                            const searchResponse = await this.deps.fetchDirect(searchUrl);
                            
                            if (!searchResponse.ok) {
                                console.warn(`Orleans search attempt ${i + 1} failed: HTTP ${searchResponse.status}`);
                                continue;
                            }
                            
                            const results = await searchResponse.json();
                            if (Array.isArray(results) && results?.length > 0) {
                                searchResults = results;
                                console.log(`Orleans search attempt ${i + 1} returned ${results?.length} results`);
                                break;
                            }
                        } catch (error: any) {
                            console.warn(`Orleans search attempt ${i + 1} failed:`, (error as Error).message);
                            if (i === searchStrategies?.length - 1) {
                                throw error; // Re-throw on final attempt
                            }
                        }
                    }
                    
                    if (!Array.isArray(searchResults) || searchResults?.length === 0) {
                        throw new Error(`Manuscript not found in Orleans search results using any search strategy. Tried: ${searchStrategies.join(', ')}`);
                    }
                    
                    itemId = searchResults[0]?.['o:id']?.toString() || searchResults[0]?.['o_id']?.toString() || '';
                    if (!itemId) {
                        throw new Error('Could not extract item ID from Orleans search results');
                    }
                    
                    console.log(`Found Orleans manuscript with ID: ${itemId}`);
                } else if (orleansUrl.includes('aurelia.orleans.fr')) {
                    // Direct Aurelia URL - extract item ID
                    const itemMatch = orleansUrl.match(/\/item\/(\d+)/);
                    if (!itemMatch) {
                        throw new Error('Invalid Aurelia URL format - could not extract item ID');
                    }
                    itemId = itemMatch[1] || '';
                } else {
                    throw new Error('Unsupported Orléans URL format');
                }
                
                // Fetch the item metadata with retry logic
                console.log(`Fetching Orleans item metadata for ID: ${itemId}`);
                const itemUrl = `${baseApiUrl}/items/${itemId}`;
                
                let itemData;
                let retryCount = 0;
                const maxRetries = 3;
                
                while (retryCount < maxRetries) {
                    try {
                        // Use fetchDirect with extended Orleans timeout instead of manual timeout
                        const itemResponse = await this.deps.fetchDirect(itemUrl);
                        
                        if (!itemResponse.ok) {
                            throw new Error(`Failed to fetch Orléans item: HTTP ${itemResponse.status}`);
                        }
                        
                        itemData = await itemResponse.json();
                        break;
                    } catch (error: any) {
                        retryCount++;
                        console.warn(`Orleans item fetch attempt ${retryCount}/${maxRetries} failed:`, (error as Error).message);
                        
                        if (retryCount >= maxRetries) {
                            throw new Error(`Failed to fetch Orleans item after ${maxRetries} attempts: ${(error as Error).message}`);
                        }
                        
                        // Wait before retry
                        await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
                    }
                }
                console.log(`Successfully fetched Orleans item data`);
                
                // Extract media items from the Omeka item
                const mediaItems = itemData['o:media'] || itemData.o_media || [];
                
                if (!Array.isArray(mediaItems) || mediaItems?.length === 0) {
                    throw new Error('No media items found in Orléans manuscript');
                }
                
                // Process media items to get IIIF URLs
                const pageLinks: string[] = [];
                console.log(`Processing ${mediaItems?.length} media items for Orleans manuscript`);
                
                // Report initial progress
                progressCallback?.(0, mediaItems?.length, `Loading manifest: 0/${mediaItems?.length} pages`);
                
                // Process media items with batch processing and circuit breaker to prevent hanging
                let processedCount = 0;
                const batchSize = 4; // Smaller batches for Orleans to reduce API load
                const maxFailedBatches = 5; // Allow more failed batches before giving up
                const maxTotalFailures = Math.floor(mediaItems?.length * 0.3); // Allow 30% failures max
                
                let failedBatchCount = 0;
                let totalFailures = 0;
                let lastProgressUpdate = Date.now();
                
                // For very large manuscripts (>200 pages), limit to first 200 pages to prevent hanging
                const maxPagesToProcess = Math.min(mediaItems?.length, 200);
                if (mediaItems?.length > 200) {
                    console.log(`Orleans manuscript has ${mediaItems?.length} pages, limiting to first ${maxPagesToProcess} pages for stability`);
                    progressCallback?.(0, maxPagesToProcess, `Loading manifest (limited): 0/${maxPagesToProcess} pages`);
                }
                
                const itemsToProcess = mediaItems.slice(0, maxPagesToProcess);
                
                // Process items in batches with circuit breaker
                for (let batchStart = 0; batchStart < itemsToProcess?.length; batchStart += batchSize) {
                    const batchEnd = Math.min(batchStart + batchSize, itemsToProcess?.length);
                    const batch = itemsToProcess.slice(batchStart, batchEnd);
                    
                    console.log(`Orleans: processing batch ${Math.floor(batchStart / batchSize) + 1} (items ${batchStart + 1}-${batchEnd})`);
                    
                    // Process batch with Promise.allSettled for parallel processing
                    const batchPromises = batch.map(async (mediaRef, batchIdx) => {
                        const idx = batchStart + batchIdx;
                        const mediaId = mediaRef['o:id'] || mediaRef.o_id || 
                                       (typeof mediaRef === 'object' && mediaRef['@id'] ? 
                                        mediaRef['@id'].split('/').pop() : mediaRef);
                        
                        if (!mediaId) {
                            throw new Error(`No media ID found for media item ${idx}`);
                        }
                        
                        const mediaUrl = `${baseApiUrl}/media/${mediaId}`;
                        
                        try {
                            const mediaResponse = await this.deps.fetchDirect(mediaUrl);
                            
                            if (!mediaResponse.ok) {
                                throw new Error(`HTTP ${mediaResponse.status}`);
                            }
                            
                            const mediaData = await mediaResponse.json();
                            
                            // Orleans uses files/large/{hash}.jpg pattern - extract from thumbnail_display_urls or construct from filename
                            const thumbnails = mediaData.thumbnail_display_urls || mediaData['thumbnail_display_urls'];
                            
                            if (thumbnails && thumbnails.large) {
                                // Use the direct large thumbnail URL (preferred method)
                                return { idx, imageUrl: thumbnails.large, mediaId };
                            } else {
                                // Fallback: construct URL from o:filename hash
                                const filename = mediaData['o:filename'] || mediaData.o_filename;
                                if (filename && typeof filename === 'string') {
                                    const imageUrl = `https://aurelia.orleans.fr/files/large/${filename}.jpg`;
                                    return { idx, imageUrl, mediaId };
                                }
                            }
                            
                            throw new Error('No valid image URL found');
                            
                        } catch (fetchError: unknown) {
                            if ((fetchError as Error).name === 'AbortError') {
                                throw new Error(`Request timed out for media ${mediaId}`);
                            }
                            throw fetchError;
                        }
                    });
                    
                    // Execute batch with timeout
                    const batchResults = await Promise.allSettled(batchPromises);
                    
                    // Process results and count failures
                    let batchFailures = 0;
                    
                    for (const result of batchResults) {
                        if (result.status === 'fulfilled') {
                            const { idx, imageUrl } = result.value;
                            pageLinks[idx] = imageUrl;
                            processedCount++;
                        } else {
                            batchFailures++;
                            totalFailures++;
                            console.warn(`Orleans batch processing error:`, result.reason?.message || result.reason);
                        }
                    }
                    
                    // Circuit breaker logic
                    if (batchFailures === batch?.length) {
                        failedBatchCount++;
                        console.warn(`Orleans: entire batch failed (${failedBatchCount}/${maxFailedBatches} consecutive failures)`);
                        
                        if (failedBatchCount >= maxFailedBatches) {
                            throw new Error(`Orleans API appears to be blocked - ${maxFailedBatches} consecutive batch failures. Processed ${processedCount}/${itemsToProcess?.length} pages.`);
                        }
                    } else {
                        failedBatchCount = 0; // Reset consecutive failure count on any success
                    }
                    
                    // Check total failure threshold
                    if (totalFailures > maxTotalFailures) {
                        throw new Error(`Too many Orleans API failures (${totalFailures}/${itemsToProcess?.length}). Server may be rate limiting. Processed ${processedCount} pages.`);
                    }
                    
                    // Progress reporting and stall detection
                    const now = Date.now();
                    const shouldReport = processedCount % 10 === 0 || batchEnd >= itemsToProcess?.length;
                    
                    if (shouldReport) {
                        const progressMessage = itemsToProcess?.length < mediaItems?.length 
                            ? `Loading manifest (limited): ${processedCount}/${itemsToProcess?.length} pages`
                            : `Loading manifest: ${processedCount}/${itemsToProcess?.length} pages`;
                        
                        console.log(`Orleans: processed ${processedCount}/${itemsToProcess?.length} media items (${totalFailures} failures)`);
                        progressCallback?.(processedCount, itemsToProcess?.length, progressMessage);
                        lastProgressUpdate = now;
                    }
                    
                    // Check for stalled progress (no progress for >5 minutes)
                    if (now - lastProgressUpdate > 300000) {
                        throw new Error(`Orleans manifest loading stalled - no progress for 5 minutes. Processed ${processedCount}/${itemsToProcess?.length} pages.`);
                    }
                    
                    // Add longer delay between batches to be respectful to the server
                    if (batchEnd < itemsToProcess?.length) {
                        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay between batches
                    }
                }
                
                // Report final progress
                const finalMessage = itemsToProcess?.length < mediaItems?.length 
                    ? `Manifest loaded (limited): ${processedCount} pages` 
                    : `Manifest loaded: ${processedCount} pages`;
                progressCallback?.(processedCount, itemsToProcess?.length, finalMessage);
                
                // Preserve page order by keeping original positions, only filter out sparse array gaps
                const validPageLinks: string[] = [];
                let validPageCount = 0;
                
                // Process pageLinks array in order, maintaining sequence
                for (let i = 0; i < pageLinks?.length; i++) {
                    const pageUrl = pageLinks[i];
                    if (pageUrl && typeof pageUrl === 'string') {
                        validPageLinks.push(pageUrl);
                        validPageCount++;
                    } else if (pageLinks[i] === undefined && i < itemsToProcess?.length) {
                        // For failed pages within the expected range, log warning but don't break sequence
                        console.warn(`Orleans: Page ${i + 1} failed to load, skipping in sequence`);
                    }
                }
                
                console.log(`Successfully processed ${validPageCount} page links for Orleans manuscript (maintained original order)`);
                
                if (validPageLinks?.length === 0) {
                    throw new Error('No valid image URLs found in Orléans manuscript');
                }
                
                // Ensure we have a reasonable number of pages (more lenient threshold)
                const minExpectedPages = Math.min(3, itemsToProcess?.length * 0.05); // Only require 5% minimum
                if (validPageLinks?.length < minExpectedPages) {
                    console.warn(`Only ${validPageLinks?.length}/${itemsToProcess?.length} Orleans media items processed successfully`);
                    
                    // If we have very few pages, it might be worth throwing an error
                    if (validPageLinks?.length < 2) {
                        throw new Error(`Insufficient Orleans pages loaded: only ${validPageLinks?.length} pages out of ${itemsToProcess?.length} total`);
                    }
                }
                
                // Log summary of processing
                if (itemsToProcess?.length < mediaItems?.length) {
                    console.log(`Orleans: Successfully processed ${validPageLinks?.length} pages (limited from ${mediaItems?.length} total pages for stability)`);
                } else {
                    console.log(`Orleans: Successfully processed ${validPageLinks?.length}/${mediaItems?.length} pages`);
                }
                
                // Extract display name from item metadata
                let displayName = 'Orleans_Manuscript';
                
                if (itemData['dcterms:title'] || itemData['dcterms_title']) {
                    const titleProperty = itemData['dcterms:title'] || itemData['dcterms_title'];
                    if (Array.isArray(titleProperty) && titleProperty?.length > 0) {
                        displayName = titleProperty[0]['@value'] || titleProperty[0].value || titleProperty[0];
                    } else if (typeof titleProperty === 'string') {
                        displayName = titleProperty;
                    }
                } else if (itemData['o:title'] || itemData.o_title) {
                    displayName = itemData['o:title'] || itemData.o_title;
                }
                
                // Sanitize display name for filesystem
                displayName = displayName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').substring(0, 100);
                
                return {
                    pageLinks: validPageLinks,
                    totalPages: validPageLinks?.length,
                    displayName: displayName,
                    library: 'orleans',
                    originalUrl: orleansUrl,
                };
                
            } catch (error: any) {
                console.error(`Orleans manifest loading failed:`, error);
                throw new Error(`Failed to load Orléans manuscript: ${(error as Error).message}`);
            }
        }
}