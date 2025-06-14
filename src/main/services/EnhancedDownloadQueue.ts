import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';
import { app } from 'electron';
import Store from 'electron-store';
import { EnhancedManuscriptDownloaderService } from './EnhancedManuscriptDownloaderService.js';
import { configService } from './ConfigService.js';
import type { QueuedManuscript, QueueState, TLibrary, TStage } from '../../shared/queueTypes';

export class EnhancedDownloadQueue extends EventEmitter {
    private static instance: EnhancedDownloadQueue | null = null;
    private state: QueueState;
    private currentDownloader: EnhancedManuscriptDownloaderService | null = null;
    private processingAbortController: AbortController | null = null;
    private store: Store<{ queueState: QueueState }>;
    private queueFile: string;
    
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
                partSizeMB: configService.get('autoSplitThreshold') / (1024 * 1024), // Convert bytes to MB
            },
        };
        
        this.store = new Store<{ queueState: QueueState }>({ 
            defaults: { queueState: defaultState },
            name: 'queue'
        });
        
        this.state = defaultState;
        this.currentDownloader = new EnhancedManuscriptDownloaderService();
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
            }
            
            // Resume any in-progress items by resetting 'downloading' status to 'queued'
            this.state.items.forEach((item) => {
                if (item.status === 'downloading') item.status = 'queued';
            });
            
            console.log(`📋 Loaded ${this.state.items.length} items from queue`);
        } catch (error: any) {
            console.log('📋 Starting with empty queue');
        }
    }

    private async saveToStorage(): Promise<void> {
        try {
            // Save to both file and electron-store for compatibility
            const data = JSON.stringify(this.state, null, 2);
            await fs.writeFile(this.queueFile, data);
            (this.store as any).set('queueState', this.state);
        } catch (error: any) {
            console.error('Failed to save queue:', error.message);
        }
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
        this.emit('stateChanged', this.state);
    }

    // Queue Management
    addManuscript(manuscript: Omit<QueuedManuscript, 'id' | 'addedAt' | 'status'>): string {
        const canonicalUrl = this.canonicalizeUrl(manuscript.url);
        
        // Check for duplicates
        const existing = this.state.items.find((item) => 
            this.canonicalizeUrl(item.url) === canonicalUrl,
        );
        
        if (existing) {
            console.log(`⚠️  Duplicate URL, skipping: ${manuscript.displayName}`);
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

        console.log(`🔧 Creating new item with status: ${newItem.status}`);
        
        this.state.items.push(newItem);
        
        console.log(`📝 Item in array has status: ${this.state.items[this.state.items.length - 1].status}`);
        
        this.saveToStorage();
        this.notifyListeners();
        
        console.log(`➕ Added to queue: ${newItem.displayName}`);
        
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

        this.state.items = this.state.items.filter((item) => item.id !== id);
        this.saveToStorage();
        this.notifyListeners();
        
        console.log(`🗑️  Removed from queue: ${item.displayName}`);
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

    clearCompleted(): void {
        const completedCount = this.state.items.filter((item) => item.status === 'completed').length;
        this.state.items = this.state.items.filter((item) => item.status !== 'completed');
        this.saveToStorage();
        this.notifyListeners();
        
        console.log(`🧹 Cleared ${completedCount} completed items`);
    }

    clearFailed(): void {
        const failedCount = this.state.items.filter((item) => item.status === 'failed').length;
        this.state.items = this.state.items.filter((item) => item.status !== 'failed');
        this.saveToStorage();
        this.notifyListeners();
        
        console.log(`🧹 Cleared ${failedCount} failed items`);
    }

    clearAll(): void {
        const totalCount = this.state.items.length;
        this.state.items = [];
        this.saveToStorage();
        this.notifyListeners();
        
        console.log(`🧹 Cleared all ${totalCount} items`);
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
        this.processQueue();
    }

    stopProcessing(): void {
        this.state.isProcessing = false;
        this.state.isPaused = false;
        this.state.currentItemId = undefined;
        
        if (this.processingAbortController) {
            this.processingAbortController.abort();
        }
        
        this.notifyListeners();
    }

    // Queue processing
    private async processQueue(): Promise<void> {
        if (this.state.isProcessing || this.state.isPaused) {
            return;
        }

        this.state.isProcessing = true;
        this.notifyListeners();

        try {
            console.log('🔍 Queue processing started');
            console.log(`📊 Total items in queue: ${this.state.items.length}`);
            console.log(`📋 Item statuses:`, this.state.items.map(item => `${item.displayName}: ${item.status}`));
            
            while (true) {
                const nextItem = this.state.items.find((item) => 
                    item.status === 'queued' || item.status === 'failed' || item.status === 'pending',
                );

                if (!nextItem) {
                    console.log('✅ Queue processing completed - no more items');
                    console.log(`📊 Final queue state: ${this.state.items.length} total items`);
                    if (this.state.items.length > 0) {
                        console.log(`📋 Final statuses:`, this.state.items.map(item => `${item.displayName}: ${item.status}`));
                    }
                    break;
                }

                if (this.state.isPaused) {
                    console.log('⏸️  Queue processing paused');
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
            this.state.isProcessing = false;
            this.state.currentItemId = undefined;
            this.processingAbortController = null;
            this.notifyListeners();
        }
    }

    private async processItem(item: QueuedManuscript): Promise<void> {
        console.log(`🔄 Processing: ${item.displayName}`);
        
        this.state.currentItemId = item.id;
        item.status = 'downloading';
        item.startedAt = Date.now();
        item.progress = 0;
        
        this.processingAbortController = new AbortController();
        this.notifyListeners();

        try {
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
            });

            if (result.success) {
                item.status = 'completed';
                item.completedAt = Date.now();
                item.progress = 1;
                item.outputPath = result.filepath;
                // Do NOT update totalPages here - it should always reflect the manifest total, not download count
                
                console.log(`✅ Completed: ${item.displayName}`);
            } else {
                throw new Error('Download failed without specific error');
            }

        } catch (error: any) {
            if (this.processingAbortController?.signal.aborted) {
                console.log(`⏸️  Aborted: ${item.displayName}`);
                item.status = 'paused';
            } else {
                console.error(`❌ Failed: ${item.displayName} - ${error.message}`);
                item.status = 'failed';
                item.error = error.message;
                item.retryCount = (item.retryCount || 0) + 1;
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
}