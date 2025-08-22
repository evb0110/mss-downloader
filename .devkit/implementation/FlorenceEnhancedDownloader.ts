#!/usr/bin/env bun

/**
 * Enhanced Florence ContentDM Download Logic with Per-Page Size Detection
 * 
 * Implements aggressive fallback strategies for ContentDM servers that have
 * per-page access restrictions beyond just global size limits.
 */

import https from 'https';
import http from 'http';

interface FlorenceEnhancedOptions {
    maxConcurrent?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    sessionTimeout?: number;
    retryLimit?: number;
    enablePerPageSizing?: boolean;
    enableGracefulDegradation?: boolean;
    minAcceptableSize?: number;
}

interface FlorenceDownloadResult {
    success: boolean;
    buffer?: Buffer;
    finalUrl?: string;
    sizeUsed?: number;
    attempts?: number;
    error?: string;
    statusCode?: number;
    responseTime?: number;
    pageId?: string;
}

interface FlorenceSession {
    agent: https.Agent;
    lastRequestTime: number;
    requestCount: number;
    consecutiveErrors: number;
    adaptiveDelayMs: number;
    pageSizeCache: Map<string, number>; // Per-page size cache
}

class FlorenceEnhancedDownloader {
    private readonly SIZE_CASCADE = [4000, 2048, 1024, 800, 600, 400, 300, 200]; // Very aggressive cascade
    private readonly sessions = new Map<string, FlorenceSession>();
    private readonly defaults: Required<FlorenceEnhancedOptions>;
    
    constructor(options: FlorenceEnhancedOptions = {}) {
        this.defaults = {
            maxConcurrent: 1, // Ultra-conservative
            baseDelayMs: 3000, // Longer base delay
            maxDelayMs: 20000, // Longer max delay
            sessionTimeout: 300000,
            retryLimit: 8,
            enablePerPageSizing: true, // Key feature
            enableGracefulDegradation: true,
            minAcceptableSize: 200, // Accept very small images if needed
            ...options
        };
    }

    private getSession(manuscriptId: string): FlorenceSession {
        const existing = this.sessions.get(manuscriptId);
        const now = Date.now();
        
        if (existing && (now - existing.lastRequestTime) < this.defaults.sessionTimeout) {
            return existing;
        }
        
        const session: FlorenceSession = {
            agent: new https.Agent({
                keepAlive: true,
                maxSockets: 1,
                maxFreeSockets: 1,
                timeout: 90000, // Longer timeout
                keepAliveMsecs: 60000
            }),
            lastRequestTime: now,
            requestCount: 0,
            consecutiveErrors: 0,
            adaptiveDelayMs: this.defaults.baseDelayMs,
            pageSizeCache: new Map()
        };
        
        this.sessions.set(manuscriptId, session);
        return session;
    }

