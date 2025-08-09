import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import path from 'path';
import { app } from 'electron';
import Store from 'electron-store';
import { EnhancedManuscriptDownloaderService } from './EnhancedManuscriptDownloaderService';
import { configService } from './ConfigService';
import { ManifestCache } from './ManifestCache';
import { LibraryOptimizationService } from './LibraryOptimizationService';
import { DownloadLogger } from './DownloadLogger';
import type { QueuedManuscript, QueueState, TLibrary, TStage, TSimultaneousMode } from '../../shared/queueTypes';

export class EnhancedDownloadQueue extends EventEmitter {
    private static instance: EnhancedDownloadQueue | null = null;
    private state: QueueState;
    private currentDownloader: EnhancedManuscriptDownloaderService | null = null;
    private activeDownloaders: Map<string, EnhancedManuscriptDownloaderService> = new Map();
    private processingAbortController: AbortController | null = null;
    private store: Store<{ queueState: QueueState }>;
    private queueFile: string;
    private manifestCache: ManifestCache;
    
    // Add proper concurrency control
    private activeDownloadCount: number = 0;
    private maxConcurrentQueueItems: number = 1; // Only process 1 queue item at a time
    private activeDownloadControllers: Map<string, AbortController> = new Map();
    
    private constructor() {
        super();
        
        // Set up queue persistence
        const userDataPath = app.getPath('userData');
        this.queueFile = path.join(userDataPath, configService.queueFile);
        
        // Define default state
        const defaultState: QueueState = {
            items: [],
            isProcessing: false,
            isPaused: false,
            activeItemIds: [],
            globalSettings: {
                autoStart: false,
                concurrentDownloads: configService.get('maxConcurrentDownloads'),
                pauseBetweenItems: 0,
                autoSplitThresholdMB: configService.get('autoSplitThreshold') / (1024 * 1024), // Convert bytes to MB
                simultaneousMode: 'sequential' as TSimultaneousMode,
                maxSimultaneousDownloads: 3,
            },
        };
        
        // Initialize store with error handling for corrupted files
        try {
            this.store = new Store<{ queueState: QueueState }>({ 
                defaults: { queueState: defaultState },
                name: 'queue'
            });
        } catch (error: any) {
            console.warn('Store corrupted, resetting:', error.message);
            // Try to clear the corrupted store file and recreate
            try {
                const storePath = path.join(userDataPath, 'queue.json');
                if (fsSync.existsSync(storePath)) {
                    fsSync.unlinkSync(storePath);
                }
            } catch {
                // Ignore file deletion errors
            }
            
            // Recreate store
            this.store = new Store<{ queueState: QueueState }>({ 
                defaults: { queueState: defaultState },
                name: 'queue'
            });
        }
        
        this.state = defaultState;
        this.manifestCache = new ManifestCache();
        this.currentDownloader = new EnhancedManuscriptDownloaderService(this.manifestCache);
        this.loadFromStorage();
    }
    
    public static getInstance(): EnhancedDownloadQueue {
        if (!EnhancedDownloadQueue.instance) {
            EnhancedDownloadQueue.instance = new EnhancedDownloadQueue();
        }
        return EnhancedDownloadQueue.instance;
    }

    // Queue persistence
    private async loadFromStorage(): Promise<void> {
        try {
            // Try to load from file first (for compatibility with web version)
            try {
                const data = await fs.readFile(this.queueFile, 'utf-8');
                const saved = JSON.parse(data);
                this.state = { 
                    ...this.state, 
                    ...saved, 
                    isProcessing: false, 
                    isPaused: false, 
                    currentItemId: undefined 
                };
                // Save to electron-store
                (this.store as any).set('queueState', this.state);
            } catch {
                // Fall back to electron-store
                this.state = (this.store as any).get('queueState', this.state);
                // Ensure proper cleanup for electron-store loaded state as well
                this.state.isProcessing = false;
                this.state.isPaused = false;
                this.state.currentItemId = undefined;
            }
            
            // Migration: ensure new properties exist in loaded state
            if (!this.state.activeItemIds) {
                this.state.activeItemIds = [];
            }
            if (!this.state.globalSettings.simultaneousMode) {
                this.state.globalSettings.simultaneousMode = 'sequential';
            }
            if (!this.state.globalSettings.maxSimultaneousDownloads) {
                this.state.globalSettings.maxSimultaneousDownloads = 3;
            }
            
            // Migration: Force auto-split threshold to 300MB if it's above that (issue #18)
            if (!this.state.globalSettings.autoSplitThresholdMB || this.state.globalSettings.autoSplitThresholdMB > 300) {
                console.log(`[EnhancedQueue] Migrating auto-split threshold from ${this.state.globalSettings.autoSplitThresholdMB || 'undefined'}MB to 300MB`);
                this.state.globalSettings.autoSplitThresholdMB = 300;
            }
            
            // Resume any in-progress items by resetting 'downloading' status to 'pending'
            // Also clean up progress data and other transient fields
            this.state.items.forEach((item) => {
                if (item.status === 'downloading') {
                    item.status = 'pending';
                    item.progress = undefined; // Clear progress data
                    item.eta = undefined; // Clear ETA
                }
                // Also clean up any paused items that might have stale progress data
                if (item.status === 'paused') {
                    item.progress = undefined;
                    item.eta = undefined;
                }
            });

            // Recalculate library optimizations for all items using current settings and code
            this.recalculateLibraryOptimizationsForAll();
            
        } catch {
            // Starting with empty queue
        }
    }

    private async saveToStorage(): Promise<void> {
        try {
            // Clean and sanitize state before saving
            const sanitizedState = this.sanitizeStateForSaving(this.state);
            const data = JSON.stringify(sanitizedState, null, 2);
            await fs.writeFile(this.queueFile, data);
            
            try {
                // Use the sanitized state for electron-store as well
                (this.store as any).set('queueState', sanitizedState);
            } catch (storeError: any) {
                console.warn('Failed to save to electron-store, but file saved successfully:', storeError.message);
            }
        } catch (error: any) {
            console.error('Failed to save queue:', error.message);
        }
    }

    private sanitizeStateForSaving(state: QueueState): QueueState {
        // Create a deep copy and remove any non-serializable properties
        const sanitized = JSON.parse(JSON.stringify(state, (_key, value) => {
            // Remove function references, AbortControllers, and other non-serializable objects
            if (typeof value === 'function' || 
                value instanceof AbortController ||
                value instanceof Error ||
                (value && typeof value === 'object' && value.constructor && 
                 !['Object', 'Array', 'Date', 'String', 'Number', 'Boolean'].includes(value.constructor.name))) {
                return undefined;
            }
            return value;
        }));
        
        return sanitized;
    }

    // Normalize URL for comparison
    private canonicalizeUrl(url: string): string {
        if (!url || typeof url !== 'string') {
            return url;
        }
        
        const trimmedUrl = url.trim().replace(/\/$/, '');
        
        // For Gallica URLs, extract ark ID and normalize
        if (trimmedUrl.includes('gallica.bnf.fr/ark:')) {
            const arkMatch = trimmedUrl.match(/ark:\/12148\/([^/]+)/);
            if (arkMatch) {
                return `https://gallica.bnf.fr/ark:/12148/${arkMatch[1]}`;
            }
        }
        
        // For other libraries, use base URL without query params
        try {
            const urlObj = new URL(trimmedUrl);
            return `${urlObj.origin}${urlObj.pathname}`;
        } catch {
            return trimmedUrl;
        }
    }

