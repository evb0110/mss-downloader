import { EventEmitter } from 'events';
import { ManuscriptDownloaderService } from './ManuscriptDownloaderService.js';
import { ElectronPdfMerger } from './ElectronPdfMerger.js';
import { configService } from './ConfigService.js';
import type { QueuedManuscript, QueueState, TStage, TLibrary } from '../../shared/queueTypes.js';
import Store from 'electron-store';

export class DownloadQueue extends EventEmitter {
    private static instance: DownloadQueue | null = null;
    private state: QueueState;
    private currentDownloader: ManuscriptDownloaderService | null = null;
    private processingAbortController: AbortController | null = null;
    private pdfMerger: ElectronPdfMerger;
    private store: any;
    
    private constructor(pdfMerger: ElectronPdfMerger) {
        super();
        this.pdfMerger = pdfMerger;
        // Define default state for electron-store
        const defaultState: QueueState = {
            items: [],
            isProcessing: false,
            isPaused: false,
            globalSettings: {
                autoStart: false,
                concurrentDownloads: configService.get('maxConcurrentDownloads'),
                pauseBetweenItems: 0,
                autoSplitThresholdMB: 800,
            },
        };
        this.store = new Store<{
            queueState: QueueState;
        }>({ defaults: { queueState: defaultState } });
        this.state = defaultState; // Initialize state with default before loading from storage
        this.loadFromStorage();
    }
    
    public static getInstance(pdfMerger?: ElectronPdfMerger): DownloadQueue {
        if (!DownloadQueue.instance && pdfMerger) {
            DownloadQueue.instance = new DownloadQueue(pdfMerger);
        }
        if (!DownloadQueue.instance) {
            throw new Error('DownloadQueue not initialized with pdfMerger');
        }
        return DownloadQueue.instance;
    }
    
