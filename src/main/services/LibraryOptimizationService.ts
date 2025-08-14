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
        'toronto': {
            maxConcurrentDownloads: 4, // University of Toronto has good IIIF v2.0 infrastructure
            timeoutMultiplier: 1.3, // Slightly extended timeout for IIIF manifest processing
            enableProgressiveBackoff: true,
            optimizationDescription: 'University of Toronto optimizations: 4 concurrent downloads, IIIF v2.0 compliant, Thomas Fisher Rare Book Library'
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
        'morgan': {
            maxConcurrentDownloads: 2, // Reduced concurrency for ZIF file processing
            timeoutMultiplier: 4.0, // Extended timeout for large ZIF file downloads and processing
            enableProgressiveBackoff: true, // Enable backoff for server stability
            autoSplitThresholdMB: 300, // Lower threshold due to ZIF processing overhead
            optimizationDescription: 'Morgan Library optimizations: 2 concurrent downloads, 4x timeout for ZIF processing, auto-split at 300MB'
        },
        'gallica': {},
        'grenoble': {
            maxConcurrentDownloads: 3, // Moderate concurrent downloads for Gallica-based infrastructure
            timeoutMultiplier: 1.5, // Extended timeout for SSL bypass and resolution testing
            enableProgressiveBackoff: true,
            optimizationDescription: 'Grenoble Municipal Library optimizations: 3 concurrent downloads, SSL bypass support, maximum resolution detection'
        },
        'karlsruhe': {
            maxConcurrentDownloads: 4, // Good performance with webcache infrastructure
            timeoutMultiplier: 1.2, // Standard timeout for reliable German infrastructure
            enableProgressiveBackoff: true,
            optimizationDescription: 'Karlsruhe BLB optimizations: 4 concurrent downloads, direct webcache/2000/ access, ultra-high resolution (2000x2801px, 5.6MP)'
        },
        'manchester': {
            maxConcurrentDownloads: 4, // Excellent IIIF v2.0 infrastructure
            timeoutMultiplier: 1.3, // Slightly extended timeout for large high-resolution images
            enableProgressiveBackoff: true,
            optimizationDescription: 'Manchester Digital Collections optimizations: 4 concurrent downloads, ultra-high resolution (4000-6500px), John Rylands Library'
        },
        'saint_omer': {
            maxConcurrentDownloads: 3, // Moderate concurrent downloads for municipal library infrastructure
            timeoutMultiplier: 1.4, // Extended timeout for high-resolution medieval manuscripts
            enableProgressiveBackoff: true,
            optimizationDescription: 'Saint-Omer Municipal Library optimizations: 3 concurrent downloads, IIIF v2.0, medieval manuscripts (5000-7000px resolution)'
        },
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
        'bodleian': {
            maxConcurrentDownloads: 3, // Bodleian Digital Library standard concurrency
            timeoutMultiplier: 1.5, // Extended timeout for large manuscript processing
            enableProgressiveBackoff: true,
            optimizationDescription: 'Bodleian Library optimizations: 3 concurrent downloads, extended timeouts for large manuscripts'
        },
        'florus': {},
        'cudl': {},
        'isos': {},
        'mira': {},
        'manuscripta': {},
        'graz': {
            maxConcurrentDownloads: 2, // Austrian university server, moderate limits
            timeoutMultiplier: 3.0, // Increased timeout for large IIIF manifests (283KB+) and Windows compatibility
            enableProgressiveBackoff: true,
            optimizationDescription: 'University of Graz optimizations: 2 concurrent downloads, extended timeouts (3x) for large IIIF manifests and Windows compatibility'
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
            timeoutMultiplier: 3.0, // Much longer timeout - Berlin manifests are very slow
            optimizationDescription: 'Berlin State Library optimizations: 3 concurrent downloads, 3x timeout for slow IIIF manifests'
        },
        'loc': {
            maxConcurrentDownloads: 4, // Reduced from 8 for stability - prevents server throttling and hanging
            timeoutMultiplier: 3.0, // Increased to 3.0 to handle large manifests (688KB+) and slower connections
            enableProgressiveBackoff: true, // Enable adaptive retry delays for problematic pages
            autoSplitThresholdMB: 500, // Split large manuscripts to prevent memory issues
            optimizationDescription: 'Library of Congress optimizations: 4 concurrent downloads with progressive backoff, 90s timeout for large manifests, enhanced stability'
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
            // Removed concurrency cap to respect user/global settings fully
            timeoutMultiplier: 2.5, // Extended timeout for unstable IIIF server
            enableProgressiveBackoff: true,
            optimizationDescription: 'BDL optimizations: extended timeouts with progressive backoff'
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
        'omnes_vallicelliana': {
            maxConcurrentDownloads: 4, // Omnes Vallicelliana IIIF v2 service with good performance
            timeoutMultiplier: 1.2, // Standard timeout, server responds well
            optimizationDescription: 'Omnes Vallicelliana optimizations: 4 concurrent downloads, IIIF v2 manifest-based access with full resolution support'
        },
        'verona': {
            maxConcurrentDownloads: 3, // Verona IIIF service via NBM
            timeoutMultiplier: 1.5, // Increased timeout for complex URL mapping and IIIF manifest processing
            enableProgressiveBackoff: true,
            optimizationDescription: 'Verona NBM optimizations: 3 concurrent downloads, extended timeouts for large manuscripts (200+ pages), dynamic IIIF manifest discovery'
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
            maxConcurrentDownloads: 8, // BNE supports high concurrency with direct PDF access
            timeoutMultiplier: 1.5, // Extended timeout for page discovery and image downloads
            optimizationDescription: 'BNE optimizations: 8 concurrent downloads (direct PDF access), extended timeouts for page discovery'
        },
        'mdc_catalonia': {
            maxConcurrentDownloads: 2, // Reduced due to recent network stability issues
            timeoutMultiplier: 3.0, // Significantly increased timeout for network connectivity issues
            enableProgressiveBackoff: true, // Critical for handling intermittent connection failures
            optimizationDescription: 'MDC Catalonia optimizations: 2 concurrent downloads, extended timeouts for network stability, progressive backoff for connection issues'
        },
        'bvpb': {
            maxConcurrentDownloads: 3, // BVPB with pagination traversal needs moderate concurrency
            timeoutMultiplier: 2.0, // Extended timeout for pagination discovery and image downloads
            optimizationDescription: 'BVPB optimizations: 3 concurrent downloads, extended timeouts for pagination traversal and high-resolution manuscript downloads'
        },
        'onb': {
            maxConcurrentDownloads: 4, // ONB IIIF v3 with excellent infrastructure
            timeoutMultiplier: 1.0, // Standard timeout - reliable infrastructure
            optimizationDescription: 'ONB optimizations: 4 concurrent downloads, standard IIIF v3 performance with maximum resolution support'
        },
        'rouen': {
            maxConcurrentDownloads: 3, // French municipal library with good performance
            timeoutMultiplier: 1.5, // Extended timeout for session management and page discovery
            optimizationDescription: 'Rouen Municipal Library optimizations: 3 concurrent downloads, extended timeouts for session management and high-resolution downloads'
        },
        'freiburg': {
            maxConcurrentDownloads: 4, // University of Freiburg with excellent IIIF infrastructure
            timeoutMultiplier: 1.2, // Slightly extended timeout for METS XML parsing and IIIF API calls
            optimizationDescription: 'University of Freiburg optimizations: 4 concurrent downloads, METS/MODS metadata parsing with maximum resolution IIIF support'
        },
        'fulda': {
            maxConcurrentDownloads: 4, // Fulda University of Applied Sciences with IIIF v2.0 API
            timeoutMultiplier: 1.3, // Extended timeout for IIIF manifest processing and maximum quality downloads
            enableProgressiveBackoff: true,
            optimizationDescription: 'Fulda University optimizations: 4 concurrent downloads, IIIF v2.0 with direct manifest API, maximum resolution support'
        },
        'wolfenbuettel': {
            maxConcurrentDownloads: 4, // Herzog August Bibliothek Wolfenbüttel with stable HTTP endpoints
            timeoutMultiplier: 1.2, // Slightly extended timeout for page discovery and high-resolution downloads
            enableProgressiveBackoff: true,
            optimizationDescription: 'Wolfenbüttel HAB optimizations: 4 concurrent downloads, dynamic page discovery, maximum resolution support'
        },
        'hhu': {
            maxConcurrentDownloads: 4, // HHU Düsseldorf with IIIF v2.0 infrastructure
            timeoutMultiplier: 1.3, // Slightly extended timeout for high-resolution images
            enableProgressiveBackoff: true,
            optimizationDescription: 'HHU Düsseldorf optimizations: 4 concurrent downloads, IIIF v2.0 with maximum resolution support (up to 4879x6273px)'
        },
        'florence': {
            maxConcurrentDownloads: 3, // Florence ContentDM with progressive retry logic
            timeoutMultiplier: 2.0, // Extended timeout for JavaScript execution timing
            enableProgressiveBackoff: true,
            optimizationDescription: 'Florence ContentDM optimizations: 3 concurrent downloads, progressive timeout increases, enhanced retry logic'
        },
        'gams': {
            maxConcurrentDownloads: 3, // GAMS University of Graz with context-based IIIF
            timeoutMultiplier: 1.5, // Extended timeout for IIIF manifest processing
            enableProgressiveBackoff: true,
            optimizationDescription: 'GAMS University of Graz optimizations: 3 concurrent downloads, context-based IIIF support, extended timeouts'
        },
        'vatican': {
            maxConcurrentDownloads: 4, // Vatican Library with stable IIIF infrastructure
            timeoutMultiplier: 1.2, // Standard timeout for reliable servers
            enableProgressiveBackoff: true,
            optimizationDescription: 'Vatican Library optimizations: 4 concurrent downloads, IIIF compliant, stable infrastructure'
        },
        'bordeaux': {},
        'linz': {},
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
        maxConcurrentDownloads: number | undefined;
        timeoutMultiplier: number;
        enableProgressiveBackoff: boolean;
        optimizationDescription?: string;
    } {
        const libraryOpts = this.getOptimizationsForLibrary(library);

        // Determine max concurrency override for this library only (do not echo global as a cap)
        let libraryMaxConcurrent: number | undefined = undefined;
        if (typeof libraryOpts.maxConcurrentDownloads === 'number' && libraryOpts.maxConcurrentDownloads > 0) {
            if (globalMaxConcurrent && Number.isInteger(globalMaxConcurrent) && globalMaxConcurrent > 0) {
                libraryMaxConcurrent = Math.min(libraryOpts.maxConcurrentDownloads, globalMaxConcurrent);
            } else {
                libraryMaxConcurrent = libraryOpts.maxConcurrentDownloads;
            }
        }

        return {
            autoSplitThresholdMB: libraryOpts.autoSplitThresholdMB || globalAutoSplitThresholdMB,
            maxConcurrentDownloads: libraryMaxConcurrent,
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
        return Object.keys(opts)?.length > 0;
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