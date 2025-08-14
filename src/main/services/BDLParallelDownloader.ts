import { EventEmitter } from 'events';
import { comprehensiveLogger } from './ComprehensiveLogger';

interface DownloadTask {
    url: string;
    pageIndex: number;
    retries: number;
    startTime: number;
}

interface DownloadResult {
    pageIndex: number;
    buffer: Buffer | null;
    time: number;
    success: boolean;
}

export class BDLParallelDownloader extends EventEmitter {
    private concurrentLimit: number;
    private activeDownloads: Map<number, AbortController> = new Map();
    private downloadQueue: DownloadTask[] = [];
    private results: Map<number, DownloadResult> = new Map();
    private totalPages: number = 0;
    private completedPages: number = 0;
    
    constructor(concurrentLimit: number = 5) {
        super();
        // PERFORMANCE FIX: Increase concurrent downloads for BDL
        this.concurrentLimit = Math.min(concurrentLimit, 10); // Max 10 concurrent
    }
    
    /**
     * Download all pages with parallel execution
     */
    async downloadAllPages(pageUrls: string[]): Promise<(Buffer | null)[]> {
        this.totalPages = pageUrls?.length || 0;
        this.completedPages = 0;
        this.results.clear();
        
        console.log(`[BDL Parallel] Starting parallel download of ${pageUrls?.length} pages with ${this.concurrentLimit} concurrent connections`);
        
        // Initialize download queue
        this.downloadQueue = pageUrls.map((url, index) => ({
            url,
            pageIndex: index,
            retries: 0,
            startTime: Date.now()
        }));
        
        // Start initial batch of downloads
        const initialBatch = Math.min(this.concurrentLimit, this.downloadQueue?.length);
        const activePromises: Promise<void>[] = [];
        
        for (let i = 0; i < initialBatch; i++) {
            const task = this.downloadQueue.shift();
            if (task) {
                activePromises.push(this.processDownload(task));
            }
        }
        
        // Wait for all downloads to complete
        await Promise.all(activePromises);
        
        // Convert results map to array in correct order
        const finalResults: (Buffer | null)[] = [];
        for (let i = 0; i < pageUrls?.length; i++) {
            const result = this.results.get(i);
            finalResults.push(result?.buffer || null);
        }
        
        const successCount = finalResults.filter(b => b !== null)?.length;
        console.log(`[BDL Parallel] Download complete: ${successCount}/${pageUrls?.length} pages successful`);
        
        return finalResults;
    }
    
    private async processDownload(task: DownloadTask): Promise<void> {
        const controller = new AbortController();
        this.activeDownloads.set(task.pageIndex, controller);
        
        try {
            const buffer = await this.downloadWithOptimizedSettings(task.url, task.pageIndex, controller);
            
            this.results.set(task.pageIndex, {
                pageIndex: task.pageIndex,
                buffer,
                time: Date.now() - task.startTime,
                success: buffer !== null
            });
            
            this.completedPages++;
            this.emit('progress', {
                completed: this.completedPages,
                total: this?.totalPages,
                pageIndex: task.pageIndex,
                success: buffer !== null
            });
            
        } catch (error) {
            console.error(`[BDL Parallel] Failed page ${task.pageIndex}: ${error instanceof Error ? error.message : String(error)}`);
            
            // Retry logic
            if (task.retries < 3) {
                task.retries++;
                task.startTime = Date.now();
                this.downloadQueue.push(task); // Re-add to queue for retry
            } else {
                this.results.set(task.pageIndex, {
                    pageIndex: task.pageIndex,
                    buffer: null,
                    time: Date.now() - task.startTime,
                    success: false
                });
                
                this.completedPages++;
                this.emit('progress', {
                    completed: this.completedPages,
                    total: this?.totalPages,
                    pageIndex: task.pageIndex,
                    success: false
                });
            }
        } finally {
            this.activeDownloads.delete(task.pageIndex);
            
            // Start next download if queue has items
            const nextTask = this.downloadQueue.shift();
            if (nextTask) {
                await this.processDownload(nextTask);
            }
        }
    }
    
    private async downloadWithOptimizedSettings(
        url: string, 
        pageIndex: number,
        controller: AbortController
    ): Promise<Buffer | null> {
        // PERFORMANCE OPTIMIZATION: Use aggressive timeout and headers
        const timeout = 15000; // 15 seconds max per image
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            // Log download start
            comprehensiveLogger.log({
                level: 'debug',
                category: 'bdl-parallel',
                library: 'bdl',
                url,
                message: `Starting parallel download for page ${pageIndex + 1}`,
                details: { pageIndex, url }
            });
            
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'Referer': 'https://www.bdl.servizirl.it/',
                    // Add range header for partial content support
                    'Range': 'bytes=0-'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok || response.status === 206) { // 206 = Partial Content
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                
                // Validate minimum size (1024px images should be ~100-500KB)
                if (buffer?.length < 10240) { // Less than 10KB is suspicious
                    console.warn(`[BDL Parallel] Page ${pageIndex + 1} too small: ${buffer?.length} bytes`);
                    return null;
                }
                
                console.log(`[BDL Parallel] ✅ Page ${pageIndex + 1} downloaded: ${(buffer?.length / 1024).toFixed(1)}KB`);
                return buffer;
            } else {
                console.error(`[BDL Parallel] HTTP ${response.status} for page ${pageIndex + 1}`);
                return null;
            }
            
        } catch (error: any) {
            clearTimeout(timeoutId);
            
            if (error instanceof Error && (error as any)?.name === 'AbortError') {
                console.error(`[BDL Parallel] Timeout for page ${pageIndex + 1} after ${timeout}ms`);
            } else {
                console.error(`[BDL Parallel] Error downloading page ${pageIndex + 1}: ${error instanceof Error ? error.message : String(error)}`);
            }
            
            return null;
        }
    }
    
    /**
     * Abort all active downloads
     */
    abort(): void {
        console.log(`[BDL Parallel] Aborting ${this.activeDownloads.size} active downloads`);
        
        for (const [_pageIndex, controller] of this.activeDownloads) {
            controller.abort();
        }
        
        this.activeDownloads.clear();
        this.downloadQueue = [];
    }
    
    /**
     * Get download statistics
     */
    getStats(): {
        total: number;
        completed: number;
        successful: number;
        failed: number;
        averageTime: number;
    } {
        const results = Array.from(this.results.values());
        const successful = results.filter(r => r.success);
        
        return {
            total: this?.totalPages,
            completed: this.completedPages,
            successful: successful?.length,
            failed: results?.length - successful?.length,
            averageTime: successful?.length > 0 
                ? successful.reduce((sum, r) => sum + r.time, 0) / successful.length
                : 0
        };
    }
}