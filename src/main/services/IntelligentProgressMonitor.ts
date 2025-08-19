/**
 * Intelligent Progress Monitoring System
 * 
 * This service provides intelligent timeout and progress monitoring for long-running
 * download operations with sophisticated progress detection and user feedback.
 */

export interface ProgressMonitorConfig {
    /** Initial timeout in milliseconds before progress monitoring starts */
    initialTimeout: number;
    /** Interval in milliseconds for checking progress */
    progressCheckInterval: number;
    /** Maximum total timeout in milliseconds */
    maxTimeout: number;
    /** Minimum progress threshold to consider operation as progressing */
    minProgressThreshold: number;
    /** Library-specific identifier for optimized settings */
    library?: string;
    /** Operation name for user feedback */
    operationName: string;
}

export interface ProgressState {
    /** Current progress value */
    current: number;
    /** Total expected value */
    total: number;
    /** Timestamp of last progress update */
    lastUpdate: number;
    /** Whether operation is considered stuck */
    isStuck: boolean;
    /** User-friendly status message */
    statusMessage: string;
}

export interface ProgressMonitorCallbacks {
    /** Called when initial timeout expires but operation may still be progressing */
    onInitialTimeoutReached?: (state: ProgressState) => void;
    /** Called when progress is detected after being stuck */
    onProgressResumed?: (state: ProgressState) => void;
    /** Called when operation appears to be stuck */
    onStuckDetected?: (state: ProgressState) => void;
    /** Called when operation times out completely */
    onTimeout?: (state: ProgressState) => void;
    /** Called with regular progress updates */
    onProgressUpdate?: (state: ProgressState) => void;
    /** Called when operation completes successfully */
    onComplete?: (state: ProgressState) => void;
}

/**
 * Intelligent Progress Monitor that adapts to different libraries and operations
 */
export class IntelligentProgressMonitor {
    private config: ProgressMonitorConfig;
    private callbacks: ProgressMonitorCallbacks;
    private state: ProgressState;
    private abortController: AbortController;
    private initialTimeoutId?: NodeJS.Timeout;
    private progressCheckIntervalId?: NodeJS.Timeout;
    private isRunning: boolean = false;
    private startTime: number;

    constructor(config: ProgressMonitorConfig, callbacks: ProgressMonitorCallbacks = {}) {
        this.config = this.optimizeConfigForLibrary(config);
        this.callbacks = callbacks;
        this.abortController = new AbortController();
        this.startTime = Date.now();
        
        this.state = {
            current: 0,
            total: config.library === 'graz' ? 1 : 100, // Graz typically loads unknown manifest size
            lastUpdate: this.startTime,
            isStuck: false,
            statusMessage: `Starting ${config.operationName}...`
        };
    }

