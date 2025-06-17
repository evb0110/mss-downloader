export type TStage = 'loading-manifest' | 'downloading' | 'merging' | 'processing' | 'caching' | 'complete';
export type TStatus = 'loading' | 'pending' | 'queued' | 'downloading' | 'completed' | 'failed' | 'paused';
export type TLibrary = 'gallica' | 'unifr' | 'vatlib' | 'cecilia' | 'irht' | 'dijon' | 'laon' | 'durham' | 'sharedcanvas' | 'ugent' | 'bl' | 'loading';

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
    progress?: number | {
        current: number;
        total: number;
        percentage: number;
        eta: string;
        stage: TStage;
        actualCurrentPage?: number; // For page range downloads, shows the actual page being downloaded
    };
    eta?: string;
    error?: string;
    retryCount?: number;
    outputPath?: string;
    downloadOptions?: {
        concurrentDownloads: number;
        startPage?: number;
        endPage?: number;
    };
    // Auto-split fields
    parentId?: string;
    isAutoPart?: boolean;
    partInfo?: {
        partNumber: number;
        totalParts: number;
        originalDisplayName: string;
        pageRange: { start: number; end: number };
    };
    estimatedSizeMB?: number; // Estimated size based on actual downloaded data
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
        autoSplitThresholdMB: number; // Size limit in MB for auto-splitting
    };
} 