import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import path from 'path';
import { app } from 'electron';
import Store from 'electron-store';
import { EnhancedManuscriptDownloaderService } from './EnhancedManuscriptDownloaderService.js';
import { configService } from './ConfigService.js';
import { ManifestCache } from './ManifestCache.js';
import type { QueuedManuscript, QueueState, TLibrary, TStage } from '../../shared/queueTypes';

export class EnhancedDownloadQueue extends EventEmitter {
    private static instance: EnhancedDownloadQueue | null = null;
    private state: QueueState;
    private currentDownloader: EnhancedManuscriptDownloaderService | null = null;
    private processingAbortController: AbortController | null = null;
    private store: Store<{ queueState: QueueState }>;
    private queueFile: string;
    private manifestCache: ManifestCache;
    
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
            globalSettings: {
                autoStart: false,
                concurrentDownloads: configService.get('maxConcurrentDownloads'),
                pauseBetweenItems: 0,
                autoSplitThresholdMB: configService.get('autoSplitThreshold') / (1024 * 1024), // Convert bytes to MB
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
            
            // Resume any in-progress items by resetting 'downloading' status to 'queued'
            // Also clean up progress data and other transient fields
            this.state.items.forEach((item) => {
                if (item.status === 'downloading') {
                    item.status = 'queued';
                    item.progress = undefined; // Clear progress data
                    item.eta = undefined; // Clear ETA
                }
                // Also clean up any paused items that might have stale progress data
                if (item.status === 'paused') {
                    item.progress = undefined;
                    item.eta = undefined;
                }
            });
            
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
            
            // If we showed progress, ensure minimum display time of 2 seconds
            if (hasShownProgress) {
                const elapsed = Date.now() - loadingStartTime;
                const minDisplayTime = 2000; // 2 seconds
                if (elapsed < minDisplayTime) {
                    console.log(`Manifest loaded quickly (${elapsed}ms), waiting ${minDisplayTime - elapsed}ms for progress visibility`);
                    await new Promise(resolve => setTimeout(resolve, minDisplayTime - elapsed));
                }
            }
            
            // Update item with manifest information and set status back to queued
            item.status = 'queued';
            item.progress = undefined;
            item.totalPages = manifest.totalPages;
            item.library = manifest.library as TLibrary;
            
            this.saveToStorage();
            this.notifyListeners();
        } catch (error: any) {
            console.warn(`Failed to load manifest for ${item.displayName}: ${error.message}`);
            // Reset status and clear progress on error
            item.status = 'queued';
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
            status: 'queued', // Ensure status is always 'queued' for new items
            ...manuscript,
        };
        
        // Force status to be 'queued' regardless of input
        newItem.status = 'queued';

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

        item.status = 'queued';
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
        
        this.state.isPaused = false;
        await this.processQueue();
    }

    pauseProcessing(): void {
        this.state.isPaused = true;
        if (this.processingAbortController) {
            this.processingAbortController.abort();
        }
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
                const nextItem = this.state.items.find((item) => {
                    if (item.status === 'queued' || item.status === 'pending') {
                        return true;
                    }
                    // Don't auto-retry items that failed with CAPTCHA_REQUIRED
                    if (item.status === 'failed' && item.error && !item.error.includes('CAPTCHA_REQUIRED:')) {
                        return true;
                    }
                    return false;
                });

                if (!nextItem) {
                    break;
                }

                if (this.state.isPaused) {
                    break;
                }

                await this.processItem(nextItem);

                // Pause between items if configured
                if (this.state.globalSettings.pauseBetweenItems > 0) {
                    await this.sleep(this.state.globalSettings.pauseBetweenItems);
                }
            }
        } catch (error: any) {
            console.error('Queue processing error:', error.message);
        } finally {
            this.isProcessingQueue = false;
            this.state.isProcessing = false;
            this.state.currentItemId = undefined;
            this.processingAbortController = null;
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
        
        this.processingAbortController = new AbortController();
        this.notifyListeners();

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
                maxConcurrent: this.state.globalSettings.concurrentDownloads,
                skipExisting: false,
                // Pass through download options for page range
                startPage: item.downloadOptions?.startPage,
                endPage: item.downloadOptions?.endPage,
                // Pass the queue item for manual manifest data
                queueItem: item,
            });

            if (result.success) {
                item.status = 'completed';
                item.completedAt = Date.now();
                item.progress = 1;
                item.outputPath = result.filepath;
                // Do NOT update totalPages here - it should always reflect the manifest total, not download count
                
            } else {
                throw new Error('Download failed without specific error');
            }

        } catch (error: any) {
            if (this.processingAbortController?.signal.aborted) {
                item.status = 'paused';
            } else {
                console.error(`❌ Failed: ${item.displayName} - ${error.message}`);
                item.status = 'failed';
                item.error = error.message;
                item.retryCount = (item.retryCount || 0) + 1;
                
                // Perform error isolation and cache cleanup to prevent corruption spread
                await this.handleDownloadError(item, error);
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
            } else if (!item.isAutoPart && item.status === 'queued') {
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
            const canRecalculate = parts.every(p => p.status === 'queued' || p.status === 'paused');
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
                    status: 'queued',
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
                status: 'queued',
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
            
            // For Florus and Orleans - skip first page download and use estimated size calculation
            if (manifest.library === 'florus' || manifest.library === 'orleans') {
                console.log(`${manifest.library} manuscript detected, using estimated size calculation`);
                // Estimate based on typical manuscript page size
                const avgPageSizeMB = manifest.library === 'orleans' ? 0.6 : 0.4; // 600KB for Orleans IIIF, 400KB for Florus
                const estimatedTotalSizeMB = avgPageSizeMB * manifest.totalPages;
                item.estimatedSizeMB = estimatedTotalSizeMB;
                
                if (estimatedTotalSizeMB > this.state.globalSettings.autoSplitThresholdMB) {
                    await this.splitQueueItem(item, manifest, estimatedTotalSizeMB);
                    return true;
                }
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
            
            if (estimatedTotalSizeMB > this.state.globalSettings.autoSplitThresholdMB) {
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
                status: 'queued',
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
}