    private async makeRequest(url: string, method: 'GET' | 'HEAD', session: FlorenceSession): Promise<{
        response: http.IncomingMessage;
        data?: Buffer;
    }> {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            
            const options: https.RequestOptions = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || 443,
                path: parsedUrl.pathname + parsedUrl.search,
                method,
                agent: session.agent,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': method === 'HEAD' ? 'image/*' : 'image/jpeg,image/png,image/*,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Referer': 'https://cdm21059.contentdm.oclc.org/',
                    'Origin': 'https://cdm21059.contentdm.oclc.org',
                    'Sec-Fetch-Dest': 'image',
                    'Sec-Fetch-Mode': 'no-cors',
                    'Sec-Fetch-Site': 'same-origin',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                },
                timeout: 90000
            };

            const req = https.request(options, (response) => {
                const chunks: Buffer[] = [];
                
                response.on('data', (chunk) => {
                    if (method === 'GET') {
                        chunks.push(chunk);
                    }
                });
                
                response.on('end', () => {
                    const data = method === 'GET' ? Buffer.concat(chunks) : undefined;
                    resolve({ response, data });
                });
                
                response.on('error', reject);
            });
            
            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.end();
        });
    }

    /**
     * Find the optimal size for a specific page with aggressive fallback
     */
    private async findPageOptimalSize(collection: string, pageId: string, session: FlorenceSession): Promise<{
        optimalSize: number;
        attempts: number;
        cacheHit: boolean;
    }> {
        // Check page-specific cache
        const cachedSize = session.pageSizeCache.get(pageId);
        if (cachedSize) {
            return {
                optimalSize: cachedSize,
                attempts: 0,
                cacheHit: true
            };
        }
        
        console.log(`🔍 [Florence Per-Page] Finding optimal size for page ${pageId}...`);
        
        let attempts = 0;
        
        // Try each size until we find one that works
        for (const size of this.SIZE_CASCADE) {
            attempts++;
            
            const url = `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${pageId}/full/${size},/0/default.jpg`;
            
            // Apply delay between attempts
            if (attempts > 1) {
                const delay = session.adaptiveDelayMs;
                console.log(`⏱️  [Florence Per-Page] Page ${pageId}: Waiting ${delay}ms before testing ${size}px...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            try {
                const { response } = await this.makeRequest(url, 'HEAD', session);
                session.requestCount++;
                session.lastRequestTime = Date.now();
                
                if (response.statusCode === 200) {
                    // Success! Cache this size for this page
                    session.pageSizeCache.set(pageId, size);
                    session.consecutiveErrors = 0;
                    
                    console.log(`✅ [Florence Per-Page] Page ${pageId}: Found working size ${size}px (attempt ${attempts})`);
                    
                    return {
                        optimalSize: size,
                        attempts,
                        cacheHit: false
                    };
                } else if (response.statusCode === 403) {
                    console.log(`🚫 [Florence Per-Page] Page ${pageId}: Size ${size}px forbidden, trying smaller...`);
                    session.consecutiveErrors++;
                    
                    // Increase delay for next attempt
                    session.adaptiveDelayMs = Math.min(
                        session.adaptiveDelayMs * 1.2,
                        this.defaults.maxDelayMs
                    );
                } else {
                    console.log(`⚠️  [Florence Per-Page] Page ${pageId}: Size ${size}px returned ${response.statusCode}, trying smaller...`);
                }
            } catch (error: any) {
                console.log(`❌ [Florence Per-Page] Page ${pageId}: Size ${size}px failed: ${error.message}`);
                session.consecutiveErrors++;
            }
        }
        
        // If all sizes fail, use the smallest as last resort
        const lastResortSize = this.defaults.minAcceptableSize;
        console.log(`⚠️  [Florence Per-Page] Page ${pageId}: All sizes failed, using last resort: ${lastResortSize}px`);
        
        return {
            optimalSize: lastResortSize,
            attempts,
            cacheHit: false
        };
    }

    /**
     * Download a single page with per-page size optimization
     */
    private async downloadPageWithOptimalSize(
        collection: string,
        pageId: string,
        pageIndex: number,
        totalPages: number,
        session: FlorenceSession,
        attempt = 1
    ): Promise<FlorenceDownloadResult> {
        const startTime = Date.now();
        
        try {
            // Step 1: Find optimal size for this specific page
            let optimalSize: number;
            let sizeAttempts: number;
            
            if (this.defaults.enablePerPageSizing) {
                const sizeResult = await this.findPageOptimalSize(collection, pageId, session);
                optimalSize = sizeResult.optimalSize;
                sizeAttempts = sizeResult.attempts;
                
                if (!sizeResult.cacheHit) {
                    console.log(`🎯 [Florence Enhanced] Page ${pageIndex + 1}/${totalPages} (${pageId}): Using ${optimalSize}px (${sizeAttempts} size tests)`);
                }
            } else {
                // Fallback to first working size from cascade
                optimalSize = this.SIZE_CASCADE[0];
                sizeAttempts = 0;
            }
            
            // Step 2: Download with the optimal size
            const url = `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${pageId}/full/${optimalSize},/0/default.jpg`;
            
            // Apply rate limiting
            const delay = session.adaptiveDelayMs + (Math.random() * 1000); // Add jitter
            if (session.requestCount > 0) {
                console.log(`⏱️  [Florence Enhanced] Page ${pageIndex + 1}/${totalPages}: Waiting ${Math.round(delay)}ms (attempt ${attempt})`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            const { response, data } = await this.makeRequest(url, 'GET', session);
            session.requestCount++;
            session.lastRequestTime = Date.now();
            
            const responseTime = Date.now() - startTime;
            
            if (response.statusCode === 200 && data && data.length > 0) {
                session.consecutiveErrors = 0;
                
                // Validate image data
                if (data.length < 512) {
                    throw new Error(`Image too small: ${data.length} bytes (likely error page)`);
                }
                
                // Check for JPEG signature
                if (data[0] !== 0xFF || data[1] !== 0xD8) {
                    throw new Error('Invalid JPEG signature (likely error page)');
                }
                
                console.log(`✅ [Florence Enhanced] Page ${pageIndex + 1}/${totalPages} (${pageId}): ${Math.round(data.length / 1024)}KB at ${optimalSize}px in ${responseTime}ms (attempt ${attempt})`);
                
                return {
                    success: true,
                    buffer: data,
                    finalUrl: url,
                    sizeUsed: optimalSize,
                    attempts: attempt,
                    responseTime,
                    pageId
                };
            } else {
                session.consecutiveErrors++;
                
                if (response.statusCode === 403) {
                    // 403 Forbidden - try even smaller size if enabled
                    if (this.defaults.enableGracefulDegradation && optimalSize > this.defaults.minAcceptableSize) {
                        console.log(`🚫 [Florence Enhanced] Page ${pageIndex + 1}/${totalPages}: 403 at ${optimalSize}px, invalidating cache and retrying with smaller size...`);
                        
                        // Remove this page from cache and try again with degraded size
                        session.pageSizeCache.delete(pageId);
                        
                        // Force a smaller size for this retry
                        const currentIndex = this.SIZE_CASCADE.indexOf(optimalSize);
                        if (currentIndex >= 0 && currentIndex < this.SIZE_CASCADE.length - 1) {
                            const smallerSize = this.SIZE_CASCADE[currentIndex + 1];
                            session.pageSizeCache.set(pageId, smallerSize);
                            console.log(`🔄 [Florence Enhanced] Page ${pageIndex + 1}/${totalPages}: Forcing degraded size ${smallerSize}px`);
                        }
                    }
                    
                    throw new Error(`403 Forbidden at ${optimalSize}px (attempt ${attempt})`);
                } else {
                    throw new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`);
                }
            }
        } catch (error: any) {
            session.consecutiveErrors++;
            const responseTime = Date.now() - startTime;
            
            console.log(`❌ [Florence Enhanced] Page ${pageIndex + 1}/${totalPages} (${pageId}) failed: ${error.message} (${responseTime}ms, attempt ${attempt})`);
            
            // Retry logic with exponential backoff
            if (attempt < this.defaults.retryLimit) {
                const retryDelay = Math.min(
                    session.adaptiveDelayMs * Math.pow(1.5, attempt - 1),
                    this.defaults.maxDelayMs
                );
                
                console.log(`🔄 [Florence Enhanced] Page ${pageIndex + 1}/${totalPages}: Retrying in ${Math.round(retryDelay)}ms (attempt ${attempt + 1}/${this.defaults.retryLimit})`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                
                return this.downloadPageWithOptimalSize(collection, pageId, pageIndex, totalPages, session, attempt + 1);
            }
            
            return {
                success: false,
                error: `Failed after ${attempt} attempts: ${error.message}`,
                attempts: attempt,
                responseTime,
                pageId
            };
        }
    }

    /**
     * Download complete manuscript with enhanced per-page optimization
     */
    async downloadManuscript(
        collection: string,
        pages: Array<{ id: string; title: string }>,
        manuscriptId: string,
        options: FlorenceEnhancedOptions = {}
    ): Promise<{
        success: boolean;
        results: FlorenceDownloadResult[];
        totalTime: number;
        stats: {
            successful: number;
            failed: number;
            totalBytes: number;
            averageResponseTime: number;
            sizesUsed: Map<number, number>; // size -> count
            perPageResults: Array<{ pageId: string; sizeUsed?: number; success: boolean }>;
        };
    }> {
        const startTime = Date.now();
        const mergedOptions = { ...this.defaults, ...options };
        
        console.log(`🚀 [Florence Enhanced] Starting enhanced download: ${manuscriptId} (${pages.length} pages)`);
        console.log(`🎯 [Florence Enhanced] Per-page sizing: ${mergedOptions.enablePerPageSizing ? 'ENABLED' : 'DISABLED'}`);
        console.log(`🎯 [Florence Enhanced] Graceful degradation: ${mergedOptions.enableGracefulDegradation ? 'ENABLED' : 'DISABLED'}`);
        
        const session = this.getSession(manuscriptId);
        const results: FlorenceDownloadResult[] = [];
        
        // Process pages one by one for maximum success rate
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            console.log(`\n📄 [Florence Enhanced] Processing page ${i + 1}/${pages.length}: ${page.id} (${page.title})`);
            
            const result = await this.downloadPageWithOptimalSize(
                collection,
                page.id,
                i,
                pages.length,
                session
            );
            
            results.push(result);
            
            // Brief pause between pages
            if (i < pages.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // Calculate comprehensive statistics
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        const totalBytes = successful.reduce((sum, r) => sum + (r.buffer?.length || 0), 0);
        const averageResponseTime = results.reduce((sum, r) => sum + (r.responseTime || 0), 0) / results.length;
        const totalTime = Date.now() - startTime;
        
        // Analyze sizes used
        const sizesUsed = new Map<number, number>();
        const perPageResults = results.map(r => ({
            pageId: r.pageId || 'unknown',
            sizeUsed: r.sizeUsed,
            success: r.success
        }));
        
        for (const result of successful) {
            if (result.sizeUsed) {
                sizesUsed.set(result.sizeUsed, (sizesUsed.get(result.sizeUsed) || 0) + 1);
            }
        }
        
        console.log(`\n📊 [Florence Enhanced] Completed: ${successful.length}/${results.length} successful (${Math.round(totalBytes / 1024 / 1024 * 100) / 100}MB in ${Math.round(totalTime / 1000)}s)`);
        
        if (sizesUsed.size > 0) {
            console.log(`🎯 [Florence Enhanced] Sizes used:`);
            for (const [size, count] of Array.from(sizesUsed.entries()).sort((a, b) => b[0] - a[0])) {
                console.log(`   ${size}px: ${count} pages`);
            }
        }
        
        if (failed.length > 0) {
            console.log(`⚠️  [Florence Enhanced] Failed pages: ${failed.length}`);
            failed.forEach((result, index) => {
                console.log(`   ${result.pageId}: ${result.error}`);
            });
        }
        
        return {
            success: successful.length > 0,
            results,
            totalTime,
            stats: {
                successful: successful.length,
                failed: failed.length,
                totalBytes,
                averageResponseTime,
                sizesUsed,
                perPageResults
            }
        };
    }

    cleanup(): void {
        for (const session of this.sessions.values()) {
            session.agent.destroy();
        }
        this.sessions.clear();
    }
}

export { FlorenceEnhancedDownloader, type FlorenceEnhancedOptions, type FlorenceDownloadResult };