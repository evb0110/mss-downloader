import { promises as fs } from 'fs';
import path from 'path';
import { app } from 'electron';
import { configService } from './ConfigService.js';

export class ManifestCache {
    private cacheDir: string;
    private cacheFile: string;
    private cache = new Map<string, { manifest: any; timestamp: number }>();
    private maxAge = 24 * 60 * 60 * 1000; // 24 hours
    private initialized = false;

    constructor() {
        const userDataPath = app.getPath('userData');
        this.cacheDir = path.join(userDataPath, configService.cacheDir);
        this.cacheFile = path.join(this.cacheDir, 'manifests.json');
    }

    async init(): Promise<void> {
        if (this.initialized) return;
        
        try {
            await fs.mkdir(this.cacheDir, { recursive: true });
            
            try {
                const data = await fs.readFile(this.cacheFile, 'utf-8');
                const cached = JSON.parse(data);
                
                // Convert back to Map and filter expired entries
                const now = Date.now();
                for (const [key, value] of Object.entries(cached) as [string, any][]) {
                    if (now - value.timestamp < this.maxAge) {
                        this.cache.set(key, value);
                    }
                }
            } catch {
                // Cache file doesn't exist or is invalid
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
        });
        
        await this.save();
    }

    private async save(): Promise<void> {
        try {
            const cacheObject = Object.fromEntries(this.cache);
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
}