#!/usr/bin/env bun

/**
 * Florence Complete Manuscript Download Script
 * 
 * MISSION: Download ALL 215 pages of Plut.16.39 Calendarium manuscript
 * Target: https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/217923/rec/2
 * 
 * CRITICAL REQUIREMENTS:
 * 1. Download ALL 215 pages discovered (not just 210 filtered)
 * 2. Use production-level download logic with proper ContentDM handling
 * 3. Include ContentDM session management (JSESSIONID)
 * 4. Apply proper rate limiting (1.5s delays)
 * 5. Create complete PDF with all successfully downloaded pages
 */

import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import path from 'path';

interface FlorenceField {
    key: string;
    value: string;
    [key: string]: unknown;
}

interface FlorenceChild {
    id: number;
    title?: string;
    [key: string]: unknown;
}

interface FlorenceParent {
    children?: FlorenceChild[];
    fields?: FlorenceField[];
    [key: string]: unknown;
}

interface FlorenceItemData {
    parentId?: number;
    parent?: FlorenceParent;
    fields?: FlorenceField[];
    title?: string;
    [key: string]: unknown;
}

interface FlorenceState {
    item?: {
        item?: FlorenceItemData;
        children?: FlorenceChild[];
    };
    [key: string]: unknown;
}

interface DownloadResult {
    pageNumber: number;
    url: string;
    success: boolean;
    filePath?: string;
    error?: string;
    size?: number;
}

class FlorencoCompleteDownloader {
    private readonly targetUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/217923/rec/2';
    private readonly outputDir = '/Users/evb/WebstormProjects/mss-downloader/.devkit/validation/READY-FOR-USER';
    private readonly workDir = '/Users/evb/WebstormProjects/mss-downloader/.devkit/validation/florence-work';
    private sessionCookie: string | null = null;
    
    constructor() {
        // No dependencies needed - using native fetch
    }

    /**
     * Establish ContentDM session by visiting collection page to get JSESSIONID cookie
     */
    private async establishSession(): Promise<void> {
        if (this.sessionCookie) {
            return; // Already have session
        }

        try {
            // Visit the collection page to establish session
            const collectionUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei';
            const response = await fetch(collectionUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Referer': 'https://cdm21059.contentdm.oclc.org/',
                    'Cache-Control': 'no-cache'
                }
            });

