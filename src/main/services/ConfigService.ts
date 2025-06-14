import Store from 'electron-store';

interface AppConfig {
    // Download settings
    maxConcurrentDownloads: number;
    maxRetries: number;
    retryDelayBase: number; // Base delay in ms
    retryDelayMax: number; // Max delay in ms
  
    // Auto-split settings
    autoSplitThreshold: number; // bytes
    adaptiveSplitThreshold: number; // 1.5x for adaptive splitting
  
    // Size monitoring
    sizeVarianceThreshold: number; // 30% variance threshold
    minImagesForAdaptive: number; // Minimum images before adaptive splitting
  
    // Progress reporting
    progressUpdateInterval: number; // Console update interval in ms
  
    // PDF processing
    pdfQuality: number;
    maxMemoryUsage: number; // bytes
  
    // Timeouts
    requestTimeout: number; // ms
    manifestTimeout: number; // ms

    // UI settings
    language: string;
    theme: string;
}

const defaultConfig: AppConfig = {
    // Download settings
    maxConcurrentDownloads: 3, // Reduced for better rate limit compliance
    maxRetries: 10,
    retryDelayBase: 1000,
    retryDelayMax: 30000,
  
    // Auto-split settings
    autoSplitThreshold: 800 * 1024 * 1024, // 800MB in bytes
    adaptiveSplitThreshold: 1.5,
  
    // Size monitoring
    sizeVarianceThreshold: 0.3,
    minImagesForAdaptive: 10,
  
    // Progress reporting
    progressUpdateInterval: 1000,
  
    // PDF processing
    pdfQuality: 0.9,
    maxMemoryUsage: 2 * 1024 * 1024 * 1024, // 2GB
  
    // Timeouts
    requestTimeout: 30000,
    manifestTimeout: 10000,

    // UI settings
    language: 'en',
    theme: 'system'
};

export class ConfigService {
    private store: Store<AppConfig>;

    constructor() {
        this.store = new Store<AppConfig>({
            defaults: defaultConfig,
            name: 'config'
        });
    }

    get<K extends keyof AppConfig>(key: K): AppConfig[K] {
        return (this.store as any).get(key);
    }

    set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
        (this.store as any).set(key, value);
    }

    getAll(): AppConfig {
        return (this.store as any).store;
    }

    setMultiple(updates: Partial<AppConfig>): void {
        for (const [key, value] of Object.entries(updates)) {
            (this.store as any).set(key as keyof AppConfig, value as any);
        }
    }

    reset(): void {
        (this.store as any).clear();
        // Restore defaults
        for (const [key, value] of Object.entries(defaultConfig)) {
            (this.store as any).set(key as keyof AppConfig, value as any);
        }
    }

    // Computed getters for common path operations
    get downloadsDir(): string {
        return 'downloads'; // Will be joined with userData path
    }

    get queueFile(): string {
        return 'queue.json';
    }

    get cacheDir(): string {
        return 'cache';
    }
}

// Export singleton instance
export const configService = new ConfigService();