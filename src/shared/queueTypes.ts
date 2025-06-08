export type TStage = 'downloading' | 'merging' | 'processing' | 'caching' | 'complete';
export type TStatus = 'loading' | 'pending' | 'downloading' | 'completed' | 'failed' | 'paused';
export type TLibrary = 'gallica' | 'unifr' | 'vatlib' | 'cecilia' | 'irht' | 'dijon' | 'laon' | 'durham' | 'loading';

export interface QueuedManuscript {
    id: string;
    url: string;
    displayName: string;
    library: TLibrary;
    totalPages: number;
    status: TStatus;
    addedAt: number;
    startedAt?: number;
    completedAt?: number;
    progress?: {
        current: number;
        total: number;
        percentage: number;
        eta: string;
        stage: TStage;
        actualCurrentPage?: number; // For page range downloads, shows the actual page being downloaded
    };
    error?: string;
    downloadOptions?: {
        concurrentDownloads: number;
        startPage?: number;
        endPage?: number;
    };
}

export interface QueueState {
    items: QueuedManuscript[];
    isProcessing: boolean;
    isPaused: boolean;
    currentItemId?: string;
    globalSettings: {
        autoStart: boolean;
        concurrentDownloads: number;
        pauseBetweenItems: number; // seconds
    };
} 