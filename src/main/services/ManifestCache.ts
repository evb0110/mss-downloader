import { promises as fs } from 'fs';
import path from 'path';
import { app } from 'electron';
import { configService } from './ConfigService.js';

export class ManifestCache {
    private cacheDir: string;
    private cacheFile: string;
    private cache = new Map<string, { manifest: any; timestamp: number; version: number }>();
    private maxAge = 24 * 60 * 60 * 1000; // 24 hours
    private initialized = false;
    private static readonly CACHE_VERSION = 4; // Increment when URL processing logic changes

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
                const data = await fs.readFile(this.cacheFile, 'utf-8');
                const cached = JSON.parse(data);
                
                // Check cache version and auto-clear if outdated
                const cacheVersion = cached._cacheVersion || 1;
                if (cacheVersion < ManifestCache.CACHE_VERSION) {
                    shouldClearCache = true;
                } else {
                    // Convert back to Map and filter expired entries
                    const now = Date.now();
                    for (const [key, value] of Object.entries(cached) as [string, any][]) {
                        if (key !== '_cacheVersion' && value.timestamp && now - value.timestamp < this.maxAge) {
                            // Ensure version compatibility for individual entries
                            const entryVersion = value.version || 1;
                            if (entryVersion >= ManifestCache.CACHE_VERSION) {
                                this.cache.set(key, value);
                            }
                        }
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
            console.warn('Failed to initialize manifest cache:', error.message);
        }
        
        this.initialized = true;
    }

    async get(url: string): Promise<any | null> {
        await this.init();
        
        const key = this.getCacheKey(url);
        const cached = this.cache.get(key);
        
        if (cached && Date.now() - cached.timestamp < this.maxAge) {
            return cached.manifest;
        }
        
        return null;
    }

    async set(url: string, manifest: any): Promise<void> {
        await this.init();
        
        const key = this.getCacheKey(url);
        this.cache.set(key, {
            manifest,
            timestamp: Date.now(),
            version: ManifestCache.CACHE_VERSION,
        });
        
        await this.save();
    }

    private async save(): Promise<void> {
        try {
            const cacheObject: any = Object.fromEntries(this.cache);
            // Add cache version to the saved data
            cacheObject._cacheVersion = ManifestCache.CACHE_VERSION;
            await fs.writeFile(this.cacheFile, JSON.stringify(cacheObject, null, 2));
        } catch (error: any) {
            console.warn('Failed to save manifest cache:', error.message);
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
            if (value.manifest?.originalUrl?.includes(domain)) {
                keysToDelete.push(key);
            }
        }
        
        for (const key of keysToDelete) {
            this.cache.delete(key);
        }
        
        if (keysToDelete.length > 0) {
            await this.save();
        }
    }

    /**
     * Clear cache for URLs that might have problematic image URLs
     */
    async clearProblematicUrls(): Promise<void> {
        await this.init();
        
        const problematicDomains = ['bl.digirati.io', 'iiif.bl.uk'];
        for (const domain of problematicDomains) {
            await this.clearDomain(domain);
        }
    }
}