    /**
     * Optimize configuration based on library-specific characteristics
     */
    private optimizeConfigForLibrary(config: ProgressMonitorConfig): ProgressMonitorConfig {
        const optimized = { ...config };

        switch (config.library) {
            case 'graz':
                // University of Graz has very large IIIF manifests (289KB+) and slow servers
                optimized.initialTimeout = 180000; // 3 minutes - increased from 2
                optimized.progressCheckInterval = 30000; // 30 seconds
                optimized.maxTimeout = 900000; // 15 minutes - increased from 10
                optimized.minProgressThreshold = 0.01; // Even minimal progress is acceptable
                break;
            
            case 'manuscripta':
            case 'manuscripta.se':
                // Manuscripta.se can have hanging issues
                optimized.initialTimeout = 60000; // 1 minute
                optimized.progressCheckInterval = 15000; // 15 seconds
                optimized.maxTimeout = 300000; // 5 minutes
                optimized.minProgressThreshold = 1; // Need clear progress
                break;
                
            case 'verona':
            case 'nbm':
                // NBM Italy / Verona can have large manifests and slow downloads
                optimized.initialTimeout = 90000; // 1.5 minutes
                optimized.progressCheckInterval = 10000; // 10 seconds for better feedback
                optimized.maxTimeout = 600000; // 10 minutes
                optimized.minProgressThreshold = 0.5; // Reasonable progress expected
                break;
            
            case 'arca':
                // ARCA has good IIIF v3.0 performance
                optimized.initialTimeout = 30000; // 30 seconds
                optimized.progressCheckInterval = 10000; // 10 seconds
                optimized.maxTimeout = 180000; // 3 minutes
                optimized.minProgressThreshold = 1.0;
                break;
            
            case 'internet-culturale':
                // Internet Culturale has authentication issues
                optimized.initialTimeout = 45000; // 45 seconds
                optimized.progressCheckInterval = 10000; // 10 seconds
                optimized.maxTimeout = 240000; // 4 minutes
                optimized.minProgressThreshold = 1;
                break;
            
            case 'trinity':
                // Trinity can be slow
                optimized.initialTimeout = 60000; // 1 minute
                optimized.progressCheckInterval = 20000; // 20 seconds
                optimized.maxTimeout = 360000; // 6 minutes
                optimized.minProgressThreshold = 0.5;
                break;
            
            case 'morgan':
                // Morgan Library .zif processing can be memory-intensive and slow
                optimized.initialTimeout = 90000; // 1.5 minutes for .zif download
                optimized.progressCheckInterval = 15000; // 15 seconds
                optimized.maxTimeout = 480000; // 8 minutes for full tile stitching
                optimized.minProgressThreshold = 0.1; // Any progress during stitching
                break;
            
            case 'bdl':
                // BDL has IIIF server issues causing image validation to hang
                optimized.initialTimeout = 30000; // 30 seconds for API call
                optimized.progressCheckInterval = 10000; // 10 seconds
                optimized.maxTimeout = 120000; // 2 minutes max (skip hanging validation)
                optimized.minProgressThreshold = 1; // Need clear progress
                break;
            
            case 'vienna_manuscripta':
                // Vienna Manuscripta (Klosterneuburg) can hang after downloading several manuscripts
                optimized.initialTimeout = 45000; // 45 seconds
                optimized.progressCheckInterval = 15000; // 15 seconds
                optimized.maxTimeout = 240000; // 4 minutes max to prevent hanging
                optimized.minProgressThreshold = 1; // Need clear progress
                break;
            
            case 'bne':
                // BNE Spain can hang without progress
                optimized.initialTimeout = 30000; // 30 seconds
                optimized.progressCheckInterval = 10000; // 10 seconds
                optimized.maxTimeout = 180000; // 3 minutes max to prevent hanging
                optimized.minProgressThreshold = 1; // Need clear progress
                break;
            
            case 'mdc_catalonia':
                // MDC Catalonia can have connection timeout issues
                optimized.initialTimeout = 45000; // 45 seconds
                optimized.progressCheckInterval = 15000; // 15 seconds
                optimized.maxTimeout = 300000; // 5 minutes
                optimized.minProgressThreshold = 0.5;
                break;
            
            case 'loc':
                // Library of Congress can hang on calculation
                optimized.initialTimeout = 60000; // 1 minute
                optimized.progressCheckInterval = 20000; // 20 seconds
                optimized.maxTimeout = 360000; // 6 minutes
                optimized.minProgressThreshold = 0.5;
                break;
            
            case 'hhu':
                // HHU Düsseldorf can have slow manifest loading
                optimized.initialTimeout = 60000; // 60 seconds for manifest loading
                optimized.progressCheckInterval = 15000; // 15 seconds
                optimized.maxTimeout = 300000; // 5 minutes
                optimized.minProgressThreshold = 0.8; // Allow slower progress due to large images
                break;
            
            default:
                // Default conservative settings
                optimized.initialTimeout = Math.max(30000, config.initialTimeout); // At least 30 seconds
                optimized.progressCheckInterval = Math.max(10000, config.progressCheckInterval); // At least 10 seconds
                optimized.maxTimeout = Math.max(180000, config.maxTimeout); // At least 3 minutes
                optimized.minProgressThreshold = 1;
                break;
        }

        return optimized;
    }

    /**
     * Start monitoring with the provided AbortController signal
     */
    public start(): AbortController {
        if (this.isRunning) {
            throw new Error('Progress monitor is already running');
        }

        this.isRunning = true;
        this.startTime = Date.now();
        
        // Set initial timeout
        this.initialTimeoutId = setTimeout(() => {
            this.handleInitialTimeout();
        }, this.config.initialTimeout);

        // Start progress checking
        this.startProgressChecking();

        console.log(`[ProgressMonitor] Started monitoring ${this.config.operationName} for ${this.config.library || 'unknown'} library`);
        console.log(`[ProgressMonitor] Initial timeout: ${this.config.initialTimeout}ms, Max timeout: ${this.config.maxTimeout}ms`);

        return this.abortController;
    }

    /**
     * Update progress state
     */
    public updateProgress(current: number, total?: number, customMessage?: string): void {
        if (!this.isRunning) return;

        const now = Date.now();
        const previousCurrent = this.state.current;
        const wasStuck = this.state.isStuck;

        this.state.current = current;
        if (total !== undefined) {
            this.state.total = total;
        }
        this.state.lastUpdate = now;

        // Check if progress has resumed after being stuck
        if (wasStuck && current > previousCurrent) {
            this.state.isStuck = false;
            this.state.statusMessage = customMessage || `${this.config.operationName} resumed...`;
            console.log(`[ProgressMonitor] Progress resumed: ${current}/${this.state.total}`);
            this.callbacks.onProgressResumed?.(this.state);
        } else if (!wasStuck) {
            this.state.statusMessage = customMessage || this.generateProgressMessage();
        }

        this.callbacks.onProgressUpdate?.(this.state);
    }

    /**
     * Mark operation as completed
     */
    public complete(): void {
        if (!this.isRunning) return;

        this.isRunning = false;
        this.cleanup();
        
        this.state.statusMessage = `${this.config.operationName} completed successfully`;
        this.state.current = this.state.total;
        
        console.log(`[ProgressMonitor] Operation completed after ${Date.now() - this.startTime}ms`);
        this.callbacks.onComplete?.(this.state);
    }