    // Queue Management
    addManuscript(manuscript: Omit<QueuedManuscript, 'id' | 'addedAt' | 'status'>): string {
        const id = `ms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const queuedManuscript: QueuedManuscript = {
            ...manuscript,
            id,
            addedAt: Date.now(),
            status: 'pending',
            displayName: manuscript.displayName || manuscript.url.substring(0, 50) + '...', // Provide a default display name if not given
            library: manuscript.library || 'loading', // Default to loading until manifest is processed
            totalPages: manuscript.totalPages || 0, // Default to 0 until manifest is processed
        };
        
        this.state.items.push(queuedManuscript);
        this.saveToStorage();
        this.notifyListeners();
        
        return id;
    }

    removeManuscript(id: string): boolean {
        const index = this.state.items.findIndex((item) => item.id === id);
        if (index === -1) return false;
        
        const item = this.state.items[index];
        
        if (item.status === 'downloading' && this.state.currentItemId === id) {
            this.cancelCurrent();
        }
        
        this.state.items.splice(index, 1);
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
    
    updateItem(id: string, updates: Partial<QueuedManuscript>): boolean {
        const item = this.state.items.find((item) => item.id === id);
        if (!item) return false;
        
        Object.assign(item, updates);
        this.saveToStorage();
        this.notifyListeners();
        return true;
    }
    
    clearCompleted(): number {
        const completedCount = this.state.items.filter((item) => item.status === 'completed').length;
        this.state.items = this.state.items.filter((item) => item.status !== 'completed');
        this.saveToStorage();
        this.notifyListeners();
        return completedCount;
    }
    
    clearFailed(): number {
        const failedCount = this.state.items.filter((item) => item.status === 'failed').length;
        this.state.items = this.state.items.filter((item) => item.status !== 'failed');
        this.saveToStorage();
        this.notifyListeners();
        return failedCount;
    }
    
    clearAll(): number {
        const count = this.state.items.length;
        this.stopProcessing();
        this.state.items = [];
        this.saveToStorage();
        this.notifyListeners();
        return count;
    }
    
    async startProcessing(): Promise<void> {
        if (this.state.isProcessing) return;
        
        this.state.isProcessing = true;
        this.state.isPaused = false;
        this.processingAbortController = new AbortController();
        this.notifyListeners();
        
        try {
            while (this.state.isProcessing && !this.processingAbortController?.signal.aborted) {
                const nextItem = this.getNextPendingItem();
                if (!nextItem) {
                    break;
                }
                
                if (this.state.isPaused) {
                    await this.sleep(1000);
                    continue;
                }
                
                await this.processItem(nextItem);
                
                if (this.state.globalSettings.pauseBetweenItems > 0) {
                    await this.sleep(this.state.globalSettings.pauseBetweenItems * 1000);
                }
            }
        } catch (error) {
            console.error('Error in queue processing:', error);
        } finally {
            this.state.isProcessing = false;
            this.state.currentItemId = undefined;
            this.currentDownloader = null;
            this.processingAbortController = null;
            this.notifyListeners();
        }
    }
    
    pauseProcessing(): void {
        this.state.isPaused = true;
        this.notifyListeners();
    }
    
    async resumeProcessing(): Promise<void> {
        if (!this.state.isProcessing) {
            await this.startProcessing();
        } else {
            this.state.isPaused = false;
            this.notifyListeners();
        }
    }
    
    stopProcessing(): void {
        this.state.isProcessing = false;
        this.state.isPaused = false;
        this.cancelCurrent();
        
        if (this.processingAbortController) {
            this.processingAbortController.abort();
            this.processingAbortController = null;
        }
        
        this.notifyListeners();
    }
    
    pauseItem(id: string): boolean {
        const item = this.state.items.find((item) => item.id === id);
        if (!item || item.status !== 'downloading') return false;
        
        item.status = 'paused';
        this.cancelCurrent();
        this.notifyListeners();
        return true;
    }
    
    resumeItem(id: string): boolean {
        const item = this.state.items.find((item) => item.id === id);
        if (!item || item.status !== 'paused') return false;
        
        item.status = 'pending';
        this.notifyListeners();
        return true;
    }
    
    updateSettings(settings: Partial<QueueState['globalSettings']>): void {
        Object.assign(this.state.globalSettings, settings);
        this.saveToStorage();
        this.notifyListeners();
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
            } else if (!item.isAutoPart) {
                standaloneItems.push(item);
            }
        }
        
        // For each parent group, recalculate splits
        for (const [parentId, parts] of parentGroups) {
            if (parts.length > 0) {
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
        
        // Estimate size based on first part if available (rough approximation)
        const estimatedSizeMB = totalPages * 8; // Assume 8MB per page for manuscripts
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
            status: 'pending',
            isAutoPart: false,
            parentId: undefined,
            partInfo: undefined,
            downloadOptions: {
                concurrentDownloads: firstPart.downloadOptions?.concurrentDownloads || 3,
                startPage: 1,
                endPage: totalPages,
            },
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
    
    getState(): QueueState {
        return JSON.parse(JSON.stringify(this.state));
    }
    
    getStatistics() {
        const items = this.state.items;
        return {
            total: items.length,
            pending: items.filter((item) => item.status === 'pending' || item.status === 'loading').length,
            downloading: items.filter((item) => item.status === 'downloading').length,
            completed: items.filter((item) => item.status === 'completed').length,
            failed: items.filter((item) => item.status === 'failed').length,
            paused: items.filter((item) => item.status === 'paused').length,
        };
    }
    
    private async processItem(item: QueuedManuscript): Promise<void> {
        this.state.currentItemId = item.id;
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
        
        try {
            this.currentDownloader = new ManuscriptDownloaderService(this.pdfMerger);
            
            const manifest = await this.currentDownloader.parseManuscriptUrl(item.url);
            
            item.totalPages = manifest.totalPages;
            item.displayName = manifest.displayName;
            item.library = manifest.library as TLibrary;
            item.status = 'downloading';

            const startPage = Math.max(1, item.downloadOptions?.startPage || 1);
            const endPage = Math.min(manifest.totalPages, item.downloadOptions?.endPage || manifest.totalPages);
            const pageCount = endPage - startPage + 1;
            
            const selectedPageLinks = manifest.pageLinks.slice(startPage - 1, endPage);
            
            // Check if document should be auto-split
            const shouldCheckSplit = !item.isAutoPart && pageCount > 50; // Only check for non-part items with decent size
            if (shouldCheckSplit) {
                const splitResult = await this.checkAndSplitLargeDocument(item, manifest, selectedPageLinks);
                if (splitResult) {
                    // Document was split, throw special error to signal queue replacement
                    throw new Error('DOCUMENT_WAS_SPLIT');
                }
            }
            
            let lastProgressUpdate = 0;
            let lastPercentage = -1;
            
            await this.currentDownloader.downloadManuscriptPagesWithOptions(selectedPageLinks, {
                displayName: manifest.displayName,
                startPage,
                endPage,
                totalPages: manifest.totalPages,
                onProgress: (progress) => {
                    if (!this.state.isPaused && item.progress) {
                        const now = Date.now();
                        const calculatedPercentage = Math.round((progress.downloadedPages / pageCount) * 100);
                        const shouldUpdate = (now - lastProgressUpdate > 500) || (calculatedPercentage !== lastPercentage);

                        if (shouldUpdate) {
                            const actualCurrentPage = startPage + progress.downloadedPages - 1;
                            item.progress = {
                                current: progress.downloadedPages,
                                total: pageCount,
                                percentage: calculatedPercentage,
                                eta: this.formatTime(progress.estimatedTimeRemaining || 0),
                                stage: 'downloading' as TStage,
                                actualCurrentPage,
                            };
                            lastProgressUpdate = now;
                            lastPercentage = calculatedPercentage;
                            this.saveToStorage();
                            this.notifyListeners();
                        }
                    }
                },
                onStatusChange: (_status) => {
                    // Not used for queue items directly
                },
                onError: (error) => {
                    throw new Error(error);
                },
            });
            
            item.status = 'completed';
            item.completedAt = Date.now();
            item.progress = undefined;
            
        } catch (error: any) {
            if (error.message === 'DOCUMENT_WAS_SPLIT') {
                // Document was split successfully, just remove current item status
                item.status = 'completed';
                item.progress = undefined;
            } else if (error.name === 'AbortError' || error.message?.includes('abort')) {
                item.status = 'paused';
                item.progress = undefined;
            } else {
                item.status = 'failed';
                item.error = error.message;
                item.progress = undefined;
            }
        } finally {
            this.currentDownloader = null;
        }
        
        this.saveToStorage();
        this.notifyListeners();
    }
    
    private getNextPendingItem(): QueuedManuscript | null {
        return this.state.items.find((item) => item.status === 'pending' || item.status === 'loading') || null;
    }
    
    private cancelCurrent(): void {
        if (this.currentDownloader) {
            this.currentDownloader.abort();
            this.currentDownloader = null;
        }
    }
    
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => {
            const timeout = setTimeout(resolve, ms);
            if (this.processingAbortController?.signal) {
                this.processingAbortController.signal.addEventListener('abort', () => {
                    clearTimeout(timeout);
                    resolve();
                });
            }
        });
    }
    
    private formatTime(milliseconds: number): string {
        const seconds = Math.round(milliseconds / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    }
    
    private notifyListeners(): void {
        this.emit('stateChanged', this.getState());
    }
    
        private saveToStorage(): void {
        this.store.set('queueState', this.state);
    }

    private loadFromStorage(): void {
        const storedState = this.store.get('queueState', this.state) as QueueState;
        this.state = storedState;
    }
    
    private async checkAndSplitLargeDocument(
        item: QueuedManuscript, 
        manifest: any, 
        selectedPageLinks: string[]
    ): Promise<boolean> {
        try {
            // Download first page to get actual size estimation
            const firstPageUrl = selectedPageLinks[0];
            if (!firstPageUrl) return false;
            
            const firstPageBuffer = await this.downloadSinglePage(firstPageUrl);
            
            const firstPageSizeMB = firstPageBuffer.length / (1024 * 1024);
            const estimatedTotalSizeMB = firstPageSizeMB * manifest.totalPages;
            
            if (estimatedTotalSizeMB > this.state.globalSettings.autoSplitThresholdMB) {
                await this.splitQueueItem(item, manifest, estimatedTotalSizeMB);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error checking document size:', error);
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
        return new Promise((resolve, reject) => {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const https = require('https');
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const http = require('http');
            const urlObj = new URL(url);
            const client = urlObj.protocol === 'https:' ? https : http;

            const req = client.request(url, { 
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                }
            }, (res: any) => {
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
} 