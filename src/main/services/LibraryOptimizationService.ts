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
            maxConcurrentDownloads: 3, // Reduced concurrent downloads due to very slow servers
            timeoutMultiplier: 2.5, // Increased from 1.5 to 2.5 (30s * 2.5 = 75s) to handle 10+ second image responses
            enableProgressiveBackoff: true,
            autoSplitThresholdMB: 400, // Lower threshold for large manuscripts to prevent timeouts
            optimizationDescription: 'Internet Culturale optimizations: 3 concurrent downloads, extended 75s timeouts with progressive backoff for slow image servers, auto-split at 400MB'
        },
        // Default libraries (no special optimizations)
        'nypl': {},
        'morgan': {},
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
        'graz': {
            maxConcurrentDownloads: 2, // Austrian university server, moderate limits
            timeoutMultiplier: 2.0, // Standard timeout for IIIF manifests
            enableProgressiveBackoff: true,
            optimizationDescription: 'University of Graz optimizations: 2 concurrent downloads, standard timeouts with progressive backoff'
        },
        'cologne': {
            maxConcurrentDownloads: 3, // German library server, moderate limits
            timeoutMultiplier: 1.5, // Increased timeout for JavaScript protection handling
            optimizationDescription: 'Cologne Dom Library optimizations: 3 concurrent downloads, extended timeouts for JS protection'
        },
        'vienna_manuscripta': {
            maxConcurrentDownloads: 2, // Austrian National Library server, moderate limits
            timeoutMultiplier: 1.5, // Increased timeout for manifest parsing
            optimizationDescription: 'Vienna Manuscripta optimizations: 2 concurrent downloads, extended timeouts for page discovery'
        },
        'rome': {
            maxConcurrentDownloads: 2, // Reduced due to infrastructure instability (digitale.bnc.roma.sbn.it network issues)
            timeoutMultiplier: 3.0, // Significantly increased timeout for infrastructure reliability issues
            enableProgressiveBackoff: true, // Critical for handling server infrastructure failures
            optimizationDescription: 'Rome National Library optimizations: 2 concurrent downloads, extended timeouts for infrastructure stability, progressive backoff for server failures'
        },
        'berlin': {
            maxConcurrentDownloads: 3, // German State Library server, moderate limits
            timeoutMultiplier: 1.5, // Increased timeout for IIIF manifest processing
            optimizationDescription: 'Berlin State Library optimizations: 3 concurrent downloads, extended timeouts for IIIF manifest processing'
        },
        'czech': {
            maxConcurrentDownloads: 2, // Czech library server, conservative limits
            timeoutMultiplier: 2.0, // Double timeout for page discovery
            enableProgressiveBackoff: true,
            optimizationDescription: 'Czech Digital Library optimizations: 2 concurrent downloads, extended timeouts for page discovery (Experimental)'
        },
        'modena': {
            maxConcurrentDownloads: 3, // Modena Diocesan Archive, mobile images
            timeoutMultiplier: 1.5, // Increased timeout for mobile interface discovery
            optimizationDescription: 'Modena Diocesan Archive optimizations: 3 concurrent downloads, Flash bypass via mobile interface'
        },
        'bdl': {
            maxConcurrentDownloads: 2, // Reduced due to IIIF server instability
            timeoutMultiplier: 2.5, // Extended timeout for unstable IIIF server
            enableProgressiveBackoff: true, // Critical for handling connection failures
            optimizationDescription: 'BDL optimizations: 2 concurrent downloads, extended timeouts, progressive backoff for IIIF server instability'
        },
        'monte_cassino': {
            maxConcurrentDownloads: 3, // Monte Cassino IIIF service
            timeoutMultiplier: 1.5, // Increased timeout for IIIF manifest processing
            optimizationDescription: 'Monte Cassino optimizations: 3 concurrent downloads, extended timeouts for IIIF manifests'
        },
        'vallicelliana': {
            maxConcurrentDownloads: 4, // Vallicelliana IIIF v3 DAM service
            timeoutMultiplier: 1.3, // Slightly increased timeout for DAM platform
            optimizationDescription: 'Vallicelliana Library optimizations: 4 concurrent downloads, DAM platform compatibility'
        },
        'verona': {
            maxConcurrentDownloads: 3, // Verona IIIF service via NBM
            timeoutMultiplier: 1.5, // Increased timeout for complex URL mapping and IIIF manifest processing
            optimizationDescription: 'Verona Biblioteca Manoscritta optimizations: 3 concurrent downloads, extended timeouts for complex interface'
        },
        'europeana': {
            maxConcurrentDownloads: 4, // Europeana IIIF aggregator with good performance
            timeoutMultiplier: 1.0, // Standard timeout for well-maintained IIIF service
            optimizationDescription: 'Europeana Collections optimizations: 4 concurrent downloads, IIIF manifest-based access'
        },
        'e_manuscripta': {
            maxConcurrentDownloads: 3, // Swiss e-manuscripta platform with good infrastructure
            timeoutMultiplier: 1.2, // Slightly increased timeout for webcache system
            optimizationDescription: 'e-manuscripta.ch optimizations: 3 concurrent downloads, webcache-based access'
        },
        'diamm': {
            maxConcurrentDownloads: 3, // DIAMM IIIF service with good performance
            timeoutMultiplier: 1.5, // Extended timeout for large medieval music manuscript images
            optimizationDescription: 'DIAMM optimizations: 3 concurrent downloads, extended timeouts for high-resolution medieval music manuscripts'
        },
        'bne': {
            maxConcurrentDownloads: 3, // BNE Spanish National Library with good performance
            timeoutMultiplier: 1.5, // Extended timeout for page discovery and image downloads
            optimizationDescription: 'BNE optimizations: 3 concurrent downloads, extended timeouts for page discovery'
        },
        'belgica_kbr': {
            maxConcurrentDownloads: 3, // Belgica KBR with good performance
            timeoutMultiplier: 2.0, // Extended timeout for multi-step URL resolution and directory listing
            optimizationDescription: 'Belgica KBR optimizations: 3 concurrent downloads, extended timeouts for URL resolution and directory listing'
        },
        'mdc_catalonia': {
            maxConcurrentDownloads: 4, // MDC Catalonia IIIF service with excellent performance
            timeoutMultiplier: 1.2, // Slightly extended timeout for IIIF API calls
            optimizationDescription: 'MDC Catalonia optimizations: 4 concurrent downloads, IIIF-based access with excellent performance'
        },
        'bvpb': {
            maxConcurrentDownloads: 3, // BVPB with pagination traversal needs moderate concurrency
            timeoutMultiplier: 2.0, // Extended timeout for pagination discovery and image downloads
            optimizationDescription: 'BVPB optimizations: 3 concurrent downloads, extended timeouts for pagination traversal and high-resolution manuscript downloads'
        },
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
            autoSplitThresholdMB: libraryOpts.autoSplitThresholdMB || globalAutoSplitThresholdMB,
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