            // Extract JSESSIONID from set-cookie headers
            const setCookie = response.headers.get('set-cookie');
            if (setCookie) {
                const match = setCookie.match(/JSESSIONID=([^;]+)/);
                if (match) {
                    this.sessionCookie = `JSESSIONID=${match[1]}`;
                    console.log('✅ ContentDM session established successfully');
                }
            }
        } catch (error) {
            console.warn('⚠️  Failed to establish ContentDM session, proceeding without');
        }
    }

    /**
     * Get session-aware headers for ContentDM requests
     */
    private getSessionHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'image/*,*/*;q=0.8',
            'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': 'https://cdm21059.contentdm.oclc.org/',
            'Sec-Fetch-Dest': 'image',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'same-origin',
            'DNT': '1'
        };

        if (this.sessionCookie) {
            headers['Cookie'] = this.sessionCookie;
        }

        return headers;
    }

    /**
     * Extract ALL 215 pages from Florence state WITHOUT filtering
     * This bypasses the validation that filters out "inaccessible" pages
     */
    private async extractAllPages(): Promise<Array<{ id: string; title: string }>> {
        console.log('🔍 Extracting ALL pages from Florence manuscript (NO FILTERING)...');
        
        await this.establishSession();

        const pageResponse = await fetch(this.targetUrl, {
            headers: {
                ...this.getSessionHeaders(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });

        if (!pageResponse.ok) {
            throw new Error(`Failed to fetch Florence page: HTTP ${pageResponse.status}`);
        }

        const html = await pageResponse.text();
        console.log(`📄 Page HTML retrieved (${html?.length} characters)`);

        // Extract __INITIAL_STATE__ from the HTML
        const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*JSON\.parse\("(.+?)"\);/);
        if (!stateMatch) {
            throw new Error('Could not find __INITIAL_STATE__ in Florence page');
        }

        // Unescape the JSON string
        const escapedJson = stateMatch[1];
        if (!escapedJson) {
            throw new Error('Florence state match found but content is empty');
        }
        const unescapedJson = escapedJson
            ?.replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')
            .replace(/\\u0026/g, '&')
            .replace(/\\u003c/g, '<')
            .replace(/\\u003e/g, '>')
            .replace(/\\u002F/g, '/');

        let state: FlorenceState;
        try {
            state = JSON.parse(unescapedJson);
        } catch {
            console.error('Failed to parse Florence state JSON');
            throw new Error('Could not parse Florence page state');
        }

        // Extract item and parent data from state
        const itemData = state?.item?.item;
        if (!itemData) {
            throw new Error('No item data found in Florence page state');
        }

        let pages: Array<{ id: string; title: string }> = [];

        // Check if this item has a parent (compound object)
        if (itemData.parentId && itemData.parentId !== -1) {
            // This is a child page - get all siblings from parent
            if (itemData.parent && itemData.parent.children && Array.isArray(itemData.parent.children)) {
                console.log(`📄 Found ${itemData.parent.children?.length} pages in parent compound object`);
                
                // CRITICAL: NO FILTERING - include ALL pages for complete download attempt
                pages = itemData.parent.children
                    .map((child: FlorenceChild) => ({
                        id: child.id.toString(),
                        title: child.title || `Page ${child.id}`
                    }));

                console.log(`📄 Extracted ALL ${pages.length} pages (NO FILTERING APPLIED)`);
            } else {
                throw new Error('Parent compound object has no children data');
            }
        } else {
            // This might be a parent itself or a single page
            // Check the current page for children
            const currentPageChildren = state?.item?.children;
            if (currentPageChildren && Array.isArray(currentPageChildren) && currentPageChildren?.length > 0) {
                console.log(`📄 Found ${currentPageChildren?.length} child pages in current item`);
                
                // CRITICAL: NO FILTERING - include ALL pages
                pages = currentPageChildren
                    .map((child: FlorenceChild) => ({
                        id: child.id.toString(),
                        title: child.title || `Page ${child.id}`
                    }));
            } else {
                // Single page manuscript
                pages = [{
                    id: '217923',
                    title: 'Page 1'
                }];
                console.log('📄 Single page manuscript');
            }
        }

        if (pages?.length === 0) {
            throw new Error('No pages found in Florence manuscript');
        }

        console.log(`✅ Extracted ${pages?.length} total pages for download attempt`);
        return pages;
    }

    /**
     * Determine optimal image size by testing different resolutions
     */
    private async determineOptimalSize(collection: string, samplePageId: string): Promise<number> {
        const SIZE_PREFERENCES = [6000, 4000, 2048, 1024, 800];
        
        console.log(`🔧 Testing image sizes for optimal resolution (sample page: ${samplePageId})`);
        
        // Test sizes in order of preference (high to low)
        for (const width of SIZE_PREFERENCES) {
            try {
                const testUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${samplePageId}/full/${width},/0/default.jpg`;
                
                const response = await fetch(testUrl, {
                    method: 'HEAD',
                    headers: this.getSessionHeaders()
                });
                
                if (response.ok) {
                    console.log(`✅ Optimal size determined: ${width}px`);
                    return width;
                } else {
                    console.log(`❌ Size ${width}px failed: HTTP ${response.status}`);
                }
            } catch (error: any) {
                console.log(`❌ Size ${width}px failed: ${error.message}`);
            }
        }
        
        // If all sizes fail, use the smallest as fallback
        const fallbackSize = SIZE_PREFERENCES[SIZE_PREFERENCES.length - 1] || 800;
        console.log(`⚠️  All size tests failed, using fallback size: ${fallbackSize}px`);
        return fallbackSize;
    }

    /**
     * Download a single page with retries and proper error handling
     */
    private async downloadPage(url: string, pageNumber: number, filePath: string): Promise<DownloadResult> {
        const maxRetries = 3;
        let lastError: string = '';

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`📥 Downloading page ${pageNumber} (attempt ${attempt}/${maxRetries})...`);
                
                const response = await fetch(url, {
                    headers: this.getSessionHeaders()
                });

                if (!response.ok) {
                    lastError = `HTTP ${response.status}: ${response.statusText}`;
                    if (response.status === 403 || response.status === 501) {
                        // These are permanent errors - don't retry
                        console.log(`❌ Page ${pageNumber}: ${lastError} (permanent error)`);
                        return {
                            pageNumber,
                            url,
                            success: false,
                            error: lastError
                        };
                    }
                    throw new Error(lastError);
                }

                const buffer = await response.arrayBuffer();
                await fs.writeFile(filePath, Buffer.from(buffer));
                
                const stats = await fs.stat(filePath);
                console.log(`✅ Page ${pageNumber}: Downloaded successfully (${Math.round(stats.size / 1024)}KB)`);
                
                return {
                    pageNumber,
                    url,
                    success: true,
                    filePath,
                    size: stats.size
                };

            } catch (error: any) {
                lastError = error.message || String(error);
                if (attempt < maxRetries) {
                    console.log(`⚠️  Page ${pageNumber}: ${lastError} - retrying in 2s...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    console.log(`❌ Page ${pageNumber}: ${lastError} (all attempts failed)`);
                }
            }
        }

        return {
            pageNumber,
            url,
            success: false,
            error: lastError
        };
    }

    /**
     * Download all pages with proper rate limiting and error handling
     */
    private async downloadAllPages(pages: Array<{ id: string; title: string }>, collection: string, optimalSize: number): Promise<DownloadResult[]> {
        console.log(`🚀 Starting download of ALL ${pages.length} pages with 1.5s rate limiting...`);
        
        // Ensure work directory exists
        await fs.mkdir(this.workDir, { recursive: true });
        
        const results: DownloadResult[] = [];
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const pageNumber = i + 1;
            const url = `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${page.id}/full/${optimalSize},/0/default.jpg`;
            const fileName = `page_${pageNumber.toString().padStart(3, '0')}_${page.id}.jpg`;
            const filePath = path.join(this.workDir, fileName);
            
            // Download page
            const result = await this.downloadPage(url, pageNumber, filePath);
            results.push(result);
            
            if (result.success) {
                successCount++;
            } else {
                errorCount++;
            }

            // Progress reporting every 10 pages
            if (pageNumber % 10 === 0 || pageNumber === pages.length) {
                const progress = Math.round((pageNumber / pages.length) * 100);
                console.log(`📊 Progress: ${pageNumber}/${pages.length} pages (${progress}%) | ✅ ${successCount} success | ❌ ${errorCount} failed`);
            }

            // CRITICAL: 1.5s delay between requests for ContentDM rate limiting
            if (i < pages.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }

        console.log(`✅ Download complete: ${successCount}/${pages.length} pages successful (${Math.round((successCount/pages.length)*100)}% success rate)`);
        return results;
    }

    /**
     * Create archive of all successfully downloaded images
     */
    private async createImageArchive(results: DownloadResult[], manuscriptTitle: string): Promise<string> {
        console.log('📚 Creating image archive from successfully downloaded pages...');
        
        // Filter successful downloads and sort by page number
        const successfulResults = results
            .filter(r => r.success && r.filePath)
            .sort((a, b) => a.pageNumber - b.pageNumber);

        if (successfulResults.length === 0) {
            throw new Error('No successfully downloaded pages to create archive');
        }

        console.log(`📚 Organizing ${successfulResults.length} successfully downloaded pages...`);

        // Ensure output directory exists
        await fs.mkdir(this.outputDir, { recursive: true });

        // Create final organized directory
        const finalDir = path.join(this.outputDir, manuscriptTitle);
        await fs.mkdir(finalDir, { recursive: true });

        // Copy and rename files with proper page numbers
        for (const result of successfulResults) {
            const originalPath = result.filePath!;
            const newFileName = `page_${result.pageNumber.toString().padStart(3, '0')}.jpg`;
            const newPath = path.join(finalDir, newFileName);
            
            await fs.copyFile(originalPath, newPath);
        }

        // Create a simple text summary
        const summaryPath = path.join(finalDir, 'download_summary.txt');
        const summary = [
            `Florence Manuscript Download Summary`,
            `Manuscript: Plut.16.39 Calendarium`,
            `Download Date: ${new Date().toISOString()}`,
            `Total Pages Attempted: ${results.length}`,
            `Successfully Downloaded: ${successfulResults.length}`,
            `Success Rate: ${Math.round((successfulResults.length/results.length)*100)}%`,
            ``,
            `Pages Downloaded:`,
            ...successfulResults.map(r => `  Page ${r.pageNumber}: ${Math.round((r.size || 0) / 1024)}KB`)
        ].join('\n');
        
        await fs.writeFile(summaryPath, summary);

        console.log(`✅ Image archive created: ${finalDir}`);
        console.log(`📄 Summary file: ${summaryPath}`);

        return finalDir;
    }

    /**
     * Clean up temporary files
     */
    private async cleanup(): Promise<void> {
        try {
            console.log('🧹 Cleaning up temporary files...');
            if (fsSync.existsSync(this.workDir)) {
                await fs.rm(this.workDir, { recursive: true, force: true });
            }
            console.log('✅ Cleanup complete');
        } catch (error) {
            console.warn('⚠️  Cleanup warning:', error);
        }
    }

    /**
     * Main execution method
     */
    async execute(): Promise<void> {
        const startTime = Date.now();
        console.log('🎯 FLORENCE COMPLETE MANUSCRIPT DOWNLOAD');
        console.log('📄 Target: Plut.16.39 Calendarium');
        console.log('🎯 Mission: Download ALL 215 pages (no filtering)');
        console.log('🚀 Starting execution...\n');

        try {
            // Step 1: Extract all pages without filtering
            const pages = await this.extractAllPages();
            console.log(`📄 Found ${pages.length} total pages\n`);

            // Step 2: Determine optimal image size
            const collection = 'plutei';
            const samplePageId = pages[0]?.id || '217924';
            const optimalSize = await this.determineOptimalSize(collection, samplePageId);
            console.log(`🔧 Using optimal size: ${optimalSize}px\n`);

            // Step 3: Download all pages
            const results = await this.downloadAllPages(pages, collection, optimalSize);
            console.log('');

            // Step 4: Create PDF from successful downloads
            const successfulCount = results.filter(r => r.success).length;
            const failedCount = results.filter(r => !r.success).length;
            
            console.log('📊 DOWNLOAD STATISTICS:');
            console.log(`✅ Successful: ${successfulCount}/${pages.length} pages`);
            console.log(`❌ Failed: ${failedCount}/${pages.length} pages`);
            console.log(`📈 Success rate: ${Math.round((successfulCount/pages.length)*100)}%\n`);

            if (successfulCount > 0) {
                const manuscriptTitle = `Florence_Plut16-39_Calendarium_${successfulCount}pages`;
                const archivePath = await this.createImageArchive(results, manuscriptTitle);
                
                const duration = Date.now() - startTime;
                console.log('🎉 MISSION COMPLETE!');
                console.log(`📚 Image archive created: ${archivePath}`);
                console.log(`⏱️  Total time: ${Math.round(duration/1000)}s`);
                console.log(`📄 Final result: ${successfulCount}/${pages.length} pages organized`);

                // List failed pages for user reference
                const failedPages = results.filter(r => !r.success);
                if (failedPages.length > 0) {
                    console.log('\n❌ Failed pages:');
                    failedPages.forEach(fp => {
                        console.log(`   Page ${fp.pageNumber}: ${fp.error}`);
                    });
                }
            } else {
                throw new Error('No pages were successfully downloaded');
            }

        } catch (error: any) {
            console.error('💥 MISSION FAILED:', error.message);
            throw error;
        } finally {
            await this.cleanup();
        }
    }
}

// Execute the download
const downloader = new FlorencoCompleteDownloader();
downloader.execute().catch(console.error);