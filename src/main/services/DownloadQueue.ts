import { EventEmitter } from 'events';
import { UnifiedManuscriptDownloader } from './UnifiedManuscriptDownloader.js';
import { ElectronPdfMerger } from './ElectronPdfMerger.js';
import type { QueuedManuscript, QueueState, TStage, TLibrary } from '../../shared/queueTypes.js';
import Store from 'electron-store';

export class DownloadQueue extends EventEmitter {
    private static instance: DownloadQueue | null = null;
    private state: QueueState;
    private currentDownloader: UnifiedManuscriptDownloader | null = null;
    private processingAbortController: AbortController | null = null;
    private pdfMerger: ElectronPdfMerger;
    private store: Store<{
        queueState: QueueState;
    }>;
    
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
                concurrentDownloads: 3,
                pauseBetweenItems: 0,
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
    
    resumeProcessing(): void {
        this.state.isPaused = false;
        this.notifyListeners();
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
            this.currentDownloader = new UnifiedManuscriptDownloader(this.pdfMerger);
            
            const manifest = await this.currentDownloader.parseManuscriptUrl(item.url);
            
            item.totalPages = manifest.totalPages;
            item.displayName = manifest.displayName;
            item.library = manifest.library as TLibrary;
            item.status = 'downloading';

            const startPage = Math.max(1, item.downloadOptions?.startPage || 1);
            const endPage = Math.min(manifest.totalPages, item.downloadOptions?.endPage || manifest.totalPages);
            const pageCount = endPage - startPage + 1;
            
            const selectedPageLinks = manifest.pageLinks.slice(startPage - 1, endPage);
            
            let lastProgressUpdate = 0;
            let lastPercentage = -1;

            await this.currentDownloader.downloadManuscriptPages(selectedPageLinks, {
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
            if (error.name === 'AbortError' || error.message?.includes('abort')) {
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
        this.state = this.store.get('queueState');
    }
} 