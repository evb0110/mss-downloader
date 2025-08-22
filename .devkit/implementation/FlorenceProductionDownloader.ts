#!/usr/bin/env bun

/**
 * Production-Quality Florence ContentDM Download Logic
 * 
 * Solves the 403 Forbidden issue through:
 * 1. Intelligent size detection and caching
 * 2. Proper ContentDM etiquette (headers, delays, sessions)
 * 3. Adaptive rate limiting with 403 backoff
 * 4. Session management for consistent access patterns
 * 5. Progressive retry strategies with intelligent fallback
 */

import https from 'https';
import http from 'http';

interface FlorenceDownloadOptions {
    maxConcurrent?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    sessionTimeout?: number;
    retryLimit?: number;
    enableAdaptiveBackoff?: boolean;
    enableSizeCache?: boolean;
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
}

interface FlorenceSession {
    agent: https.Agent;
    lastRequestTime: number;
    requestCount: number;
    consecutiveErrors: number;
    adaptiveDelayMs: number;
}

class FlorenceProductionDownloader {
    private readonly SIZE_PREFERENCES = [4000, 2048, 1024, 800, 600]; // Start with 4000px (safe for most)
    private readonly manuscriptSizeCache = new Map<string, number>();
    private readonly sessions = new Map<string, FlorenceSession>();
    private readonly defaults: Required<FlorenceDownloadOptions>;
    
    constructor(options: FlorenceDownloadOptions = {}) {
        this.defaults = {
            maxConcurrent: 2, // Conservative for ContentDM
            baseDelayMs: 1500, // Respectful baseline delay
            maxDelayMs: 15000, // Maximum backoff
            sessionTimeout: 300000, // 5 minute session lifetime
            retryLimit: 8, // Generous retry allowance
            enableAdaptiveBackoff: true,
            enableSizeCache: true,
            ...options
        };
    }

    /**
     * Get or create a session for ContentDM requests
     */
    private getSession(manuscriptId: string): FlorenceSession {
        const existing = this.sessions.get(manuscriptId);
        const now = Date.now();
        
        if (existing && (now - existing.lastRequestTime) < this.defaults.sessionTimeout) {
            return existing;
        }
        
        // Create new session with persistent agent
        const session: FlorenceSession = {
            agent: new https.Agent({
                keepAlive: true,
                maxSockets: 2,
                maxFreeSockets: 1,
                timeout: 60000,
                keepAliveMsecs: 30000
            }),
            lastRequestTime: now,
            requestCount: 0,
            consecutiveErrors: 0,
            adaptiveDelayMs: this.defaults.baseDelayMs
        };
        
        this.sessions.set(manuscriptId, session);
        return session;
    }

    /**
     * Make a request with proper ContentDM headers and session management
     */
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
                timeout: 60000
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
     * Test a specific size for availability with intelligent error handling
     */
    private async testImageSize(collection: string, pageId: string, width: number, session: FlorenceSession): Promise<{
        success: boolean;
        error?: string;
        statusCode?: number;
        contentLength?: number;
        responseTime?: number;
    }> {
        const startTime = Date.now();
        const url = `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${pageId}/full/${width},/0/default.jpg`;
        
        try {
            const { response } = await this.makeRequest(url, 'HEAD', session);
            const responseTime = Date.now() - startTime;
            const contentLength = response.headers['content-length'] ? parseInt(response.headers['content-length']) : undefined;
            
            if (response.statusCode === 200) {
                session.consecutiveErrors = 0; // Reset error count on success
                return {
                    success: true,
                    statusCode: response.statusCode,
                    contentLength,
                    responseTime
                };
            } else {
                if (response.statusCode === 403) {
                    session.consecutiveErrors++;
                    // Adaptive backoff for 403 errors
                    if (this.defaults.enableAdaptiveBackoff) {
                        session.adaptiveDelayMs = Math.min(
                            session.adaptiveDelayMs * 1.5,
                            this.defaults.maxDelayMs
                        );
                    }
                }
                
                return {
                    success: false,
                    error: `HTTP ${response.statusCode}: ${response.statusMessage}`,
                    statusCode: response.statusCode,
                    responseTime
                };
            }
        } catch (error: any) {
            session.consecutiveErrors++;
            return {
                success: false,
                error: error.message || String(error),
                responseTime: Date.now() - startTime
            };
        }
    }

