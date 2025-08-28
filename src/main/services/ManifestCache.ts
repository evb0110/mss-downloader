import { promises as fs } from 'fs';
import path from 'path';
import { app } from 'electron';
import { configService } from './ConfigService';

export class ManifestCache {
    private cacheDir: string;
    private cacheFile: string;
    private cache = new Map<string, { manifest: Record<string, unknown>; timestamp: number; version: number }>();
    private maxAge = Number.POSITIVE_INFINITY; // Infinite TTL by default
    private initialized = false;
    private static readonly CACHE_VERSION = 5; // v5: Rome phantom pages fix - force fresh discovery
    private static readonly MAX_CACHE_FILE_BYTES = 5 * 1024 * 1024; // 5MB safety cap to prevent OOM on load

    constructor() {
        const userDataPath = app.getPath('userData');
        this.cacheDir = path.join(userDataPath, configService.cacheDir);
        this.cacheFile = path.join(this.cacheDir, 'manifests.json');
    }

    async init(): Promise<void> {
        if (this.initialized) return;
        
        try {
            await fs.mkdir(this.cacheDir, { recursive: true });
            
            let shouldClearCache = false;
            
            try {
                // Safety: if cache file is too large, clear it to avoid OOM
                try {
                    const stat = await fs.stat(this.cacheFile);
                    if (stat && stat.size > ManifestCache.MAX_CACHE_FILE_BYTES) {
                        console.warn(`[ManifestCache] Cache file too large (${stat.size} bytes). Clearing to prevent OOM.`);
                        shouldClearCache = true;
                    }
                } catch {
                    // stat failed; continue
                }
                const data = shouldClearCache ? '' : await fs.readFile(this.cacheFile, 'utf-8');
                if (shouldClearCache) {
                    // skip parsing
                    throw new Error('Cache too large');
                }
                const cached = JSON.parse(data);
                
                // Check cache version and auto-clear if outdated
                const cacheVersion = cached._cacheVersion || 1;
                if (cacheVersion < ManifestCache.CACHE_VERSION) {
                    shouldClearCache = true;
                } else {
                    // Convert back to Map and filter expired entries
                    const now = Date.now();
                    for (const [key, value] of Object.entries(cached) as [string, { manifest: Record<string, unknown>; timestamp: number; version: number }][]) {
                        if (key !== '_cacheVersion' && value.timestamp && now - value.timestamp < this.maxAge) {
                            // Ensure version compatibility for individual entries
                            const entryVersion = value.version || 1;
                            if (entryVersion >= ManifestCache.CACHE_VERSION) {
                                this.cache.set(key, value);
                            }
                        }
                    }
                    // Additional safety: if too many entries accumulated, clear to prevent memory bloat
                    if (this.cache.size > 1000) {
                        console.warn(`[ManifestCache] Too many cached entries (${this.cache.size}). Clearing to prevent memory bloat.`);
                        shouldClearCache = true;
                    }
                }
            } catch {
                // Cache file doesn't exist or is invalid
                shouldClearCache = true;
            }
            
            if (shouldClearCache) {
                await this.clear();
            }
        } catch (error: any) {
            console.warn('Failed to initialize manifest cache:', error instanceof Error ? error.message : 'Unknown error');
        }
        
        this.initialized = true;
    }

    async get(url: string): Promise<Record<string, unknown> | null> {
        try {
            await this.init();
            
            // FIX: Clear any Rome manifests with suspicious page counts (likely phantom pages)
            // We check for common phantom page counts that indicate failed detection
            if (url.includes('digitale.bnc.roma.sbn.it')) {
                const key = this.getCacheKey(url);
                const cached = this.cache.get(key);
                const totalPages = cached?.manifest?.['totalPages'];
                // Common phantom page counts: powers of 2 from binary search hitting limits
                const suspiciousPageCounts = [512, 1024, 2048, 4096];
                if (totalPages && suspiciousPageCounts.includes(totalPages as number)) {
                    console.warn(`[Rome] Clearing cached manifest with suspicious ${totalPages} pages for: ${url}`);
                    this.cache.delete(key);
                    await this.save();
                    return null; // Force fresh discovery
                }
            }
            
            const key = this.getCacheKey(url);
            const cached = this.cache.get(key);
            
            if (cached && Date.now() - cached.timestamp < this.maxAge) {
                // Validate cached manifest before returning
                if (this.isValidManifest(cached.manifest)) {
                    return cached.manifest;
                } else {
                    // Remove corrupted entry
                    console.warn(`Removing corrupted manifest cache entry for: ${url}`);
                    this.cache.delete(key);
                    await this.save();
                }
            }
        } catch (error: any) {
            console.warn(`Failed to get manifest from cache for ${url}:`, error instanceof Error ? error.message : 'Unknown error');
            // Don't propagate cache errors - just return null to trigger fresh fetch
        }
        
        return null;
    }

