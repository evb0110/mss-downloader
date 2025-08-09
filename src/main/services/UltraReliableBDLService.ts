import { promises as fs } from 'fs';
import path from 'path';
import { configService } from './ConfigService';
import { comprehensiveLogger } from './ComprehensiveLogger';
import * as https from 'https';
// Using global fetch available in Node.js 18+

interface ProxyHealth {
    url: string;
    lastSuccess: number;
    failureCount: number;
    avgResponseTime: number;
    isHealthy: boolean;
}

interface RetryQueueItem {
    pageIndex: number;
    url: string;
    attemptCount: number;
    lastAttempt: number;
    qualityLevel: number;
    proxyUsed?: string;
}

interface BDLDownloadOptions {
    ultraReliableMode?: boolean;
    maxRetries?: number; // -1 for unlimited
    maxQualityFallbacks?: boolean;
    proxyHealthCheck?: boolean;
    postVerification?: boolean;
    persistentQueue?: boolean;
    minDelayMs?: number;
    maxDelayMs?: number;
    pageVerificationSize?: number; // Min bytes for valid image
}

export class UltraReliableBDLService {
    private static instance: UltraReliableBDLService;
    
    // Proxy servers with health tracking
    private proxyServers: ProxyHealth[] = [
        { url: 'https://api.allorigins.win/raw?url=', lastSuccess: 0, failureCount: 0, avgResponseTime: 0, isHealthy: true },
        { url: 'https://cors-anywhere.herokuapp.com/', lastSuccess: 0, failureCount: 0, avgResponseTime: 0, isHealthy: true },
        { url: 'https://proxy.cors.sh/', lastSuccess: 0, failureCount: 0, avgResponseTime: 0, isHealthy: true },
        { url: 'https://corsproxy.io/?', lastSuccess: 0, failureCount: 0, avgResponseTime: 0, isHealthy: true },
        { url: 'https://api.codetabs.com/v1/proxy?quest=', lastSuccess: 0, failureCount: 0, avgResponseTime: 0, isHealthy: true },
        { url: 'https://thingproxy.freeboard.io/fetch/', lastSuccess: 0, failureCount: 0, avgResponseTime: 0, isHealthy: true }
    ];
    
    // Quality levels for BDL (from highest to lowest)
    private qualityLevels = [
        '/full/max/',
        '/full/full/',
        '/full/4096,/',
        '/full/2048,/',
        '/full/1024,/',
        '/full/512,/',
        '/full/256,/'
    ];
    
    // Persistent retry queue for failed pages
    private retryQueue: Map<string, RetryQueueItem> = new Map();
    private queueFilePath: string;
    
    constructor() {
        const appPath = process.platform === 'darwin' 
            ? path.join(process.env.HOME!, 'Library', 'Application Support', 'mss-downloader')
            : path.join(process.env.APPDATA || process.env.HOME!, 'mss-downloader');
        
        this.queueFilePath = path.join(appPath, 'bdl-retry-queue.json');
        this.loadRetryQueue();
    }
    
    static getInstance(): UltraReliableBDLService {
        if (!UltraReliableBDLService.instance) {
            UltraReliableBDLService.instance = new UltraReliableBDLService();
        }
        return UltraReliableBDLService.instance;
    }
    
    /**
     * Load persistent retry queue from disk
     */
    private async loadRetryQueue(): Promise<void> {
        try {
            const data = await fs.readFile(this.queueFilePath, 'utf-8');
            const items = JSON.parse(data) as RetryQueueItem[];
            items.forEach(item => {
                this.retryQueue.set(`${item.url}_${item.pageIndex}`, item);
            });
            console.log(`[BDL Ultra] Loaded ${this.retryQueue.size} items from retry queue`);
        } catch {
            // No queue file exists yet
        }
    }
    
    /**
     * Save retry queue to disk for persistence
     */
    private async saveRetryQueue(): Promise<void> {
        try {
            const items = Array.from(this.retryQueue.values());
            await fs.writeFile(this.queueFilePath, JSON.stringify(items, null, 2));
        } catch (error) {
            console.error('[BDL Ultra] Failed to save retry queue:', error);
        }
    }
    