    /**
     * Determine optimal size for a manuscript with intelligent caching
     */
    private async determineOptimalSize(collection: string, pageId: string, manuscriptId: string): Promise<{
        optimalSize: number;
        testsPerformed: number;
        cacheHit: boolean;
    }> {
        // Check cache first
        if (this.defaults.enableSizeCache && this.manuscriptSizeCache.has(manuscriptId)) {
            const cachedSize = this.manuscriptSizeCache.get(manuscriptId)!;
            console.log(`📋 [Florence Cache] Using cached optimal size: ${cachedSize}px for ${manuscriptId}`);
            return {
                optimalSize: cachedSize,
                testsPerformed: 0,
                cacheHit: true
            };
        }
        
        const session = this.getSession(manuscriptId);
        console.log(`🔍 [Florence Detection] Testing image sizes for ${manuscriptId} (sample: ${pageId})`);
        
        let testsPerformed = 0;
        
        // Test sizes in order of preference
        for (const width of this.SIZE_PREFERENCES) {
            testsPerformed++;
            
            // Apply session delay before each test
            if (session.requestCount > 0) {
                const delayMs = session.adaptiveDelayMs;
                console.log(`⏱️  [Florence Etiquette] Waiting ${delayMs}ms between size tests...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
            
            const result = await this.testImageSize(collection, pageId, width, session);
            session.requestCount++;
            session.lastRequestTime = Date.now();
            
            if (result.success) {
                // Found working size - cache it
                if (this.defaults.enableSizeCache) {
                    this.manuscriptSizeCache.set(manuscriptId, width);
                }
                
                console.log(`✅ [Florence Detection] Optimal size determined: ${width}px for ${manuscriptId} (${result.responseTime}ms)`);
                return {
                    optimalSize: width,
                    testsPerformed,
                    cacheHit: false
                };
            } else {
                console.log(`❌ [Florence Detection] Size ${width}px failed: ${result.error} (${result.responseTime}ms)`);
                
                // If we hit 403, increase delay for subsequent tests
                if (result.statusCode === 403 && this.defaults.enableAdaptiveBackoff) {
                    console.log(`🚫 [Florence 403] Increasing delay to ${session.adaptiveDelayMs}ms due to access restriction`);
                }
            }
        }
        
        // If all sizes fail, use the smallest as emergency fallback
        const fallbackSize = this.SIZE_PREFERENCES[this.SIZE_PREFERENCES.length - 1];
        console.log(`⚠️  [Florence Fallback] All size tests failed, using emergency fallback: ${fallbackSize}px`);
        
        return {
            optimalSize: fallbackSize,
            testsPerformed,
            cacheHit: false
        };
    }

    /**
     * Download a single image with comprehensive retry logic
     */
    private async downloadSingleImage(
        url: string,
        pageIndex: number,
        totalPages: number,
        session: FlorenceSession,
        attempt = 1
    ): Promise<FlorenceDownloadResult> {
        const startTime = Date.now();
        
        try {
            // Apply rate limiting with progressive delay
            const baseDelay = session.adaptiveDelayMs;
            const jitter = Math.random() * 500; // Add jitter to prevent thundering herd
            const delay = baseDelay + jitter;
            
            if (session.requestCount > 0) {
                console.log(`⏱️  [Florence Rate Limit] Page ${pageIndex + 1}/${totalPages}: Waiting ${Math.round(delay)}ms (attempt ${attempt})`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            const { response, data } = await this.makeRequest(url, 'GET', session);
            session.requestCount++;
            session.lastRequestTime = Date.now();
            
            const responseTime = Date.now() - startTime;
            
            if (response.statusCode === 200 && data && data.length > 0) {
                session.consecutiveErrors = 0;
                
                // Validate image data
                if (data.length < 1024) {
                    throw new Error(`Image too small: ${data.length} bytes (likely error page)`);
                }
                
                // Check for JPEG signature
                if (data[0] !== 0xFF || data[1] !== 0xD8) {
                    throw new Error('Invalid JPEG signature (likely error page)');
                }
                
                console.log(`✅ [Florence Download] Page ${pageIndex + 1}/${totalPages}: ${Math.round(data.length / 1024)}KB in ${responseTime}ms (attempt ${attempt})`);
                
                return {
                    success: true,
                    buffer: data,
                    finalUrl: url,
                    attempts: attempt,
                    responseTime
                };
            } else {
                session.consecutiveErrors++;
                
                if (response.statusCode === 403) {
                    // 403 Forbidden - increase backoff significantly
                    if (this.defaults.enableAdaptiveBackoff) {
                        session.adaptiveDelayMs = Math.min(
                            session.adaptiveDelayMs * 2,
                            this.defaults.maxDelayMs
                        );
                    }
                    
                    throw new Error(`403 Forbidden - Size restriction or rate limit (attempt ${attempt})`);
                } else {
                    throw new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`);
                }
            }
        } catch (error: any) {
            session.consecutiveErrors++;
            const responseTime = Date.now() - startTime;
            
            console.log(`❌ [Florence Download] Page ${pageIndex + 1}/${totalPages} failed: ${error.message} (${responseTime}ms, attempt ${attempt})`);
            
            // Retry logic with exponential backoff
            if (attempt < this.defaults.retryLimit) {
                const retryDelay = Math.min(
                    session.adaptiveDelayMs * Math.pow(1.5, attempt - 1),
                    this.defaults.maxDelayMs
                );
                
                console.log(`🔄 [Florence Retry] Page ${pageIndex + 1}/${totalPages}: Retrying in ${Math.round(retryDelay)}ms (attempt ${attempt + 1}/${this.defaults.retryLimit})`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                
                return this.downloadSingleImage(url, pageIndex, totalPages, session, attempt + 1);
            }
            
            return {
                success: false,
                error: `Failed after ${attempt} attempts: ${error.message}`,
                attempts: attempt,
                responseTime
            };
        }
    }

