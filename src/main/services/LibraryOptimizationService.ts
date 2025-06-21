import type { TLibrary, LibraryOptimizationSettings } from '../../shared/queueTypes';

export class LibraryOptimizationService {
    private static readonly LIBRARY_OPTIMIZATIONS: Record<TLibrary, LibraryOptimizationSettings> = {
        // High-performance libraries that need special handling
        'parker': {
            autoSplitThresholdMB: 500, // Minimum 500MB for Parker Stanford
            maxConcurrentDownloads: 2, // Maximum 2 concurrent downloads
            timeoutMultiplier: 2.0, // Double timeout for slow servers
            enableProgressiveBackoff: true,
            optimizationDescription: 'Stanford Parker Library optimizations: 500MB split threshold, 2 concurrent downloads, extended timeouts'
        },
        'rbme': {
            autoSplitThresholdMB: 500, // Minimum 500MB for RBME
            maxConcurrentDownloads: 2, // Maximum 2 concurrent downloads
            timeoutMultiplier: 1.5, // Increased timeout
            enableProgressiveBackoff: true,
            optimizationDescription: 'Real Biblioteca del Monasterio de El Escorial optimizations: 500MB split threshold, 2 concurrent downloads, extended timeouts'
        },
        // Slow or rate-limited libraries
        'trinity_cam': {
            maxConcurrentDownloads: 1, // Very slow server
            timeoutMultiplier: 4.0, // 4x timeout for extremely slow server
            optimizationDescription: 'Trinity Cambridge optimizations: single-threaded downloads, 4x timeout for slow servers'
        },
        'orleans': {
            maxConcurrentDownloads: 2, // Moderate rate limiting
            timeoutMultiplier: 2.0, // Double timeout
            enableProgressiveBackoff: true,
            optimizationDescription: 'Orléans Médiathèques optimizations: 2 concurrent downloads, extended timeouts with backoff'
        },
        'unicatt': {
            maxConcurrentDownloads: 2, // Geo-restricted, needs careful handling
            timeoutMultiplier: 1.5,
            optimizationDescription: 'Unicatt Ambrosiana optimizations: 2 concurrent downloads, extended timeouts'
        },
        'internet_culturale': {
            maxConcurrentDownloads: 3, // Italian platform with moderate limits
            timeoutMultiplier: 1.5,
            optimizationDescription: 'Internet Culturale optimizations: 3 concurrent downloads, extended timeouts'
        },
        // Default libraries (no special optimizations)
        'gallica': {},
        'unifr': {},
        'vatlib': {},
        'cecilia': {},
        'irht': {},
        'dijon': {},
        'laon': {},
        'durham': {},
        'sharedcanvas': {},
        'ugent': {},
        'bl': {},
        'florus': {},
        'cudl': {},
        'isos': {},
        'mira': {},
        'manuscripta': {},
        'graz': {},
        'loading': {}
    };

    /**
     * Get optimization settings for a specific library
     */
    static getOptimizationsForLibrary(library: TLibrary): LibraryOptimizationSettings {
        return this.LIBRARY_OPTIMIZATIONS[library] || {};
    }

    /**
     * Apply library-specific optimizations to global settings
     */
    static applyOptimizations(
        globalAutoSplitThresholdMB: number,
        globalMaxConcurrent: number,
        library: TLibrary
    ): {
        autoSplitThresholdMB: number;
        maxConcurrentDownloads: number;
        timeoutMultiplier: number;
        enableProgressiveBackoff: boolean;
        optimizationDescription?: string;
    } {
        const libraryOpts = this.getOptimizationsForLibrary(library);

        return {
            autoSplitThresholdMB: Math.max(
                libraryOpts.autoSplitThresholdMB || globalAutoSplitThresholdMB,
                globalAutoSplitThresholdMB
            ),
            maxConcurrentDownloads: Math.min(
                libraryOpts.maxConcurrentDownloads || globalMaxConcurrent,
                globalMaxConcurrent
            ),
            timeoutMultiplier: libraryOpts.timeoutMultiplier || 1.0,
            enableProgressiveBackoff: libraryOpts.enableProgressiveBackoff || false,
            optimizationDescription: libraryOpts.optimizationDescription
        };
    }

    /**
     * Calculate progressive backoff delay with exponential increase
     */
    static calculateProgressiveBackoff(
        attempt: number, 
        baseDelayMs: number = 1000,
        maxDelayMs: number = 30000
    ): number {
        if (attempt <= 0) return 0;
        
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
        const exponentialDelay = Math.min(
            baseDelayMs * Math.pow(2, attempt - 1),
            maxDelayMs
        );
        
        // Add 20% jitter to prevent thundering herd
        const jitter = Math.random() * 0.2 * exponentialDelay;
        return Math.floor(exponentialDelay + jitter);
    }

    /**
     * Get timeout for a library with multiplier applied
     */
    static getTimeoutForLibrary(
        baseTimeout: number, 
        library: TLibrary,
        attempt: number = 1
    ): number {
        const opts = this.getOptimizationsForLibrary(library);
        let timeout = baseTimeout;
        
        // Apply library-specific timeout multiplier
        if (opts.timeoutMultiplier) {
            timeout = Math.floor(timeout * opts.timeoutMultiplier);
        }
        
        // Apply progressive backoff if enabled
        if (opts.enableProgressiveBackoff && attempt > 1) {
            const backoffMultiplier = 1 + (attempt - 1) * 0.5; // 1x, 1.5x, 2x, 2.5x...
            timeout = Math.floor(timeout * Math.min(backoffMultiplier, 3.0)); // Cap at 3x
        }
        
        return timeout;
    }

    /**
     * Check if a library has special optimizations
     */
    static hasOptimizations(library: TLibrary): boolean {
        const opts = this.getOptimizationsForLibrary(library);
        return Object.keys(opts).length > 0;
    }

    /**
     * Get all libraries with special optimizations
     */
    static getOptimizedLibraries(): TLibrary[] {
        return Object.keys(this.LIBRARY_OPTIMIZATIONS).filter(
            library => this.hasOptimizations(library as TLibrary)
        ) as TLibrary[];
    }

    /**
     * Format optimization description for UI display
     */
    static formatOptimizationDescription(library: TLibrary): string {
        const opts = this.getOptimizationsForLibrary(library);
        return opts.optimizationDescription || '';
    }
}