    async set(url: string, manifest: Record<string, unknown>): Promise<void> {
        try {
            await this.init();
            
            // Validate manifest before caching
            if (!this.isValidManifest(manifest)) {
                console.warn(`Refusing to cache invalid manifest for: ${url}`);
                return;
            }
            
            const key = this.getCacheKey(url);
            this.cache.set(key, {
                manifest,
                timestamp: Date.now(),
                version: ManifestCache.CACHE_VERSION,
            });
            
            await this.save();
        } catch (error: any) {
            console.warn(`Failed to cache manifest for ${url}:`, error instanceof Error ? error.message : 'Unknown error');
            // Don't propagate cache errors - download can continue without caching
        }
    }

    private async save(): Promise<void> {
        try {
            const cacheObject: Record<string, unknown> = Object.fromEntries(this.cache);
            // Add cache version to the saved data
            cacheObject['_cacheVersion'] = ManifestCache.CACHE_VERSION;
            await fs.writeFile(this.cacheFile, JSON.stringify(cacheObject, null, 2));
        } catch (error: any) {
            console.warn('Failed to save manifest cache:', error instanceof Error ? error.message : 'Unknown error');
        }
    }

    private getCacheKey(url: string): string {
        // Normalize URL for consistent caching
        return url.toLowerCase().replace(/[^a-z0-9]/g, '_');
    }

    async clear(): Promise<void> {
        this.cache.clear();
        try {
            await fs.unlink(this.cacheFile);
        } catch {
            // File doesn't exist, that's fine
        }
    }

    /**
     * Clear cache entries for specific domains (e.g., when URL processing changes)
     */
    async clearDomain(domain: string): Promise<void> {
        await this.init();
        
        const keysToDelete: string[] = [];
        for (const [key, value] of this.cache.entries()) {
            const manifest = value.manifest as Record<string, unknown>;
            if (typeof manifest['originalUrl'] === 'string' && manifest['originalUrl'].includes(domain)) {
                keysToDelete.push(key);
            }
        }
        
        for (const key of keysToDelete) {
            this.cache.delete(key);
        }
        
        if (keysToDelete?.length > 0) {
            await this.save();
        }
    }

    /**
     * Clear cache for URLs that might have problematic image URLs
     */
    async clearProblematicUrls(): Promise<void> {
        await this.init();
        
        const problematicDomains = ['bl.digirati.io', 'iiif.bl.uk', 'www.loc.gov', 'tile.loc.gov', 'cdm21059.contentdm.oclc.org', 'unipub.uni-graz.at', 'gams.uni-graz.at', 'digitale.bnc.roma.sbn.it'];
        for (const domain of problematicDomains) {
            await this.clearDomain(domain);
        }
    }

    /**
     * Validate manifest structure to prevent corruption
     */
    private isValidManifest(manifest: unknown): boolean {
        if (!manifest || typeof manifest !== 'object') {
            return false;
        }
        
        const manifestObj = manifest as Record<string, unknown>;
        
        // Check for required fields and basic structure
        if (!manifestObj['pageLinks'] || !Array.isArray(manifestObj['pageLinks'])) {
            return false;
        }
        
        // Check for common corruption indicators
        if (manifestObj['pageLinks'].some((link: unknown) => 
            !link || typeof link !== 'string' || link.includes('undefined') || link.includes('null')
        )) {
            return false;
        }
        
        return true;
    }

    /**
     * Clear cache entry for specific URL (used for error recovery)
     */
    async clearUrl(url: string): Promise<void> {
        try {
            await this.init();
            const key = this.getCacheKey(url);
            if (this.cache.has(key)) {
                this.cache.delete(key);
                await this.save();
                console.log(`Cleared corrupted cache entry for: ${url}`);
            }
        } catch (error: any) {
            console.warn(`Failed to clear cache entry for ${url}:`, error instanceof Error ? error.message : 'Unknown error');
        }
    }
}