    /**
     * Abort the operation
     */
    public abort(): void {
        if (!this.isRunning) return;

        this.isRunning = false;
        this.cleanup();
        this.abortController.abort();
        
        console.log(`[ProgressMonitor] Operation aborted after ${Date.now() - this.startTime}ms`);
    }

    /**
     * Get current progress state
     */
    public getState(): ProgressState {
        return { ...this.state };
    }

    /**
     * Get the abort signal for external operations
     */
    public getAbortSignal(): AbortSignal {
        return this.abortController.signal;
    }

    /**
     * Check if operation is currently running
     */
    public isActive(): boolean {
        return this.isRunning;
    }

    private handleInitialTimeout(): void {
        if (!this.isRunning) return;

        const now = Date.now();
        const timeSinceStart = now - this.startTime;
        
        console.log(`[ProgressMonitor] Initial timeout reached after ${timeSinceStart}ms`);
        
        // Check if we've made any progress
        if (this.state.current > 0) {
            // We have progress, continue monitoring but inform user
            this.state.statusMessage = `${this.config.operationName} is taking longer than expected but is progressing...`;
            console.log(`[ProgressMonitor] Progress detected (${this.state.current}/${this.state.total}), continuing...`);
            this.callbacks.onInitialTimeoutReached?.(this.state);
        } else {
            // No progress yet, but let's give it more time with closer monitoring
            this.state.statusMessage = `${this.config.operationName} is taking longer than expected. Please wait...`;
            console.log(`[ProgressMonitor] No progress yet, but continuing to monitor...`);
            this.callbacks.onInitialTimeoutReached?.(this.state);
        }
    }

    private startProgressChecking(): void {
        this.progressCheckIntervalId = setInterval(() => {
            this.checkProgressStatus();
        }, this.config.progressCheckInterval);
    }

    private checkProgressStatus(): void {
        if (!this.isRunning) return;

        const now = Date.now();
        const timeSinceStart = now - this.startTime;
        const timeSinceLastUpdate = now - this.state.lastUpdate;

        // Check for maximum timeout
        if (timeSinceStart > this.config.maxTimeout) {
            this.handleMaxTimeout();
            return;
        }

        // Check if operation appears stuck
        const isCurrentlyStuck = timeSinceLastUpdate > this.config.progressCheckInterval * 2;
        
        if (isCurrentlyStuck && !this.state.isStuck) {
            // Just became stuck
            this.state.isStuck = true;
            this.state.statusMessage = `${this.config.operationName} appears to be stuck. Monitoring for recovery...`;
            console.log(`[ProgressMonitor] Operation appears stuck - no progress for ${timeSinceLastUpdate}ms`);
            this.callbacks.onStuckDetected?.(this.state);
        }

        // Update status message based on time elapsed
        if (!this.state.isStuck) {
            const minutes = Math.floor(timeSinceStart / 60000);
            if (minutes > 0) {
                this.state.statusMessage = `${this.config.operationName} in progress (${minutes}m elapsed)...`;
            }
        }
    }

    private handleMaxTimeout(): void {
        console.log(`[ProgressMonitor] Maximum timeout reached (${this.config.maxTimeout}ms)`);
        
        this.isRunning = false;
        this.cleanup();
        this.abortController.abort();
        
        this.state.statusMessage = `${this.config.operationName} timed out after ${Math.floor(this.config.maxTimeout / 60000)} minutes`;
        this.callbacks.onTimeout?.(this.state);
    }

    private generateProgressMessage(): string {
        const percentage = this.state.total > 0 ? Math.round((this.state.current / this.state.total) * 100) : 0;
        
        if (this.config.library === 'graz' && this.state.total === 1) {
            // Special handling for Graz manifest loading where total is unknown
            return `Loading ${this.config.library} manifest... (${this.state.current} items processed)`;
        }
        
        return `${this.config.operationName}: ${this.state.current}/${this.state.total} (${percentage}%)`;
    }

    private cleanup(): void {
        if (this.initialTimeoutId) {
            clearTimeout(this.initialTimeoutId);
            this.initialTimeoutId = undefined;
        }
        
        if (this.progressCheckIntervalId) {
            clearInterval(this.progressCheckIntervalId);
            this.progressCheckIntervalId = undefined;
        }
    }
}

/**
 * Factory function to create progress monitors with library-specific optimizations
 */
export function createProgressMonitor(
    operationName: string,
    library?: string,
    customConfig?: Partial<ProgressMonitorConfig>,
    callbacks?: ProgressMonitorCallbacks
): IntelligentProgressMonitor {
    const baseConfig: ProgressMonitorConfig = {
        initialTimeout: 30000, // 30 seconds default
        progressCheckInterval: 10000, // 10 seconds default
        maxTimeout: 300000, // 5 minutes default
        minProgressThreshold: 1,
        library,
        operationName,
        ...customConfig
    };

    return new IntelligentProgressMonitor(baseConfig, callbacks);
}