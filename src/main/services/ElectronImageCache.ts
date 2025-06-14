import { promises as fs } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { createHash } from 'crypto';

const CACHE_EXPIRY_DAYS = 7;
const MAX_CACHE_SIZE_MB = 500;
const CACHE_CLEANUP_INTERVAL_HOURS = 24;

interface CacheEntry {
  url: string;
  library: string;
  timestamp: number;
  size: number;
  filePath: string;
}

export class ElectronImageCache {
  private cacheDir: string;
  private metadataFile: string;
  private metadata: Map<string, CacheEntry> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.cacheDir = join(app.getPath('userData'), 'image-cache');
    this.metadataFile = join(this.cacheDir, 'metadata.json');
    this.init();
  }

  private async init(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      await this.loadMetadata();
      await this.cleanExpiredEntries();
      this.startPeriodicCleanup();
    } catch (error) {
      console.error('Failed to initialize image cache:', error);
    }
  }

  private async loadMetadata(): Promise<void> {
    try {
      const data = await fs.readFile(this.metadataFile, 'utf-8');
      const entries = JSON.parse(data) as CacheEntry[];
      this.metadata = new Map(entries.map(entry => [entry.url, entry]));
    } catch (error) {
      this.metadata = new Map();
    }
  }

  private async saveMetadata(): Promise<void> {
    const entries = Array.from(this.metadata.values());
    await fs.writeFile(this.metadataFile, JSON.stringify(entries, null, 2));
  }

  private getFileHash(url: string): string {
    return createHash('md5').update(url).digest('hex');
  }

  private getFilePath(url: string): string {
    const hash = this.getFileHash(url);
    return join(this.cacheDir, `${hash}.cache`);
  }

  async getCachedImage(url: string): Promise<Buffer | null> {
    const entry = this.metadata.get(url);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    if (isExpired) {
      await this.removeEntry(url);
      return null;
    }

    try {
      return await fs.readFile(entry.filePath);
    } catch (error) {
      await this.removeEntry(url);
      return null;
    }
  }

  async cacheImage(url: string, imageData: Buffer, library: string): Promise<void> {
    const filePath = this.getFilePath(url);
    
    try {
      await fs.writeFile(filePath, imageData);
      
      const entry: CacheEntry = {
        url,
        library,
        timestamp: Date.now(),
        size: imageData.length,
        filePath,
      };

      this.metadata.set(url, entry);
      await this.saveMetadata();
      
      await this.enforceSpaceLimit();
    } catch (error) {
      console.error('Failed to cache image:', error);
    }
  }

  private async removeEntry(url: string): Promise<void> {
    const entry = this.metadata.get(url);
    if (!entry) return;

    try {
      await fs.unlink(entry.filePath);
    } catch (error) {
      // File might not exist, ignore
    }

    this.metadata.delete(url);
    await this.saveMetadata();
  }

  private async cleanExpiredEntries(): Promise<void> {
    const expiredUrls: string[] = [];
    const cutoff = Date.now() - CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    for (const [url, entry] of this.metadata) {
      if (entry.timestamp < cutoff) {
        expiredUrls.push(url);
      }
    }

    for (const url of expiredUrls) {
      await this.removeEntry(url);
    }

    if (expiredUrls.length > 0) {
      console.log(`Cleaned up ${expiredUrls.length} expired cache entries`);
    }
  }

  private async enforceSpaceLimit(): Promise<void> {
    const totalSize = Array.from(this.metadata.values())
      .reduce((sum, entry) => sum + entry.size, 0);

    const maxSizeBytes = MAX_CACHE_SIZE_MB * 1024 * 1024;
    
    if (totalSize <= maxSizeBytes) return;

    const entries = Array.from(this.metadata.values())
      .sort((a, b) => a.timestamp - b.timestamp);

    let currentSize = totalSize;
    for (const entry of entries) {
      if (currentSize <= maxSizeBytes) break;
      
      await this.removeEntry(entry.url);
      currentSize -= entry.size;
    }

    console.log(`Cache size reduced from ${Math.round(totalSize / 1024 / 1024)}MB to ${Math.round(currentSize / 1024 / 1024)}MB`);
  }

  async clearCache(): Promise<void> {
    try {
      // Clear main cache files
      const files = await fs.readdir(this.cacheDir);
      for (const file of files) {
        if (file !== 'metadata.json') {
          await fs.unlink(join(this.cacheDir, file));
        }
      }
      
      // Clear temporary images folder
      const tempImagesDir = join(app.getPath('userData'), 'temp-images');
      try {
        const tempFiles = await fs.readdir(tempImagesDir);
        for (const file of tempFiles) {
          await fs.unlink(join(tempImagesDir, file));
        }
        console.log('Temporary images cleared');
      } catch (error) {
        // Temp folder might not exist, ignore
      }
      
      this.metadata.clear();
      await this.saveMetadata();
      
      console.log('Image cache cleared');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      throw error;
    }
  }

  private startPeriodicCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanExpiredEntries();
    }, CACHE_CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000);
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  getCacheStats(): { entries: number; totalSizeMB: number; oldestEntry: Date | null } {
    const entries = Array.from(this.metadata.values());
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const oldestTimestamp = Math.min(...entries.map(e => e.timestamp));
    
    return {
      entries: entries.length,
      totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
      oldestEntry: entries.length > 0 ? new Date(oldestTimestamp) : null,
    };
  }
}