    private generateId(): string {
        return `ms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Helper to detect library from URL for logging purposes
     */
    private detectLibraryFromUrl(url: string): string | null {
        // This is a simplified version for logging - the full detection happens in EnhancedManuscriptDownloaderService
        if (url.includes('loc.gov')) return 'loc';
        if (url.includes('gallica.bnf.fr')) return 'gallica';
        if (url.includes('digi.vatlib.it')) return 'vatlib';
        if (url.includes('cudl.lib.cam.ac.uk')) return 'cudl';
        if (url.includes('parker.stanford.edu')) return 'parker';
        if (url.includes('manuscripta.se')) return 'manuscripta';
        if (url.includes('graz.at')) return 'graz';
        if (url.includes('wolfenbuettel') || url.includes('hab.de')) return 'wolfenbuettel';
        if (url.includes('digitale.bnc.roma')) return 'rome';
        if (url.includes('rbme.patrimonionacional.es')) return 'rbme';
        if (url.includes('e-codices.unifr.ch')) return 'unifr';
        if (url.includes('digitalcollections.tcd.ie')) return 'trinity_dublin';
        if (url.includes('trin.cam.ac.uk')) return 'trinity_cam';
        if (url.includes('bodleian.ox.ac.uk')) return 'bodleian';
        if (url.includes('bdl.servizirl.it')) return 'bdl';
        if (url.includes('mss.bmlonline.it')) return 'florence';
        if (url.includes('bne.es')) return 'bne';
        return null;
    }

    private notifyListeners(): void {
        // Debug logging for Orleans progress data
        const orleansItems = this.state.items?.filter(item => item.url?.includes('orleans') || item.status === 'loading');
        if (orleansItems && orleansItems.length > 0) {
            console.log('Main process sending queue state - Orleans items:', orleansItems.map(item => ({
                id: item.id,
                status: item.status,
                hasProgress: !!item.progress,
                progressData: item.progress,
                url: item.url
            })));
        }
        
        this.emit('stateChanged', this.state);
    }

    // Load manifest for an item to get page count and library info
    private async loadManifestForItem(itemId: string): Promise<void> {
        const item = this.state.items.find(i => i.id === itemId);
        if (!item || !this.currentDownloader) {
            return;
        }

        // Log manifest loading start
        const logger = DownloadLogger.getInstance();
        const library = item.library || this.detectLibraryFromUrl(item.url) || 'unknown';
        
        logger.log({
            level: 'info',
            library,
            url: item.url,
            message: 'Starting manifest load for queue item',
            details: { itemId: item.id, displayName: item.displayName }
        });
        
        try {
            // Set status to loading before manifest loading starts
            item.status = 'loading';
            this.notifyListeners();
            
            let hasShownProgress = false;
            const loadingStartTime = Date.now();
            
            // Create progress callback that updates the item
            const progressCallback = (current: number, total: number, _message?: string) => {
                // Only show progress for slow-loading manifests (> 30 items) or Orleans library
                if (total > 30 || item.url.includes('orleans')) {
                    hasShownProgress = true;
                    item.progress = {
                        current,
                        total,
                        percentage: Math.round((current / total) * 100),
                        eta: '',
                        stage: 'loading-manifest'
                    };
                    this.notifyListeners();
                }
            };

            const manifest = await this.currentDownloader.loadManifest(item.url, progressCallback);
            
            // Log successful manifest load
            logger.logManifestLoad(
                manifest.library || library,
                item.url,
                Date.now() - loadingStartTime
            );
            
            // If we showed progress, ensure minimum display time of 2 seconds
            if (hasShownProgress) {
                const elapsed = Date.now() - loadingStartTime;
                const minDisplayTime = 2000; // 2 seconds
                if (elapsed < minDisplayTime) {
                    console.log(`Manifest loaded quickly (${elapsed}ms), waiting ${minDisplayTime - elapsed}ms for progress visibility`);
                    await new Promise(resolve => setTimeout(resolve, minDisplayTime - elapsed));
                }
            }
            
            // Update item with manifest information and set status back to pending
            item.status = 'pending';
            item.progress = undefined;
            item.totalPages = manifest.totalPages;
            item.library = manifest.library as TLibrary;
            
            // Apply library-specific optimizations
            const optimizations = LibraryOptimizationService.applyOptimizations(
                this.state.globalSettings.autoSplitThresholdMB,
                this.state.globalSettings.concurrentDownloads,
                item.library
            );
            
            // Store optimization settings with the item (always include to allow caps to apply)
            item.libraryOptimizations = {
                autoSplitThresholdMB: optimizations.autoSplitThresholdMB,
                maxConcurrentDownloads: optimizations.maxConcurrentDownloads,
                timeoutMultiplier: optimizations.timeoutMultiplier,
                enableProgressiveBackoff: optimizations.enableProgressiveBackoff,
                optimizationDescription: optimizations.optimizationDescription
            };
            if (LibraryOptimizationService.hasOptimizations(item.library)) {
                console.log(`Applied library optimizations for ${item.library}: ${optimizations.optimizationDescription}`);
            }
            
            this.saveToStorage();
            this.notifyListeners();
        } catch (error: any) {
            console.warn(`Failed to load manifest for ${item.displayName}: ${error.message}`);
            
            // Log the error to the download logger for user visibility
            const logger = DownloadLogger.getInstance();
            logger.logManifestLoad(
                item.library || 'unknown',
                item.url,
                Date.now() - loadingStartTime,
                error
            );
            
            // Reset status and clear progress on error
            item.status = 'pending';
            item.progress = undefined;
            this.notifyListeners();
        }
    }

    // Queue Management
    addManuscript(manuscript: Omit<QueuedManuscript, 'id' | 'addedAt' | 'status'>): string {
        const canonicalUrl = this.canonicalizeUrl(manuscript.url);
        
        // Check for duplicates
        const existing = this.state.items.find((item) => 
            this.canonicalizeUrl(item.url) === canonicalUrl,
        );
        
        if (existing) {
            return existing.id;
        }

        const newItem: QueuedManuscript = {
            id: this.generateId(),
            addedAt: Date.now(),
            status: 'pending', // Ensure status is always 'pending' for new items
            ...manuscript,
        };
        
        // Force status to be 'pending' regardless of input
        newItem.status = 'pending';

        this.state.items.push(newItem);
        
        this.saveToStorage();
        this.notifyListeners();
        
        // Load manifest immediately to get page count
        this.loadManifestForItem(newItem.id);
        
        if (this.state.globalSettings.autoStart && !this.state.isProcessing) {
            this.processQueue();
        }
        
        return newItem.id;
    }

    removeManuscript(id: string): boolean {
        const item = this.state.items.find((item) => item.id === id);
        if (!item) return false;

        // If currently downloading, abort it
        if (this.state.currentItemId === id && this.processingAbortController) {
            this.processingAbortController.abort();
        }

        // Clear manifest cache for this item
        this.manifestCache.clearUrl(item.url).catch((error: any) => {
            console.warn(`Failed to clear manifest cache for ${item.url}:`, error.message);
        });

        this.state.items = this.state.items.filter((item) => item.id !== id);
        this.saveToStorage();
        this.notifyListeners();
        
        return true;
    }

    updateItem(id: string, updates: Partial<QueuedManuscript>): boolean {
        const item = this.state.items.find((item) => item.id === id);
        if (!item) return false;

        Object.assign(item, updates);
        this.saveToStorage();
        this.notifyListeners();
        
        return true;
    }

    moveItem(fromIndex: number, toIndex: number): boolean {
        if (fromIndex < 0 || fromIndex >= this.state.items.length ||
            toIndex < 0 || toIndex >= this.state.items.length) {
            return false;
        }
        
        const [item] = this.state.items.splice(fromIndex, 1);
        this.state.items.splice(toIndex, 0, item);
        this.saveToStorage();
        this.notifyListeners();
        return true;
    }

    clearCompleted(): void {
        // const completedCount = this.state.items.filter((item) => item.status === 'completed').length;
        this.state.items = this.state.items.filter((item) => item.status !== 'completed');
        this.saveToStorage();
        this.notifyListeners();
        
    }

    clearFailed(): void {
        // const failedCount = this.state.items.filter((item) => item.status === 'failed').length;
        this.state.items = this.state.items.filter((item) => item.status !== 'failed');
        this.saveToStorage();
        this.notifyListeners();
        
    }

    clearAll(): void {
        // const totalCount = this.state.items.length;
        
        // Clear manifest cache for all items
        this.manifestCache.clear().catch((error: any) => {
            console.warn(`Failed to clear manifest cache:`, error.message);
        });
        
        this.state.items = [];
        this.saveToStorage();
        this.notifyListeners();
        
    }

    pauseItem(id: string): boolean {
        const item = this.state.items.find((item) => item.id === id);
        if (!item || item.status !== 'downloading') return false;

        item.status = 'paused';
        if (this.state.currentItemId === id && this.processingAbortController) {
            this.processingAbortController.abort();
        }
        
        this.saveToStorage();
        this.notifyListeners();
        return true;
    }

    resumeItem(id: string): boolean {
        const item = this.state.items.find((item) => item.id === id);
        if (!item || item.status !== 'paused') return false;

        item.status = 'pending';
        this.saveToStorage();
        this.notifyListeners();
        
        // If queue is processing, the item will be picked up automatically
        if (this.state.isProcessing && !this.state.isPaused) {
            this.processQueue();
        }
        
        return true;
    }

    // Queue processing control
    async startProcessing(): Promise<void> {
        if (this.state.isProcessing) return;
        
        const logger = DownloadLogger.getInstance();
        logger.log({
            level: 'info',
            library: 'system',
            message: 'Starting download queue processing',
            details: { 
                queueSize: this.state.items.length,
                pendingItems: this.state.items.filter(i => i.status === 'pending').length
            }
        });
        
        this.state.isPaused = false;
        await this.processQueue();
    }

    pauseProcessing(): void {
        console.log('Pausing queue processing...');
        this.state.isPaused = true;
        
        // Abort the main processing controller
        if (this.processingAbortController) {
            this.processingAbortController.abort();
        }
        
        // Abort all active download controllers
        for (const [itemId, controller] of this.activeDownloadControllers) {
            console.log(`Aborting download for item: ${itemId}`);
            controller.abort();
            
            // Mark the item as paused instead of downloading
            const item = this.state.items.find(i => i.id === itemId);
            if (item && item.status === 'downloading') {
                item.status = 'paused';
                // Keep progress so we can resume later
                console.log(`Item ${item.displayName} paused at ${item.progress?.current || 0}/${item.progress?.total || 0} pages`);
            }
        }
        
        // Clear the controllers map
        this.activeDownloadControllers.clear();
        this.activeDownloadCount = 0;
        
        this.notifyListeners();
    }

    resumeProcessing(): void {
        if (!this.state.isProcessing) return;
        
        this.state.isPaused = false;
        // Only start processing if not already processing
        if (!this.isProcessingQueue) {
            this.processQueue();
        }
    }

    stopProcessing(): void {
        this.isProcessingQueue = false;
        this.state.isProcessing = false;
        this.state.isPaused = false;
        this.state.currentItemId = undefined;
        
        if (this.processingAbortController) {
            this.processingAbortController.abort();
        }
        
        this.notifyListeners();
    }

    // Queue processing
    private isProcessingQueue = false;
    
    private async processQueue(): Promise<void> {
        // Prevent multiple concurrent processing loops
        if (this.isProcessingQueue || this.state.isPaused) {
            return;
        }

        this.isProcessingQueue = true;
        this.state.isProcessing = true;
        this.notifyListeners();

        try {
            while (true) {
                // Check if we can start a new download (enforce single item processing)
                if (this.activeDownloadCount >= this.maxConcurrentQueueItems) {
                    // Wait a bit before checking again
                    await this.sleep(500);
                    if (this.state.isPaused || !this.state.isProcessing) {
                        break;
                    }
                    continue;
                }
                
                const nextItem = this.state.items.find((item) => {
                    if (item.status === 'pending') {
                        return true;
                    }
                    // Don't auto-retry items that failed with CAPTCHA_REQUIRED or exceeded max retries
                    if (item.status === 'failed' && item.error && !item.error.includes('CAPTCHA_REQUIRED:')) {
                        const maxRetries = 3; // Maximum retry attempts to prevent infinite loops
                        const retryCount = item.retryCount || 0;
                        if (retryCount < maxRetries) {
                            console.log(`Auto-retrying ${item.displayName} (attempt ${retryCount + 1}/${maxRetries})`);
                            return true;
                        } else {
                            console.log(`${item.displayName} exceeded maximum retries (${maxRetries}), skipping`);
                        }
                    }
                    return false;
                });

                if (!nextItem) {
                    // No more items to process
                    if (this.activeDownloadCount === 0) {
                        // All downloads complete
                        break;
                    }
                    // Still have active downloads, wait for them
                    await this.sleep(500);
                    continue;
                }

                if (this.state.isPaused) {
                    break;
                }

                // Increment active count BEFORE starting download
                this.activeDownloadCount++;
                console.log(`Starting download ${this.activeDownloadCount}/${this.maxConcurrentQueueItems}: ${nextItem.displayName}`);
                
                // Process item asynchronously (don't await here to allow proper queue management)
                this.processItem(nextItem).finally(() => {
                    this.activeDownloadCount--;
                    console.log(`Completed download, active count now: ${this.activeDownloadCount}`);
                    
                    // Trigger queue processing again when slot opens
                    if (!this.state.isPaused && this.state.isProcessing) {
                        // Use setTimeout to avoid stack overflow
                        setTimeout(() => this.processQueue(), 100);
                    }
                });

                // Wait a bit before checking for next item
                await this.sleep(100);
                
                // Pause between items if configured
                if (this.state.globalSettings.pauseBetweenItems > 0) {
                    await this.sleep(this.state.globalSettings.pauseBetweenItems);
                }
            }
        } catch (error: any) {
            console.error('Queue processing error:', error.message);
        } finally {
            this.isProcessingQueue = false;
            if (this.activeDownloadCount === 0) {
                this.state.isProcessing = false;
                this.state.currentItemId = undefined;
                this.processingAbortController = null;
            }
            this.notifyListeners();
        }
    }

    private async processItem(item: QueuedManuscript): Promise<void> {
        this.state.currentItemId = item.id;
        item.status = 'downloading';
        item.startedAt = Date.now();
        item.progress = {
            current: 0,
            total: item.totalPages || 0,
            percentage: 0,
            eta: 'calculating...',
            stage: 'downloading',
        };
        
        // Create abort controller for this specific item
        const abortController = new AbortController();
        this.activeDownloadControllers.set(item.id, abortController);
        this.processingAbortController = abortController;
        
        this.notifyListeners();

        // Calculate dynamic timeout based on file size and library
        const baseTimeoutMinutes = 15;
        let timeoutMultiplier = 1;
        
        // Large manuscripts need significantly more time
        if (item.totalPages && item.totalPages > 300) {
            timeoutMultiplier = 3; // 45 minutes for 300+ pages
        } else if (item.totalPages && item.totalPages > 200) {
            timeoutMultiplier = 2; // 30 minutes for 200+ pages
        }
        
        // Manuscripta.se specifically needs extra time due to large file sizes
        if (item.library === 'manuscripta' && item.totalPages && item.totalPages > 100) {
            timeoutMultiplier = Math.max(timeoutMultiplier, 3); // At least 45 minutes
        }
        
        // Ensure library is properly initialized before use
        const library = item.library || this.detectLibraryFromUrl(item.url) || 'unknown';
        
        // Apply library-specific timeout multipliers from LibraryOptimizationService
        const libraryConfig = LibraryOptimizationService.getOptimizationsForLibrary(library as TLibrary);
        if (libraryConfig.timeoutMultiplier) {
            timeoutMultiplier *= libraryConfig.timeoutMultiplier;
        }
        
        const downloadTimeoutMs = baseTimeoutMinutes * timeoutMultiplier * 60 * 1000;
        const libraryMultiplierInfo = libraryConfig.timeoutMultiplier ? ` [${library}: ${libraryConfig.timeoutMultiplier}x]` : '';
        console.log(`Setting timeout for ${item.displayName}: ${downloadTimeoutMs / (1000 * 60)} minutes (${item.totalPages || 'unknown'} pages)${libraryMultiplierInfo}`);
        
        // Set up timeout with proper cleanup
        const timeoutId = setTimeout(() => {
            if (item.status === 'downloading') {
                const timeoutMinutes = downloadTimeoutMs / (1000 * 60);
                console.error(`Download timeout for ${item.displayName} after ${timeoutMinutes} minutes`);
                
                // Log the timeout to ensure it's captured
                const logger = DownloadLogger.getInstance();
                // Re-compute library inside timeout to avoid closure issues
                const timeoutLibrary = item.library || this.detectLibraryFromUrl(item.url) || 'unknown';
                
                logger.logTimeout(timeoutLibrary, item.url, downloadTimeoutMs);
                logger.log({
                    level: 'error',
                    library: timeoutLibrary,
                    url: item.url,
                    message: `Download timeout after ${timeoutMinutes} minutes`,
                    details: {
                        itemId: item.id,
                        displayName: item.displayName,
                        totalPages: item.totalPages || 'unknown',
                        timeoutMinutes,
                        downloadTimeoutMs,
                        libraryTimeoutMultiplier: 1 // Use constant value to avoid referencing outer scope libraryConfig
                    }
                });
                
                item.status = 'failed';
                item.error = `Download timeout - exceeded ${timeoutMinutes} minutes. Large manuscripts (${item.totalPages || 'unknown'} pages) may require manual splitting.`;
                if (this.processingAbortController) {
                    this.processingAbortController.abort();
                }
                this.saveToStorage();
                this.notifyListeners();
            }
        }, downloadTimeoutMs);

        try {
            // Check if document should be auto-split (only for non-part items)
            if (!item.isAutoPart) {
                const shouldSplit = await this.checkAndSplitLargeDocument(item);
                if (shouldSplit) {
                    // Document was split, the original item has been removed from queue
                    // No need to mark as completed since it no longer exists
                    return;
                }
            }

            // Pre-load manifest and slice pageLinks for parts
            let pageLinksToPass = null;
            let manifestMetadata = {};

            if (item.isAutoPart && item.downloadOptions?.startPage && item.downloadOptions?.endPage) {
                // For auto-split parts, we need to slice the pageLinks
                console.log(`Processing auto-split part: ${item.displayName}`);
                console.log(`Page range: ${item.downloadOptions.startPage}-${item.downloadOptions.endPage}`);
                
                // Load manifest once to get pageLinks
                const fullManifest = await this.currentDownloader!.loadManifest(item.url);
                
                // CRITICAL FIX: Ensure library is properly set on the item before proceeding
                if (!item.library && fullManifest.library) {
                    item.library = fullManifest.library as TLibrary;
                }
                
                // Slice the pageLinks for this part
                const startIdx = item.downloadOptions.startPage - 1;
                const endIdx = item.downloadOptions.endPage;
                pageLinksToPass = fullManifest.pageLinks.slice(startIdx, endIdx);
                
                console.log(`Sliced ${pageLinksToPass.length} pages from full manifest (${fullManifest.totalPages} total)`);
                
                // Preserve manifest metadata - ensure library is always defined
                manifestMetadata = {
                    library: fullManifest.library || item.library || this.detectLibraryFromUrl(item.url) || 'unknown',
                    displayName: item.displayName,
                    totalPages: pageLinksToPass.length,
                    originalUrl: item.url,
                    // Preserve special processing flags
                    requiresTileProcessor: fullManifest.requiresTileProcessor,
                    tileConfig: fullManifest.tileConfig,
                    pageBlocks: fullManifest.pageBlocks,
                };
            }

            // Determine effective concurrency: prefer per-item override, then global, capped by library optimization
            const perItemConcurrent = typeof item.downloadOptions?.concurrentDownloads === 'number'
                ? item.downloadOptions?.concurrentDownloads
                : undefined;
            const baseConcurrent = perItemConcurrent || this.state.globalSettings.concurrentDownloads;
            const libraryCap = item.libraryOptimizations?.maxConcurrentDownloads;
            const effectiveConcurrent = libraryCap ? Math.min(baseConcurrent, libraryCap) : baseConcurrent;

            const result = await this.currentDownloader!.downloadManuscript(item.url, {
                onProgress: (progress: any) => {
                    // Handle both simple progress (0-1) and detailed progress object
                    if (typeof progress === 'number') {
                        item.progress = progress;
                    } else if (progress && typeof progress === 'object') {
                        item.progress = {
                            current: progress.completedPages || 0,
                            total: progress.totalPages || item.totalPages || 0,
                            percentage: Math.round((progress.progress || 0) * 100 * 100) / 100, // Round to 2 decimal places
                            eta: progress.eta || 'calculating...',
                            stage: 'downloading' as TStage,
                        };
                    }
                    item.eta = progress.eta;
                    this.notifyListeners();
                },
                onManifestLoaded: (manifest: any) => {
                    item.totalPages = manifest.totalPages;
                    item.library = manifest.library as TLibrary;
                    this.notifyListeners();
                },
                maxConcurrent: effectiveConcurrent,
                skipExisting: false,
                // NEW: Pass pre-sliced pageLinks for parts
                ...(pageLinksToPass ? {
                    pageLinks: pageLinksToPass,
                    ...manifestMetadata,
                    // Don't pass startPage/endPage when using pre-sliced
                } : {
                    // Original behavior for non-parts
                    startPage: item.downloadOptions?.startPage,
                    endPage: item.downloadOptions?.endPage,
                }),
                // Pass the queue item for manual manifest data
                queueItem: item,
            });

            if (result.success) {
                // Verify the output file actually exists before marking as completed
                const fs = await import('fs/promises');
                const path = await import('path');
                
                try {
                    // Check if file exists and has reasonable size
                    const stats = await fs.stat(result.filepath);
                    const minExpectedSize = Math.max(1024 * 100, (item.totalPages || 1) * 50 * 1024); // At least 100KB or ~50KB per page
                    
                    if (stats.size < minExpectedSize) {
                        throw new Error(`Output file too small: ${stats.size} bytes (expected at least ${minExpectedSize})`);
                    }
                    
                    console.log(`✅ Download verified: ${path.basename(result.filepath)} (${(stats.size / (1024 * 1024)).toFixed(1)}MB)`);
                    
                    item.status = 'completed';
                    item.completedAt = Date.now();
                    item.progress = 1;
                    item.outputPath = result.filepath;
                    // Do NOT update totalPages here - it should always reflect the manifest total, not download count
                    
                } catch (verificationError: any) {
                    console.error(`❌ File verification failed for ${item.displayName}:`, verificationError.message);
                    throw new Error(`Download appeared successful but file verification failed: ${verificationError.message}`);
                }
            } else {
                throw new Error('Download failed without specific error');
            }

        } catch (error: any) {
            // Always log the error, even if aborted
            const logger = DownloadLogger.getInstance();
            const library = item.library || this.detectLibraryFromUrl(item.url) || 'unknown';
            
            if (this.processingAbortController?.signal.aborted) {
                logger.log({
                    level: 'warn',
                    library,
                    url: item.url,
                    message: 'Download aborted by user',
                    details: { itemId: item.id, displayName: item.displayName }
                });
                item.status = 'paused';
            } else {
                console.error(`❌ Failed: ${item.displayName} - ${error.message}`);
                
                // Log the full error details
                logger.logDownloadError(library, item.url, error, item.retryCount);
                logger.log({
                    level: 'error',
                    library,
                    url: item.url,
                    message: `Download failed for ${item.displayName}`,
                    errorStack: error.stack,
                    details: {
                        itemId: item.id,
                        totalPages: item.totalPages,
                        retryCount: item.retryCount || 0,
                        timeElapsed: item.startedAt ? Date.now() - item.startedAt : 0,
                        errorType: error.name,
                        errorMessage: error.message
                    }
                });
                
                item.status = 'failed';
                item.error = error.message;
                item.retryCount = (item.retryCount || 0) + 1;
                
                // For large manuscript infinite loop prevention
                if (item.library === 'manuscripta' && item.totalPages && item.totalPages > 300) {
                    const maxRetries = 2; // Fewer retries for large manuscripta.se files
                    if (item.retryCount >= maxRetries) {
                        item.error = `${error.message} (Large manuscript - max ${maxRetries} retries exceeded to prevent infinite loops)`;
                        console.error(`Large manuscripta.se manuscript retry limit reached: ${item.displayName}`);
                    }
                }
                
                // Perform error isolation and cache cleanup to prevent corruption spread
                await this.handleDownloadError(item, error);
            }
        } finally {
            // Clear timeout
            clearTimeout(timeoutId);
            
            // Clean up abort controller for this item
            this.activeDownloadControllers.delete(item.id);
            
            // Reset processing abort controller if it was for this item
            if (this.processingAbortController === abortController) {
                this.processingAbortController = null;
            }
        }

        this.saveToStorage();
        this.notifyListeners();
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // State getters
    getState(): QueueState {
        return { ...this.state };
    }

    getItem(id: string): QueuedManuscript | undefined {
        return this.state.items.find((item) => item.id === id);
    }

    getAllItems(): QueuedManuscript[] {
        return [...this.state.items];
    }

    getQueueStats(): {
        total: number;
        queued: number;
        downloading: number;
        completed: number;
        failed: number;
        paused: number;
    } {
        const stats = {
            total: this.state.items.length,
            queued: 0,
            downloading: 0,
            completed: 0,
            failed: 0,
            paused: 0,
        };

        this.state.items.forEach((item) => {
            stats[item.status as keyof typeof stats]++;
        });

        return stats;
    }
    
    updateAutoSplitThreshold(thresholdMB: number): void {
        this.state.globalSettings.autoSplitThresholdMB = thresholdMB;
        this.saveToStorage();
        this.notifyListeners();
        
        // Recalculate splits for all existing items
        this.recalculateAutoSplits();
    }

    /**
     * Update global concurrent downloads and propagate to items still using the old global value
     */
    updateGlobalConcurrentDownloads(newConcurrent: number): void {
        const oldConcurrent = this.state.globalSettings.concurrentDownloads;
        this.state.globalSettings.concurrentDownloads = newConcurrent;

        // Propagate to items that haven't been manually customized (equal to old global)
        for (const item of this.state.items) {
            if (item.downloadOptions && item.downloadOptions.concurrentDownloads === oldConcurrent) {
                if (['pending', 'queued', 'loading'].includes(item.status)) {
                    item.downloadOptions.concurrentDownloads = newConcurrent;
                }
            }
        }

        this.saveToStorage();
        this.notifyListeners();

        // Also refresh library optimizations to reflect any caps with new global value
        this.recalculateLibraryOptimizationsForAll();
    }

    private recalculateLibraryOptimizationsForAll(): void {
        const globalThreshold = this.state.globalSettings.autoSplitThresholdMB;
        const globalConcurrent = this.state.globalSettings.concurrentDownloads;
        let changed = false;
        for (const item of this.state.items) {
            if (!item.library || item.library === 'loading') {
                // Clear any stale optimizations for items without known library yet
                if (item.libraryOptimizations) {
                    delete item.libraryOptimizations.maxConcurrentDownloads;
                    changed = true;
                }
                continue;
            }
            const opts = LibraryOptimizationService.applyOptimizations(
                globalThreshold,
                globalConcurrent,
                item.library
            );
            const prev = JSON.stringify(item.libraryOptimizations || {});
            item.libraryOptimizations = {
                autoSplitThresholdMB: opts.autoSplitThresholdMB,
                maxConcurrentDownloads: opts.maxConcurrentDownloads,
                timeoutMultiplier: opts.timeoutMultiplier,
                enableProgressiveBackoff: opts.enableProgressiveBackoff,
                optimizationDescription: opts.optimizationDescription,
            };
            if (prev !== JSON.stringify(item.libraryOptimizations)) changed = true;
        }
        if (changed) {
            this.saveToStorage();
            this.notifyListeners();
        }
    }
    
    private recalculateAutoSplits(): void {
        // Group items by parentId to find documents that need recalculation
        const parentGroups = new Map<string, QueuedManuscript[]>();
        const standaloneItems: QueuedManuscript[] = [];
        
        for (const item of this.state.items) {
            if (item.isAutoPart && item.parentId) {
                if (!parentGroups.has(item.parentId)) {
                    parentGroups.set(item.parentId, []);
                }
                parentGroups.get(item.parentId)!.push(item);
            } else if (!item.isAutoPart && item.status === 'pending') {
                // Only recalculate for queued standalone items
                standaloneItems.push(item);
            }
        }
        
        // Check standalone items for potential splitting
        for (const item of standaloneItems) {
            this.checkStandaloneItemForSplitting(item).catch(err => 
                console.error(`Error checking item ${item.displayName} for splitting:`, err)
            );
        }
        
        // For each parent group, recalculate splits
        for (const [parentId, parts] of parentGroups) {
            // Only recalculate if all parts are still queued or paused
            const canRecalculate = parts.every(p => p.status === 'pending' || p.status === 'paused');
            if (parts.length > 0 && canRecalculate) {
                this.recalculatePartsForGroup(parentId, parts);
            }
        }
    }
    
    private recalculatePartsForGroup(parentId: string, existingParts: QueuedManuscript[]): void {
        // Get the first part to reconstruct original document info
        const firstPart = existingParts[0];
        if (!firstPart.partInfo) return;
        
        const originalDisplayName = firstPart.partInfo.originalDisplayName;
        const totalPages = existingParts.reduce((max, part) => 
            Math.max(max, part.partInfo?.pageRange.end || 0), 0);
        
        // Get actual size estimate if we have it stored
        const estimatedSizeMB = firstPart.estimatedSizeMB || (totalPages * 8);
        const thresholdMB = this.state.globalSettings.autoSplitThresholdMB;
        
        if (estimatedSizeMB <= thresholdMB) {
            // Should not be split anymore - merge back to single item
            this.mergePartsBackToSingle(parentId, existingParts, originalDisplayName, totalPages);
        } else {
            // Recalculate new parts
            const newNumberOfParts = Math.ceil(estimatedSizeMB / thresholdMB);
            const newPagesPerPart = Math.ceil(totalPages / newNumberOfParts);
            
            if (newNumberOfParts !== existingParts.length) {
                this.recreatePartsWithNewSizes(parentId, existingParts, originalDisplayName, totalPages, newNumberOfParts, newPagesPerPart);
            }
        }
    }
    
    private async checkStandaloneItemForSplitting(item: QueuedManuscript): Promise<void> {
        // If we don't have size estimate, we can't check without downloading
        if (!item.estimatedSizeMB) {
            return;
        }
        
        const thresholdMB = this.state.globalSettings.autoSplitThresholdMB;
        
        if (item.estimatedSizeMB > thresholdMB) {
            // Calculate number of parts
            const numberOfParts = Math.ceil(item.estimatedSizeMB / thresholdMB);
            const pagesPerPart = Math.ceil(item.totalPages / numberOfParts);
            
            // Remove original item
            const originalIndex = this.state.items.findIndex(i => i.id === item.id);
            if (originalIndex === -1) return;
            
            this.state.items.splice(originalIndex, 1);
            
            // Create parts
            for (let i = 0; i < numberOfParts; i++) {
                const startPage = i * pagesPerPart + 1;
                const endPage = Math.min((i + 1) * pagesPerPart, item.totalPages);
                const partNumber = i + 1;
                
                const partId = `${item.id}_part_${partNumber}`;
                const partItem: QueuedManuscript = {
                    ...item,
                    id: partId,
                    displayName: `${item.displayName}_Part_${partNumber}_pages_${startPage}-${endPage}`,
                    status: 'pending',
                    parentId: item.id,
                    isAutoPart: true,
                    partInfo: {
                        partNumber,
                        totalParts: numberOfParts,
                        originalDisplayName: item.displayName,
                        pageRange: { start: startPage, end: endPage },
                    },
                    downloadOptions: {
                        concurrentDownloads: item.downloadOptions?.concurrentDownloads || 3,
                        startPage,
                        endPage,
                    },
                    estimatedSizeMB: item.estimatedSizeMB,
                    progress: undefined,
                    error: undefined,
                    startedAt: undefined,
                    completedAt: undefined,
                };
                
                // Insert part at original position
                this.state.items.splice(originalIndex + i, 0, partItem);
            }
            
            this.saveToStorage();
            this.notifyListeners();
        }
    }
    
    private mergePartsBackToSingle(parentId: string, parts: QueuedManuscript[], originalDisplayName: string, totalPages: number): void {
        // Remove all parts
        this.state.items = this.state.items.filter(item => !parts.includes(item));
        
        // Create single item
        const firstPart = parts[0];
        const mergedItem: QueuedManuscript = {
            ...firstPart,
            id: parentId,
            displayName: originalDisplayName,
            totalPages,
            status: 'queued',
            isAutoPart: false,
            parentId: undefined,
            partInfo: undefined,
            downloadOptions: {
                concurrentDownloads: firstPart.downloadOptions?.concurrentDownloads || 3,
                startPage: 1,
                endPage: totalPages,
            },
            estimatedSizeMB: firstPart.estimatedSizeMB, // Preserve size estimate
            progress: undefined,
            error: undefined,
            startedAt: undefined,
            completedAt: undefined,
        };
        
        this.state.items.push(mergedItem);
        this.saveToStorage();
        this.notifyListeners();
    }
    
    private recreatePartsWithNewSizes(
        parentId: string, 
        existingParts: QueuedManuscript[], 
        originalDisplayName: string, 
        totalPages: number, 
        newNumberOfParts: number, 
        newPagesPerPart: number
    ): void {
        // Remove existing parts
        this.state.items = this.state.items.filter(item => !existingParts.includes(item));
        
        // Create new parts
        const firstPart = existingParts[0];
        for (let i = 0; i < newNumberOfParts; i++) {
            const startPage = i * newPagesPerPart + 1;
            const endPage = Math.min((i + 1) * newPagesPerPart, totalPages);
            const partNumber = i + 1;
            
            const partId = `${parentId}_part_${partNumber}`;
            const partItem: QueuedManuscript = {
                ...firstPart,
                id: partId,
                displayName: `${originalDisplayName}_Part_${partNumber}_pages_${startPage}-${endPage}`,
                status: 'pending',
                parentId,
                isAutoPart: true,
                partInfo: {
                    partNumber,
                    totalParts: newNumberOfParts,
                    originalDisplayName,
                    pageRange: { start: startPage, end: endPage },
                },
                downloadOptions: {
                    concurrentDownloads: firstPart.downloadOptions?.concurrentDownloads || 3,
                    startPage,
                    endPage,
                },
                estimatedSizeMB: firstPart.estimatedSizeMB, // Preserve size estimate
                progress: undefined,
                error: undefined,
                startedAt: undefined,
                completedAt: undefined,
            };
            
            this.state.items.push(partItem);
        }
        
        this.saveToStorage();
        this.notifyListeners();
    }
    
    private async checkAndSplitLargeDocument(item: QueuedManuscript): Promise<boolean> {
        try {
            let manifest: any;
            
            // Only load manifest if we don't already have the data (avoid double loading)
            if (!item.totalPages || !item.library) {
                console.log(`Loading manifest for ${item.displayName}...`);
                manifest = await this.currentDownloader!.loadManifest(item.url);
                
                // Update item with manifest info
                item.totalPages = manifest.totalPages;
                item.library = manifest.library as TLibrary;
                
                console.log(`Manifest loaded: ${manifest.totalPages} pages, library: ${manifest.library}`);
            } else {
                console.log(`Using cached manifest data: ${item.totalPages} pages, library: ${item.library}`);
                // Need to reload manifest to get pageLinks for size estimation
                manifest = await this.currentDownloader!.loadManifest(item.url);
            }
            
            // For Florus, Orleans, Internet Culturale, Manuscripta, Graz, Cologne, Rome, NYPL, Czech, Modena, and Morgan - skip first page download and use estimated size calculation
            if (manifest.library === 'florus' || manifest.library === 'orleans' || manifest.library === 'internet_culturale' || manifest.library === 'manuscripta' || manifest.library === 'graz' || manifest.library === 'cologne' || manifest.library === 'rome' || manifest.library === 'nypl' || manifest.library === 'czech' || manifest.library === 'modena' || manifest.library === 'bdl' || manifest.library === 'morgan') {
                console.log(`${manifest.library} manuscript detected, using estimated size calculation (bypassing first page download)`);
                // Estimate based on typical manuscript page size
                const avgPageSizeMB = manifest.library === 'orleans' ? 0.6 : 
                                    manifest.library === 'internet_culturale' ? 0.8 : 
                                    manifest.library === 'manuscripta' ? 0.7 :
                                    manifest.library === 'graz' ? 0.8 :
                                    manifest.library === 'cologne' ? 0.5 :
                                    manifest.library === 'rome' ? 0.3 :
                                    manifest.library === 'nypl' ? 1.2 :
                                    manifest.library === 'czech' ? 0.5 :
                                    manifest.library === 'modena' ? 0.4 :
                                    manifest.library === 'bdl' ? 0.5 :
                                    manifest.library === 'morgan' ? 5.0 : // Morgan .zif files reduced estimate (5MB per stitched image)
                                    0.4; // 600KB for Orleans IIIF, 800KB for Internet Culturale IIIF, 700KB for Manuscripta IIIF, 800KB for Graz IIIF, 500KB for Cologne webcache, 300KB for Rome, 1.2MB for NYPL IIIF, 500KB for Czech, 400KB for Modena mobile, 500KB for BDL IIIF, 5MB for Morgan .zif, 400KB for Florus
                const estimatedTotalSizeMB = avgPageSizeMB * manifest.totalPages;
                item.estimatedSizeMB = estimatedTotalSizeMB;
                
                // Get library-specific optimizations directly since item.libraryOptimizations may not be set yet
                const libraryOpts = LibraryOptimizationService.getOptimizationsForLibrary(manifest.library as TLibrary);
                const effectiveThreshold = libraryOpts.autoSplitThresholdMB || 
                                         this.state.globalSettings.autoSplitThresholdMB;
                
                console.log(`${manifest.library} size check: ${estimatedTotalSizeMB}MB vs threshold ${effectiveThreshold}MB`);
                
                if (estimatedTotalSizeMB > effectiveThreshold) {
                    console.log(`${manifest.library} manuscript exceeds threshold, splitting into parts`);
                    await this.splitQueueItem(item, manifest, estimatedTotalSizeMB);
                    return true;
                }
                console.log(`${manifest.library} manuscript within threshold, proceeding with single download`);
                return false;
            }
            
            // Download first page to get actual size estimation
            const firstPageUrl = manifest.pageLinks[0];
            if (!firstPageUrl) return false;
            
            const firstPageBuffer = await this.downloadSinglePage(firstPageUrl);
            const firstPageSizeMB = firstPageBuffer.length / (1024 * 1024);
            const estimatedTotalSizeMB = firstPageSizeMB * manifest.totalPages;
            
            // Store the estimated size for future recalculations
            item.estimatedSizeMB = estimatedTotalSizeMB;
            
            // Get library-specific threshold or use global
            const effectiveThreshold = item.libraryOptimizations?.autoSplitThresholdMB || 
                                     this.state.globalSettings.autoSplitThresholdMB;
            
            if (estimatedTotalSizeMB > effectiveThreshold) {
                await this.splitQueueItem(item, manifest, estimatedTotalSizeMB);
                return true;
            }
            
            return false;
        } catch (error: any) {
            console.error('❌ Error checking document size:', error);
            // If it's a captcha error, mark the item as failed with captcha message
            if (error.message?.includes('CAPTCHA_REQUIRED:')) {
                item.status = 'failed';
                item.error = error.message;
                this.saveToStorage();
                this.notifyListeners();
                throw error; // Re-throw to be handled by processItem
            }
            return false;
        }
    }
    
    private async splitQueueItem(
        originalItem: QueuedManuscript, 
        manifest: any, 
        estimatedSizeMB: number
    ): Promise<void> {
        const thresholdMB = this.state.globalSettings.autoSplitThresholdMB;
        const numberOfParts = Math.ceil(estimatedSizeMB / thresholdMB);
        const pagesPerPart = Math.ceil(manifest.totalPages / numberOfParts);
        
        // Remove original item from queue
        const originalIndex = this.state.items.findIndex(item => item.id === originalItem.id);
        if (originalIndex !== -1) {
            this.state.items.splice(originalIndex, 1);
        }
        
        // Create parts
        for (let i = 0; i < numberOfParts; i++) {
            const startPage = i * pagesPerPart + 1;
            const endPage = Math.min((i + 1) * pagesPerPart, manifest.totalPages);
            const partNumber = i + 1;
            
            const partId = `${originalItem.id}_part_${partNumber}`;
            const partItem: QueuedManuscript = {
                ...originalItem, // Copy all original properties
                id: partId,
                displayName: `${manifest.displayName}_Part_${partNumber}_pages_${startPage}-${endPage}`,
                status: 'pending',
                parentId: originalItem.id,
                isAutoPart: true,
                partInfo: {
                    partNumber,
                    totalParts: numberOfParts,
                    originalDisplayName: manifest.displayName,
                    pageRange: { start: startPage, end: endPage },
                },
                downloadOptions: {
                    concurrentDownloads: originalItem.downloadOptions?.concurrentDownloads || 3,
                    startPage,
                    endPage,
                },
                estimatedSizeMB, // Store size estimate for reactive splitting
                progress: undefined,
                error: undefined,
                startedAt: undefined,
                completedAt: undefined,
            };
            
            // Insert part at the original position + i
            this.state.items.splice(originalIndex + i, 0, partItem);
        }
        
        this.saveToStorage();
        this.notifyListeners();
    }
    
    private async downloadSinglePage(url: string): Promise<Buffer> {
        const https = await import('https');
        const http = await import('http');
        
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const client = urlObj.protocol === 'https:' ? https.default : http.default;

            // Use much longer timeout for Trinity Cambridge as their server is extremely slow (45+ seconds per image)
            // Also use longer timeout for Orleans as their IIIF service can be slow
            const timeout = url.includes('mss-cat.trin.cam.ac.uk') ? 120000 : 
                           (url.includes('mediatheques.orleans.fr') || url.includes('aurelia.orleans.fr')) ? 60000 : 
                           30000; // 2 minutes for Trinity Cambridge, 1 minute for Orleans, 30s default

            // Special headers for ISOS to avoid 403 Forbidden errors
            let headers: Record<string, string> = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/*,*/*',
                'Accept-Language': 'en-US,en;q=0.5',
            };
            
            if (url.includes('isos.dias.ie')) {
                headers = {
                    ...headers,
                    'Referer': 'https://www.isos.dias.ie/',
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache',
                    'Sec-Fetch-Dest': 'image',
                    'Sec-Fetch-Mode': 'no-cors',
                    'Sec-Fetch-Site': 'same-origin'
                };
            }
            
            // Special headers for Cambridge CUDL to avoid 403 Forbidden errors
            if (url.includes('images.lib.cam.ac.uk')) {
                headers = {
                    ...headers,
                    'Referer': 'https://cudl.lib.cam.ac.uk/',
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                };
            }
            
            // Special headers for Orleans IIIF to avoid timeout/hanging issues
            if (url.includes('mediatheques.orleans.fr') || url.includes('aurelia.orleans.fr')) {
                headers = {
                    ...headers,
                    'Referer': 'https://aurelia.orleans.fr/',
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'Sec-Fetch-Dest': 'image',
                    'Sec-Fetch-Mode': 'no-cors',
                    'Sec-Fetch-Site': 'cross-site'
                };
            }

            const req = client.request(url, { 
                timeout,
                headers
            }, (res: any) => {
                // Handle redirects (3xx status codes)
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const redirectUrl = new URL(res.headers.location, url);
                    this.downloadSinglePage(redirectUrl.toString())
                        .then(resolve)
                        .catch(reject);
                    return;
                }
                
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                    return;
                }

                const chunks: Buffer[] = [];
                res.on('data', (chunk: Buffer) => chunks.push(chunk));
                res.on('end', () => resolve(Buffer.concat(chunks)));
                res.on('error', reject);
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    /**
     * Handle download errors with isolation and cache cleanup to prevent corruption spread
     */
    private async handleDownloadError(item: QueuedManuscript, error: any): Promise<void> {
        try {
            console.log(`Performing error isolation cleanup for: ${item.displayName}`);
            
            // Clear corrupted cache entries for this specific URL
            await this.manifestCache.clearUrl(item.url);
            
            // Clean up any temporary files for this download
            await this.cleanupTempFiles(item);
            
            // Reset any corrupted downloader state
            await this.resetDownloaderState();
            
            // If this is a critical error, perform more aggressive cleanup
            if (this.isCriticalError(error)) {
                console.warn('Critical error detected, performing aggressive cache cleanup');
                await this.performAggressiveCleanup();
            }
            
        } catch (cleanupError: any) {
            console.warn('Error during cleanup, but not propagating:', cleanupError.message);
        }
    }

    /**
     * Check if error is critical and might cause widespread corruption
     */
    private isCriticalError(error: any): boolean {
        const errorMessage = error.message?.toLowerCase() || '';
        const criticalPatterns = [
            'json',
            'parse',
            'corrupt',
            'invalid',
            'store',
            'cache',
            'memory',
            'aborted'
        ];
        
        return criticalPatterns.some(pattern => errorMessage.includes(pattern));
    }

    /**
     * Clean up temporary files for a specific download
     */
    private async cleanupTempFiles(item: QueuedManuscript): Promise<void> {
        try {
            const userDataPath = app.getPath('userData');
            const tempImagesDir = path.join(userDataPath, 'temp-images');
            
            // Create a sanitized version of the item ID for file matching
            const sanitizedId = item.id.replace(/[^a-zA-Z0-9]/g, '_');
            
            // Check if temp directory exists
            if (fsSync.existsSync(tempImagesDir)) {
                const files = await fs.readdir(tempImagesDir);
                const itemFiles = files.filter(file => file.includes(sanitizedId));
                
                for (const file of itemFiles) {
                    try {
                        await fs.unlink(path.join(tempImagesDir, file));
                        console.log(`Cleaned up temp file: ${file}`);
                    } catch {
                        // Ignore individual file cleanup errors
                    }
                }
            }
        } catch (error: any) {
            console.warn('Failed to cleanup temp files:', error.message);
        }
    }

    /**
     * Reset downloader state to prevent corruption spread
     */
    private async resetDownloaderState(): Promise<void> {
        try {
            // Create a fresh downloader instance to avoid corrupted state
            this.currentDownloader = new EnhancedManuscriptDownloaderService(this.manifestCache);
            console.log('Reset downloader state after error');
        } catch (error: any) {
            console.warn('Failed to reset downloader state:', error.message);
        }
    }

    /**
     * Perform aggressive cleanup for critical errors
     */
    private async performAggressiveCleanup(): Promise<void> {
        try {
            // Clear all manifest cache
            await this.manifestCache.clear();
            
            // Clean up all temp files
            const userDataPath = app.getPath('userData');
            const tempImagesDir = path.join(userDataPath, 'temp-images');
            
            if (fsSync.existsSync(tempImagesDir)) {
                try {
                    await fs.rmdir(tempImagesDir, { recursive: true });
                    await fs.mkdir(tempImagesDir, { recursive: true });
                    console.log('Cleaned up all temporary files');
                } catch {
                    // Directory might be in use, just continue
                }
            }
            
            // Reset store state cleanly
            try {
                const sanitizedState = this.sanitizeStateForSaving(this.state);
                (this.store as any).set('queueState', sanitizedState);
            } catch (storeError: any) {
                console.warn('Failed to reset store state:', storeError.message);
            }
            
            console.log('Aggressive cleanup completed');
        } catch (error: any) {
            console.warn('Failed aggressive cleanup:', error.message);
        }
    }

    /**
     * Public method to manually trigger cache cleanup (for user-initiated cache clearing)
     */
    public async clearAllCaches(): Promise<void> {
        try {
            console.log('Clearing all caches...');
            await this.performAggressiveCleanup();
            console.log('All caches cleared successfully');
        } catch (error: any) {
            console.error('Failed to clear caches:', error.message);
            throw error;
        }
    }

    // Simultaneous download methods
    setSimultaneousMode(mode: TSimultaneousMode, maxCount?: number): void {
        this.state.globalSettings.simultaneousMode = mode;
        if (maxCount !== undefined) {
            this.state.globalSettings.maxSimultaneousDownloads = Math.max(1, Math.min(maxCount, 10));
        }
        this.saveToStorage();
        this.notifyListeners();
    }

    async startAllSimultaneous(): Promise<void> {
        if (this.state.isProcessing) return;
        
        const pendingItems = this.state.items.filter(item => 
            item.status === 'pending' || item.status === 'loading'
        );
        
        if (pendingItems.length === 0) return;
        
        this.state.isProcessing = true;
        this.state.isPaused = false;
        this.state.activeItemIds = [];
        this.processingAbortController = new AbortController();
        this.notifyListeners();
        
        try {
            // Start all pending items simultaneously with resource limits
            const itemsToStart = pendingItems.slice(0, this.state.globalSettings.maxSimultaneousDownloads);
            
            if (itemsToStart.length < pendingItems.length) {
                console.warn(`Starting ${itemsToStart.length} of ${pendingItems.length} items due to resource limits`);
            }
            
            const promises = itemsToStart.map(item => this.processItemConcurrently(item));
            const results = await Promise.allSettled(promises);
            
            // Log any failures
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    console.error(`Failed to process item ${itemsToStart[index].id}:`, result.reason);
                }
            });
        } catch (error) {
            console.error('Error in simultaneous processing:', error);
        } finally {
            this.state.isProcessing = false;
            this.state.currentItemId = undefined;
            this.state.activeItemIds = [];
            this.activeDownloaders.clear();
            this.processingAbortController = null;
            this.notifyListeners();
        }
    }

    async startItemIndividually(id: string): Promise<void> {
        const item = this.state.items.find(item => item.id === id);
        if (!item || (item.status !== 'pending' && item.status !== 'loading' && item.status !== 'paused')) {
            return;
        }
        
        // Check resource availability
        const activeCount = this.activeDownloaders.size;
        if (activeCount >= this.state.globalSettings.maxSimultaneousDownloads) {
            console.warn(`Cannot start item ${id}: maximum simultaneous downloads reached`);
            return;
        }
        
        // Initialize processing state if not already active
        if (!this.state.isProcessing) {
            this.state.isProcessing = true;
            this.state.isPaused = false;
            this.state.activeItemIds = this.state.activeItemIds || [];
            this.processingAbortController = new AbortController();
        }
        
        this.notifyListeners();
        
        try {
            await this.processItemConcurrently(item);
        } catch (error) {
            console.error(`Error processing item ${id}:`, error);
        }
        
        // Check if we should stop processing (no more active downloads)
        if (this.activeDownloaders.size === 0) {
            this.state.isProcessing = false;
            this.state.currentItemId = undefined;
            this.state.activeItemIds = [];
            this.processingAbortController = null;
            this.notifyListeners();
        }
    }

    private async processItemConcurrently(item: QueuedManuscript): Promise<void> {
        // Log the start of processing
        const logger = DownloadLogger.getInstance();
        logger.log({
            level: 'info',
            library: item.library || 'unknown',
            url: item.url,
            message: `Starting download process for ${item.displayName}`,
            details: { 
                id: item.id, 
                totalPages: item.totalPages,
                library: item.library,
                isAutoPart: item.isAutoPart
            }
        });
        
        // Add item to active downloads tracking
        if (!this.state.activeItemIds) {
            this.state.activeItemIds = [];
        }
        this.state.activeItemIds.push(item.id);
        
        item.status = 'downloading';
        item.startedAt = Date.now();
        item.error = undefined;
        
        item.progress = {
            current: 0,
            total: item.totalPages || 1,
            percentage: 0,
            eta: 'Calculating...',
            stage: 'downloading' as TStage,
        };
        
        this.saveToStorage();
        this.notifyListeners();
        
        // Create a dedicated downloader for this concurrent download
        const downloader = new EnhancedManuscriptDownloaderService(this.manifestCache);
        this.activeDownloaders.set(item.id, downloader);
        
        // Calculate dynamic timeout based on file size and library
        const baseTimeoutMinutes = 15;
        let timeoutMultiplier = 1;
        
        // Large manuscripts need significantly more time
        if (item.totalPages && item.totalPages > 300) {
            timeoutMultiplier = 3; // 45 minutes for 300+ pages
        } else if (item.totalPages && item.totalPages > 200) {
            timeoutMultiplier = 2; // 30 minutes for 200+ pages
        }
        
        // Manuscripta.se specifically needs extra time due to large file sizes
        if (item.library === 'manuscripta' && item.totalPages && item.totalPages > 100) {
            timeoutMultiplier = Math.max(timeoutMultiplier, 3); // At least 45 minutes
        }
        
        // Ensure library is properly initialized before use
        const library = item.library || this.detectLibraryFromUrl(item.url) || 'unknown';
        
        // Apply library-specific timeout multipliers from LibraryOptimizationService
        const libraryConfig = LibraryOptimizationService.getOptimizationsForLibrary(library as TLibrary);
        if (libraryConfig.timeoutMultiplier) {
            timeoutMultiplier *= libraryConfig.timeoutMultiplier;
        }
        
        const downloadTimeoutMs = baseTimeoutMinutes * timeoutMultiplier * 60 * 1000;
        const libraryMultiplierInfo = libraryConfig.timeoutMultiplier ? ` [${library}: ${libraryConfig.timeoutMultiplier}x]` : '';
        console.log(`Setting timeout for ${item.displayName}: ${downloadTimeoutMs / (1000 * 60)} minutes (${item.totalPages || 'unknown'} pages)${libraryMultiplierInfo}`);
        
        // Set up timeout with proper cleanup
        const timeoutId = setTimeout(() => {
            if (item.status === 'downloading') {
                console.error(`Download timeout for ${item.displayName} after ${downloadTimeoutMs / (1000 * 60)} minutes`);
                item.status = 'failed';
                item.error = `Download timeout - exceeded ${downloadTimeoutMs / (1000 * 60)} minutes. Large manuscripts (${item.totalPages || 'unknown'} pages) may require manual splitting.`;
                this.saveToStorage();
                this.notifyListeners();
            }
        }, downloadTimeoutMs);
        
        try {
            // Load manifest if needed  
            if (!item.totalPages || !item.library) {
                await this.loadManifestForItem(item.id);
            }
            
            // Check if document should be auto-split (only for non-part items)
            if (!item.isAutoPart) {
                const shouldSplit = await this.checkAndSplitLargeDocument(item);
                if (shouldSplit) {
                    // Document was split, the original item has been removed from queue
                    // No need to mark as completed since it no longer exists
                    clearTimeout(timeoutId);
                    return;
                }
            }
            
            // Pre-load manifest and slice pageLinks for parts (also for legacy queue)
            let pageLinksToPass = null;
            let manifestMetadata = {};

            if (item.isAutoPart && item.downloadOptions?.startPage && item.downloadOptions?.endPage) {
                // For auto-split parts, we need to slice the pageLinks
                console.log(`Processing auto-split part: ${item.displayName}`);
                console.log(`Page range: ${item.downloadOptions.startPage}-${item.downloadOptions.endPage}`);
                
                // Load manifest once to get pageLinks
                const fullManifest = await downloader.loadManifest(item.url);
                
                // CRITICAL FIX: Ensure library is properly set on the item before proceeding
                if (!item.library && fullManifest.library) {
                    item.library = fullManifest.library as TLibrary;
                }
                
                // Slice the pageLinks for this part
                const startIdx = item.downloadOptions.startPage - 1;
                const endIdx = item.downloadOptions.endPage;
                pageLinksToPass = fullManifest.pageLinks.slice(startIdx, endIdx);
                
                console.log(`Sliced ${pageLinksToPass.length} pages from full manifest (${fullManifest.totalPages} total)`);
                
                // Preserve manifest metadata - ensure library is always defined
                manifestMetadata = {
                    library: fullManifest.library || item.library || this.detectLibraryFromUrl(item.url) || 'unknown',
                    displayName: item.displayName,
                    totalPages: pageLinksToPass.length,
                    originalUrl: item.url,
                    // Preserve special processing flags
                    requiresTileProcessor: fullManifest.requiresTileProcessor,
                    tileConfig: fullManifest.tileConfig,
                    pageBlocks: fullManifest.pageBlocks,
                };
            }

            // Determine effective concurrency: prefer per-item override, then global, capped by library optimization
            const perItemConcurrent2 = typeof item.downloadOptions?.concurrentDownloads === 'number'
                ? item.downloadOptions?.concurrentDownloads
                : undefined;
            const baseConcurrent2 = perItemConcurrent2 || this.state.globalSettings.concurrentDownloads;
            const libraryCap2 = item.libraryOptimizations?.maxConcurrentDownloads;
            const effectiveConcurrent2 = libraryCap2 ? Math.min(baseConcurrent2, libraryCap2) : baseConcurrent2;

            // Actually download the manuscript
            const result = await downloader.downloadManuscript(item.url, {
                onProgress: (progress: any) => {
                    // Handle both simple progress (0-1) and detailed progress object
                    if (typeof progress === 'number') {
                        item.progress = progress;
                    } else if (progress && typeof progress === 'object') {
                        item.progress = {
                            current: progress.completedPages || 0,
                            total: progress.totalPages || item.totalPages || 0,
                            percentage: Math.round((progress.progress || 0) * 100 * 100) / 100, // Round to 2 decimal places
                            eta: progress.eta || 'calculating...',
                            stage: 'downloading' as TStage,
                        };
                    }
                    item.eta = progress.eta;
                    this.notifyListeners();
                },
                onManifestLoaded: (manifest: any) => {
                    item.totalPages = manifest.totalPages;
                    item.library = manifest.library as TLibrary;
                    this.notifyListeners();
                },
                maxConcurrent: effectiveConcurrent2,
                skipExisting: false,
                // NEW: Pass pre-sliced pageLinks for parts
                ...(pageLinksToPass ? {
                    pageLinks: pageLinksToPass,
                    ...manifestMetadata,
                    // Don't pass startPage/endPage when using pre-sliced
                } : {
                    // Original behavior for non-parts
                    startPage: item.downloadOptions?.startPage,
                    endPage: item.downloadOptions?.endPage,
                }),
                // Pass the queue item for manual manifest data
                queueItem: item,
            });
            
            if (result.success) {
                // Verify the output file actually exists before marking as completed
                const fs = await import('fs/promises');
                const path = await import('path');
                
                try {
                    // Check if file exists and has reasonable size
                    const stats = await fs.stat(result.filepath);
                    const minExpectedSize = Math.max(1024 * 100, (item.totalPages || 1) * 50 * 1024); // At least 100KB or ~50KB per page
                    
                    if (stats.size < minExpectedSize) {
                        throw new Error(`Output file too small: ${stats.size} bytes (expected at least ${minExpectedSize})`);
                    }
                    
                    console.log(`✅ Download verified: ${path.basename(result.filepath)} (${(stats.size / (1024 * 1024)).toFixed(1)}MB)`);
                    
                    item.status = 'completed';
                    item.completedAt = Date.now();
                    item.progress = undefined;
                    item.outputPath = result.filepath;
                    
                } catch (verificationError: any) {
                    console.error(`❌ File verification failed for ${item.displayName}:`, verificationError.message);
                    throw new Error(`Download appeared successful but file verification failed: ${verificationError.message}`);
                }
            } else {
                throw new Error('Download failed without specific error');
            }
            
        } catch (error: any) {
            if (error.name === 'AbortError' || error.message?.includes('abort')) {
                item.status = 'paused';
                item.progress = undefined;
            } else {
                console.error(`❌ Failed: ${item.displayName} - ${error.message}`);
                item.status = 'failed';
                item.error = error.message;
                item.retryCount = (item.retryCount || 0) + 1;
                
                // For large manuscript infinite loop prevention
                if (item.library === 'manuscripta' && item.totalPages && item.totalPages > 300) {
                    const maxRetries = 2; // Fewer retries for large manuscripta.se files
                    if (item.retryCount >= maxRetries) {
                        item.error = `${error.message} (Large manuscript - max ${maxRetries} retries exceeded to prevent infinite loops)`;
                        console.error(`Large manuscripta.se manuscript retry limit reached: ${item.displayName}`);
                    }
                }
                
                // Perform error isolation and cache cleanup to prevent corruption spread
                await this.handleDownloadError(item, error);
            }
        } finally {
            // Clear timeout
            clearTimeout(timeoutId);
            
            // Remove from active downloads
            this.activeDownloaders.delete(item.id);
            if (this.state.activeItemIds) {
                const index = this.state.activeItemIds.indexOf(item.id);
                if (index > -1) {
                    this.state.activeItemIds.splice(index, 1);
                }
            }
            
            this.saveToStorage();
            this.notifyListeners();
        }
    }
}