/**
 * Global DZI Processing Cache
 * 
 * CRITICAL FIX: Singleton cache shared across all EnhancedManuscriptDownloaderService instances
 * to prevent multiple concurrent DZI processing of the same URLs.
 * 
 * ROOT CAUSE: Multiple service instances each had isolated dziProcessingCache,
 * causing redundant DZI tile downloads and progress chaos.
 */

export class GlobalDziCache {
    private static instance: GlobalDziCache;
    private cache = new Map<string, Promise<Buffer>>();
    
    // Singleton pattern - ensure only one global cache exists
    public static getInstance(): GlobalDziCache {
        if (!GlobalDziCache.instance) {
            GlobalDziCache.instance = new GlobalDziCache();
        }
        return GlobalDziCache.instance;
    }
    
    private constructor() {
        // Private constructor prevents multiple instances
    }
    
    /**
     * Get cached DZI processing promise or null if not cached
     */
    public get(url: string): Promise<Buffer> | null {
        return this.cache.get(url) || null;
    }
    
    /**
     * Set DZI processing promise in cache with automatic cleanup
     */
    public set(url: string, promise: Promise<Buffer>): void {
        this.cache.set(url, promise);
        
        // Automatically clean up cache entry when processing completes
        promise.finally(() => {
            this.cache.delete(url);
        });
    }
    
    /**
     * Check if URL is currently being processed
     */
    public has(url: string): boolean {
        return this.cache.has(url);
    }
    
    /**
     * Get current cache size (for debugging)
     */
    public size(): number {
        return this.cache.size;
    }
    
    /**
     * Clear all cache entries (for testing/debugging)
     */
    public clear(): void {
        this.cache.clear();
    }
}