    /**
     * Download complete manuscript with production-quality error handling
     */
    async downloadManuscript(
        collection: string,
        pages: Array<{ id: string; title: string }>,
        manuscriptId: string,
        options: FlorenceDownloadOptions = {}
    ): Promise<{
        success: boolean;
        results: FlorenceDownloadResult[];
        optimalSize: number;
        totalTime: number;
        stats: {
            successful: number;
            failed: number;
            totalBytes: number;
            averageResponseTime: number;
            cacheHit: boolean;
        };
    }> {
        const startTime = Date.now();
        const mergedOptions = { ...this.defaults, ...options };
        
        console.log(`🚀 [Florence Production] Starting download: ${manuscriptId} (${pages.length} pages)`);
        
        // Step 1: Determine optimal size
        const samplePageId = pages[0]?.id;
        if (!samplePageId) {
            throw new Error('No pages available for download');
        }
        
        const { optimalSize, testsPerformed, cacheHit } = await this.determineOptimalSize(
            collection,
            samplePageId,
            manuscriptId
        );
        
        console.log(`🎯 [Florence Production] Using ${optimalSize}px for all ${pages.length} pages (${testsPerformed} tests, cache: ${cacheHit ? 'hit' : 'miss'})`);
        
        // Step 2: Generate URLs with optimal size
        const imageUrls = pages.map(page => 
            `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${page.id}/full/${optimalSize},/0/default.jpg`
        );
        
        // Step 3: Download with controlled concurrency
        const session = this.getSession(manuscriptId);
        const results: FlorenceDownloadResult[] = [];
        const maxConcurrent = mergedOptions.maxConcurrent || 2;
        
        console.log(`📥 [Florence Production] Downloading ${pages.length} pages with ${maxConcurrent} concurrent connections...`);
        
        // Process in batches to control concurrency
        for (let i = 0; i < imageUrls.length; i += maxConcurrent) {
            const batch = imageUrls.slice(i, i + maxConcurrent);
            const batchPromises = batch.map((url, batchIndex) => 
                this.downloadSingleImage(url, i + batchIndex, imageUrls.length, session)
            );
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            
            // Brief pause between batches to be respectful
            if (i + maxConcurrent < imageUrls.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        // Step 4: Calculate statistics
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        const totalBytes = successful.reduce((sum, r) => sum + (r.buffer?.length || 0), 0);
        const averageResponseTime = results.reduce((sum, r) => sum + (r.responseTime || 0), 0) / results.length;
        const totalTime = Date.now() - startTime;
        
        console.log(`📊 [Florence Production] Completed: ${successful.length}/${results.length} successful (${Math.round(totalBytes / 1024 / 1024 * 100) / 100}MB in ${Math.round(totalTime / 1000)}s)`);
        
        if (failed.length > 0) {
            console.log(`⚠️  [Florence Production] Failed pages: ${failed.length}`);
            failed.forEach((result, index) => {
                console.log(`   Page ${index + 1}: ${result.error}`);
            });
        }
        
        return {
            success: successful.length > 0,
            results,
            optimalSize,
            totalTime,
            stats: {
                successful: successful.length,
                failed: failed.length,
                totalBytes,
                averageResponseTime,
                cacheHit
            }
        };
    }

    /**
     * Clean up sessions and cache
     */
    cleanup(): void {
        // Close all agents
        for (const session of this.sessions.values()) {
            session.agent.destroy();
        }
        this.sessions.clear();
        
        if (this.defaults.enableSizeCache) {
            console.log(`🧹 [Florence Cleanup] Cleared ${this.manuscriptSizeCache.size} cached size entries`);
        }
        this.manuscriptSizeCache.clear();
    }
}

export { FlorenceProductionDownloader, type FlorenceDownloadOptions, type FlorenceDownloadResult };