    /**
     * Test proxy health and update status
     */
    private async testProxyHealth(proxy: ProxyHealth): Promise<boolean> {
        const testUrl = 'https://www.bdl.servizirl.it/cantaloupe/iiif/2/test/info.json';
        const startTime = Date.now();
        
        try {
            const proxyUrl = `${proxy.url}${encodeURIComponent(testUrl)}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(proxyUrl, {
                signal: controller.signal,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const responseTime = Date.now() - startTime;
                proxy.avgResponseTime = proxy.avgResponseTime 
                    ? (proxy.avgResponseTime + responseTime) / 2 
                    : responseTime;
                proxy.lastSuccess = Date.now();
                proxy.failureCount = 0;
                proxy.isHealthy = true;
                return true;
            }
        } catch {
            // Proxy failed
        }
        
        proxy.failureCount++;
        proxy.isHealthy = proxy.failureCount < 3; // Mark unhealthy after 3 failures
        return false;
    }
    
    /**
     * Get the best available proxy based on health metrics
     */
    private async getBestProxy(): Promise<ProxyHealth | null> {
        // Sort by health and response time
        const healthyProxies = this.proxyServers
            .filter(p => p.isHealthy)
            .sort((a, b) => {
                // Prefer recently successful proxies
                if (a.lastSuccess && b.lastSuccess) {
                    return b.lastSuccess - a.lastSuccess;
                }
                // Then by average response time
                return a.avgResponseTime - b.avgResponseTime;
            });
        
        if (healthyProxies.length === 0) {
            // All proxies are unhealthy, reset and try again
            console.log('[BDL Ultra] All proxies unhealthy, resetting...');
            this.proxyServers.forEach(p => {
                p.isHealthy = true;
                p.failureCount = 0;
            });
            return this.proxyServers[0];
        }
        
        return healthyProxies[0];
    }
    
    /**
     * Calculate adaptive retry delay based on attempt number
     */
    private calculateRetryDelay(attempt: number, options: BDLDownloadOptions): number {
        const minDelay = options.minDelayMs || 1000;
        const maxDelay = options.maxDelayMs || 300000; // 5 minutes max
        
        // Exponential backoff with jitter
        let delay = Math.min(minDelay * Math.pow(2, attempt), maxDelay);
        
        // Add jitter to prevent thundering herd
        delay = delay * (0.5 + Math.random() * 0.5);
        
        // For ultra-reliable mode, use longer delays after many attempts
        if (options.ultraReliableMode && attempt > 20) {
            // After 20 attempts, wait 1-5 minutes between attempts
            delay = 60000 + Math.random() * 240000;
        }
        
        return Math.round(delay);
    }
    
    /**
     * Download image with quality fallback
     */
    private async downloadWithQualityFallback(
        url: string, 
        qualityLevel: number = 0
    ): Promise<{ buffer: Buffer; quality: number } | null> {
        if (qualityLevel >= this.qualityLevels.length) {
            return null;
        }
        
        // Replace quality in URL
        const currentQuality = this.qualityLevels[qualityLevel];
        const modifiedUrl = url.replace(/\/full\/[^/]+\//, currentQuality);
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            
            const response = await fetch(modifiedUrl, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                    'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
                    'Referer': 'https://www.bdl.servizirl.it/'
                }
            });
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                if (buffer.length > 1024) { // At least 1KB
                    return { buffer, quality: qualityLevel };
                }
            }
        } catch (error) {
            console.log(`[BDL Ultra] Quality ${currentQuality} failed: ${error.message}`);
        }
        
        // Try next quality level
        return this.downloadWithQualityFallback(url, qualityLevel + 1);
    }
    
    /**
     * Ultra-reliable download with unlimited retries and smart fallbacks
     */
    async ultraReliableDownload(
        url: string,
        pageIndex: number,
        options: BDLDownloadOptions = {}
    ): Promise<Buffer | null> {
        const maxRetries = options.ultraReliableMode ? -1 : (options.maxRetries || 50);
        let attempt = 0;
        let lastError: Error | null = null;
        
        // Check if this page is in the retry queue
        const queueKey = `${url}_${pageIndex}`;
        let queueItem = this.retryQueue.get(queueKey);
        if (queueItem) {
            attempt = queueItem.attemptCount;
            console.log(`[BDL Ultra] Resuming download for page ${pageIndex} (attempt ${attempt})`);
        } else {
            queueItem = {
                pageIndex,
                url,
                attemptCount: 0,
                lastAttempt: Date.now(),
                qualityLevel: 0
            };
        }
        
        // Health check proxies if enabled
        if (options.proxyHealthCheck && attempt % 5 === 0) {
            console.log('[BDL Ultra] Running proxy health checks...');
            await Promise.all(this.proxyServers.map(p => this.testProxyHealth(p)));
        }
        
        while (maxRetries === -1 || attempt < maxRetries) {
            attempt++;
            queueItem.attemptCount = attempt;
            queueItem.lastAttempt = Date.now();
            
            comprehensiveLogger.log({
                level: 'info',
                category: 'bdl-ultra',
                library: 'bdl',
                url,
                message: `Attempt ${attempt} for page ${pageIndex}`,
                details: { 
                    unlimited: maxRetries === -1,
                    qualityLevel: queueItem.qualityLevel 
                }
            });
            
            try {
                // Strategy 1: Direct download with quality fallback
                if (attempt <= 3) {
                    const result = await this.downloadWithQualityFallback(url, queueItem.qualityLevel);
                    if (result) {
                        console.log(`[BDL Ultra] SUCCESS: Page ${pageIndex} downloaded at quality level ${result.quality}`);
                        this.retryQueue.delete(queueKey);
                        await this.saveRetryQueue();
                        return result.buffer;
                    }
                }
                
                // Strategy 2: Use proxy with best health
                const proxy = await this.getBestProxy();
                if (proxy) {
                    queueItem.proxyUsed = proxy.url;
                    const proxyUrl = `${proxy.url}${encodeURIComponent(url)}`;
                    
                    const startTime = Date.now();
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 60000);
                    
                    const response = await fetch(proxyUrl, {
                        signal: controller.signal,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                            'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8'
                        }
                    });
                    clearTimeout(timeoutId);
                    
                    if (response.ok) {
                        const arrayBuffer = await response.arrayBuffer();
                        const buffer = Buffer.from(arrayBuffer);
                        const responseTime = Date.now() - startTime;
                        
                        // Update proxy health metrics
                        proxy.lastSuccess = Date.now();
                        proxy.avgResponseTime = (proxy.avgResponseTime + responseTime) / 2;
                        proxy.failureCount = 0;
                        
                        // Verify image size
                        if (buffer.length > (options.pageVerificationSize || 10240)) {
                            console.log(`[BDL Ultra] SUCCESS: Page ${pageIndex} via proxy (${buffer.length} bytes)`);
                            this.retryQueue.delete(queueKey);
                            await this.saveRetryQueue();
                            return buffer;
                        } else {
                            console.warn(`[BDL Ultra] Page ${pageIndex} too small: ${buffer.length} bytes`);
                        }
                    } else {
                        proxy.failureCount++;
                    }
                }
                
                // Strategy 3: Try different quality level
                if (options.maxQualityFallbacks && attempt % 10 === 0) {
                    queueItem.qualityLevel = (queueItem.qualityLevel + 1) % this.qualityLevels.length;
                    console.log(`[BDL Ultra] Switching to quality level ${queueItem.qualityLevel}`);
                }
                
            } catch (error) {
                lastError = error as Error;
                console.error(`[BDL Ultra] Attempt ${attempt} failed: ${lastError.message}`);
            }
            
            // Save to persistent queue
            if (options.persistentQueue) {
                this.retryQueue.set(queueKey, queueItem);
                if (attempt % 10 === 0) {
                    await this.saveRetryQueue();
                }
            }
            
            // Calculate delay for next attempt
            const delay = this.calculateRetryDelay(attempt, options);
            console.log(`[BDL Ultra] Waiting ${delay}ms before retry ${attempt + 1}...`);
            
            // Log progress for long-running downloads
            if (attempt % 50 === 0) {
                comprehensiveLogger.log({
                    level: 'warn',
                    category: 'bdl-ultra',
                    library: 'bdl',
                    url,
                    message: `Still trying page ${pageIndex} after ${attempt} attempts`,
                    details: {
                        totalTime: Date.now() - (queueItem.lastAttempt - attempt * delay),
                        nextDelay: delay
                    }
                });
            }
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        // Final failure (only if not unlimited mode)
        console.error(`[BDL Ultra] FINAL FAILURE: Page ${pageIndex} after ${attempt} attempts`);
        return null;
    }
    
    /**
     * Verify downloaded images and re-download if needed
     */
    async verifyAndRedownload(
        imagePaths: (string | null)[],
        pageUrls: string[],
        options: BDLDownloadOptions = {}
    ): Promise<string[]> {
        const verifiedPaths: string[] = [];
        const minSize = options.pageVerificationSize || 10240; // 10KB minimum
        
        console.log('[BDL Ultra] Starting post-download verification...');
        
        for (let i = 0; i < imagePaths.length; i++) {
            const imagePath = imagePaths[i];
            
            if (!imagePath) {
                // Page failed initial download, retry with ultra-reliable mode
                console.log(`[BDL Ultra] Re-downloading failed page ${i + 1}...`);
                const buffer = await this.ultraReliableDownload(
                    pageUrls[i], 
                    i, 
                    { ...options, ultraReliableMode: true }
                );
                
                if (buffer) {
                    const newPath = imagePath || `temp_page_${i + 1}.jpg`;
                    await fs.writeFile(newPath, buffer);
                    verifiedPaths[i] = newPath;
                }
            } else {
                // Verify existing file
                try {
                    const stats = await fs.stat(imagePath);
                    if (stats.size < minSize) {
                        console.log(`[BDL Ultra] Page ${i + 1} too small (${stats.size} bytes), re-downloading...`);
                        const buffer = await this.ultraReliableDownload(
                            pageUrls[i], 
                            i, 
                            { ...options, ultraReliableMode: true }
                        );
                        
                        if (buffer && buffer.length > stats.size) {
                            await fs.writeFile(imagePath, buffer);
                            console.log(`[BDL Ultra] Replaced page ${i + 1} with larger version (${buffer.length} bytes)`);
                        }
                    }
                    verifiedPaths[i] = imagePath;
                } catch {
                    // File doesn't exist, re-download
                    const buffer = await this.ultraReliableDownload(
                        pageUrls[i], 
                        i, 
                        { ...options, ultraReliableMode: true }
                    );
                    
                    if (buffer) {
                        await fs.writeFile(imagePath, buffer);
                        verifiedPaths[i] = imagePath;
                    }
                }
            }
        }
        
        // Process any remaining items in retry queue
        if (this.retryQueue.size > 0) {
            console.log(`[BDL Ultra] Processing ${this.retryQueue.size} items in retry queue...`);
            for (const [key, item] of this.retryQueue) {
                if (item.url.includes('bdl.servizirl.it')) {
                    const buffer = await this.ultraReliableDownload(
                        item.url, 
                        item.pageIndex, 
                        { ...options, ultraReliableMode: true }
                    );
                    
                    if (buffer && item.pageIndex < verifiedPaths.length) {
                        const path = verifiedPaths[item.pageIndex] || `recovered_page_${item.pageIndex + 1}.jpg`;
                        await fs.writeFile(path, buffer);
                        verifiedPaths[item.pageIndex] = path;
                    }
                }
            }
        }
        
        return verifiedPaths;
    }
    
    /**
     * Clear retry queue for a specific manuscript or all
     */
    async clearRetryQueue(manuscriptId?: string): Promise<void> {
        if (manuscriptId) {
            for (const key of this.retryQueue.keys()) {
                if (key.includes(manuscriptId)) {
                    this.retryQueue.delete(key);
                }
            }
        } else {
            this.retryQueue.clear();
        }
        await this.saveRetryQueue();
        console.log(`[BDL Ultra] Cleared retry queue${manuscriptId ? ` for ${manuscriptId}` : ''}`);
    }
    
    /**
     * Get retry queue status
     */
    getQueueStatus(): { size: number; items: RetryQueueItem[] } {
        return {
            size: this.retryQueue.size,
            items: Array.from(this.retryQueue.values())
        };
    }
}