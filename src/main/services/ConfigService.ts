import Store from 'electron-store';

// Constants for size calculations
const KB = 1024;
const MB = KB * 1024;

export interface AppConfig {
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
    maxMemoryUsage: number; // bytes
  
    // Timeouts
    requestTimeout: number; // ms
    manifestTimeout: number; // ms

    // UI settings
    language: string;
    theme: string;
    
    // BDL Ultra-Reliable Mode settings
    bdlUltraReliableMode: boolean;
    bdlMaxRetries: number; // -1 for unlimited
    bdlMinVerificationSize: number; // Minimum bytes for valid image
    bdlProxyHealthCheck: boolean;
    bdlPostVerification: boolean;
    bdlPersistentQueue: boolean;
}

const defaultConfig: AppConfig = {
    // Download settings
    maxConcurrentDownloads: 3, // Reduced for better rate limit compliance
    maxRetries: 10,
    retryDelayBase: 1000,
    retryDelayMax: 30000,
  
    // Auto-split settings
    autoSplitThreshold: 300 * MB, // 300MB in bytes
    adaptiveSplitThreshold: 1.5,
  
    // Size monitoring
    sizeVarianceThreshold: 0.3,
    minImagesForAdaptive: 10,
  
    // Progress reporting
    progressUpdateInterval: 1000,
  
    // PDF processing
    maxMemoryUsage: 2 * KB * MB, // 2GB
  
    // Timeouts
    requestTimeout: 30000,
    manifestTimeout: 10000,

    // UI settings
    language: 'en',
    theme: 'system',
    
    // BDL Ultra-Reliable Mode settings
    bdlUltraReliableMode: true, // Enabled by default for BDL
    bdlMaxRetries: -1, // Unlimited retries by default
    bdlMinVerificationSize: 10240, // 10KB minimum for valid image
    bdlProxyHealthCheck: true, // Test proxies before use
    bdlPostVerification: true, // Verify and re-download after initial pass
    bdlPersistentQueue: true // Save failed pages for retry across sessions
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
        return this.store.get(key);
    }

    set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
        this.store.set(key, value);
    }

    getAll(): AppConfig {
        return this.store.store;
    }

    setMultiple(updates: Partial<AppConfig>): void {
        for (const [key, value] of Object.entries(updates)) {
            this.store.set(key as keyof AppConfig, value as AppConfig[keyof AppConfig]);
        }
    }

    reset(): void {
        this.store.clear();
        // Restore defaults
        for (const [key, value] of Object.entries(defaultConfig)) {
            this.store.set(key as keyof AppConfig, value as AppConfig[keyof AppConfig]);
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