import { contextBridge, ipcRenderer } from 'electron';
import type { DownloadProgress, DownloadStatus, DownloadCallbacks, LibraryInfo, ManuscriptManifest } from '../shared/types';
import type { QueuedManuscript, QueueState } from '../shared/queueTypes';
import type { ConversionSettings, ConversionProgress } from '../main/services/NegativeConverterService';


const api = {
  getLanguage: () => ipcRenderer.invoke('get-language'),
  
  downloadManuscript: (url: string, callbacks: DownloadCallbacks) => {
    const cleanup = () => {
      ipcRenderer.removeAllListeners('download-progress');
      ipcRenderer.removeAllListeners('download-status');
      ipcRenderer.removeAllListeners('download-error');
    };

    ipcRenderer.on('download-progress', (_, progress: DownloadProgress) => {
      callbacks.onProgress?.(progress);
    });

    ipcRenderer.on('download-status', (_, status: DownloadStatus) => {
      callbacks.onStatusChange?.(status);
    });

    ipcRenderer.on('download-error', (_, error: string) => {
      callbacks.onError?.(error);
      cleanup();
    });

    return ipcRenderer.invoke('download-manuscript', url, callbacks).finally(cleanup);
  },

  // Old methods (keep for now, will remove if no longer needed by ManuscriptDownloader.vue)
  getSupportedLibraries: (): Promise<LibraryInfo[]> => ipcRenderer.invoke('get-supported-libraries'),
  
  // ULTRA-PRIORITY FIX for Issue #2: Enhanced manifest loading with chunking support for large manifests
  parseManuscriptUrl: async (url: string): Promise<ManuscriptManifest> => {
    try {
      // First try the chunked handler which can handle both small and large manifests
      const response = await ipcRenderer.invoke('parse-manuscript-url-chunked', url);
      
      if (!response.isChunked) {
        // Small manifest, return directly
        return response.manifest;
      }
      
      // Large manifest needs chunking - fetch in chunks to avoid IPC timeout
      const chunks: string[] = [];
      let chunkIndex = 0;
      let isComplete = false;
      
      while (!isComplete) {
        const chunkData = await ipcRenderer.invoke('get-manifest-chunk', url, chunkIndex, response.chunkSize);
        chunks.push(chunkData.chunk);
        isComplete = chunkData.isLastChunk;
        chunkIndex++;
        
        // Safety check to prevent infinite loops
        if (chunkIndex > 1000) {
          throw new Error('Too many chunks, possible infinite loop');
        }
      }
      
      // Reassemble the manifest from chunks
      const manifestString = chunks.join('');
      return JSON.parse(manifestString);
      
    } catch (error: any) {
      // Fallback to original handler if chunked handler is not available (backward compatibility)
      if ((error instanceof Error && error.message?.includes('No handler registered')) || (error instanceof Error && error.message?.includes('is not a function'))) {
        console.log('Chunked handler not available, falling back to original handler');
        // ULTRA-PRIORITY FIX for Issue #2: Original handler now properly throws errors
        // No need for error object handling - IPC will properly serialize thrown errors
        return await ipcRenderer.invoke('parse-manuscript-url', url);
      }
      throw error;
    }
  },

  onLanguageChanged: (callback: (language: string) => void) => {
    ipcRenderer.on('language-changed', (_, language) => callback(language));
    return () => ipcRenderer.removeAllListeners('language-changed');
  },

  // Queue management methods (updated for bulk and detailed control)
  addToQueue: (manuscript: Omit<QueuedManuscript, 'id' | 'addedAt' | 'status'>) => 
    ipcRenderer.invoke('queue-add-manuscript', manuscript),
  
  // Bulk add is handled by adding individual manuscripts with temporary status
  
  removeFromQueue: (id: string) => 
    ipcRenderer.invoke('queue-remove-manuscript', id),
  
  startQueueProcessing: () => 
    ipcRenderer.invoke('queue-start-processing'),
  
  pauseQueueProcessing: () => 
    ipcRenderer.invoke('queue-pause-processing'),

  resumeQueueProcessing: () => 
    ipcRenderer.invoke('queue-resume-processing'),

  stopQueueProcessing: () => 
    ipcRenderer.invoke('queue-stop-processing'),
  
  pauseQueueItem: (id: string) => 
    ipcRenderer.invoke('queue-pause-item', id),
  
  resumeQueueItem: (id: string) => 
    ipcRenderer.invoke('queue-resume-item', id),
  
  clearCompletedFromQueue: () => 
    ipcRenderer.invoke('queue-clear-completed'),
  
  clearFailedFromQueue: () => 
    ipcRenderer.invoke('queue-clear-failed'),

  clearAllFromQueue: () =>
    ipcRenderer.invoke('queue-clear-all'),

  updateQueueItem: (id: string, updates: Partial<QueuedManuscript>) =>
    ipcRenderer.invoke('queue-update-item', id, updates),

  moveQueueItem: (fromIndex: number, toIndex: number) =>
    ipcRenderer.invoke('queue-move-item', fromIndex, toIndex),
  
  getQueueState: (): Promise<QueueState> => 
    ipcRenderer.invoke('queue-get-state'),
  
  updateAutoSplitThreshold: (thresholdMB: number) =>
    ipcRenderer.invoke('queue-update-autosplit-threshold', thresholdMB),
  
  // Simultaneous download methods
  startAllSimultaneous: () =>
    ipcRenderer.invoke('queue-start-all-simultaneous'),
  
  startItemIndividually: (id: string) =>
    ipcRenderer.invoke('queue-start-item-individual', id),
  
  setSimultaneousMode: (mode: string, maxCount?: number) =>
    ipcRenderer.invoke('queue-set-simultaneous-mode', mode, maxCount),
  
  getSimultaneousState: () =>
    ipcRenderer.invoke('queue-get-simultaneous-state'),
  
  onQueueStateChanged: (callback: (state: QueueState) => void) => {
    ipcRenderer.on('queue-state-changed', (_, state) => callback(state));
    // Return unsubscribe function
    return () => ipcRenderer.removeAllListeners('queue-state-changed');
  },

  // Cache management
  cleanupIndexedDBCache: () => ipcRenderer.invoke('cleanup-indexeddb-cache'),
  clearManifestCache: () => ipcRenderer.invoke('clear-manifest-cache'),
  clearAllCaches: () => ipcRenderer.invoke('clear-all-caches'),
  // Fixed: Added missing clearCache method that UI was calling
  clearCache: () => ipcRenderer.invoke('clear-all-caches'), // Alias for backward compatibility with UI
  // Fixed: Added missing getCacheStats method for cache statistics display
  getCacheStats: () => ipcRenderer.invoke('get-cache-stats'),

  // Downloads folder management
  openDownloadsFolder: () => ipcRenderer.invoke('open-downloads-folder'),
  getDownloadsPath: () => ipcRenderer.invoke('get-downloads-path'),
  chooseSaveDirectory: () => ipcRenderer.invoke('choose-save-directory'),
  showItemInFinder: (filePath: string) => ipcRenderer.invoke('show-item-in-finder', filePath),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  
  // Logs management
  openLogsFolder: () => ipcRenderer.invoke('open-logs-folder'),
  getLogsFolderPath: () => ipcRenderer.invoke('get-logs-folder-path'),
  exportLogsNow: () => ipcRenderer.invoke('export-logs-now'),
  
  // Download logs
  downloadLogs: () => ipcRenderer.invoke('download-logs'),

  // Config management methods
  getConfig: (key: string) => ipcRenderer.invoke('config-get', key),
  setConfig: (key: string, value: unknown) => ipcRenderer.invoke('config-set', key, value),
  getAllConfig: () => ipcRenderer.invoke('config-get-all'),
  setMultipleConfig: (updates: Record<string, unknown>) => ipcRenderer.invoke('config-set-multiple', updates),
  resetConfig: () => ipcRenderer.invoke('config-reset'),

  onConfigChanged: (callback: (key: string, value: unknown) => void) => {
    ipcRenderer.on('config-changed', (_, key, value) => callback(key, value));
    return () => ipcRenderer.removeAllListeners('config-changed');
  },

  onConfigChangedMultiple: (callback: (updates: Record<string, unknown>) => void) => {
    ipcRenderer.on('config-changed-multiple', (_, updates) => callback(updates));
    return () => ipcRenderer.removeAllListeners('config-changed-multiple');
  },

  onConfigReset: (callback: (newConfig: Record<string, unknown>) => void) => {
    ipcRenderer.on('config-reset', (_, newConfig) => callback(newConfig));
    return () => ipcRenderer.removeAllListeners('config-reset');
  },

  // Captcha solving
  solveCaptcha: (url: string) => ipcRenderer.invoke('solve-captcha', url),
  
  // Network health and resilience
  getNetworkHealth: () => ipcRenderer.invoke('get-network-health'),
  resetCircuitBreaker: (libraryName: string) => ipcRenderer.invoke('reset-circuit-breaker', libraryName),
  
  // Negative converter methods
  convertNegativeToPositive: (data: { fileData: ArrayBuffer | Uint8Array | number[]; fileName: string; settings: ConversionSettings; outputDirectory?: string }) => 
    ipcRenderer.invoke('convert-negative-to-positive', data),
  
  saveImageFile: (filePath: string, imageData: Uint8Array) => 
    ipcRenderer.invoke('save-image-file', filePath, imageData),
  
  openInFolder: (filePath: string) => 
    ipcRenderer.invoke('open-in-folder', filePath),
  
  onNegativeConversionProgress: (callback: (progress: ConversionProgress) => void) => {
    ipcRenderer.on('negative-conversion-progress', (_, progress) => callback(progress));
    return () => ipcRenderer.removeAllListeners('negative-conversion-progress');
  },
  
  stopNegativeConversion: () => 
    ipcRenderer.invoke('stop-negative-conversion'),
  
  onPdfRenderingRequest: (callback: (data: { pdfPath: string, outputDir: string, finalOutputDir: string, originalBaseName: string }) => void) => {
    ipcRenderer.on('start-pdf-rendering', (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('start-pdf-rendering');
  },
  
  notifyRenderingComplete: (pageCount: number) => 
    ipcRenderer.invoke('pdf-rendering-complete', pageCount),
  
  notifyRenderingError: (error: string) => 
    ipcRenderer.invoke('pdf-rendering-error', error),
  
  updateRenderingProgress: (stage: string, message: string, progress?: number) => 
    ipcRenderer.invoke('pdf-rendering-progress', { stage, message, progress }),
  
  // Logging methods
  logRendererError: (error: {
    message: string;
    filename?: string;
    lineno?: number;
    colno?: number;
    stack?: string;
    type?: string;
  }) => ipcRenderer.invoke('log-renderer-error', error),
  
  exportLogs: (options?: {
    format?: 'json' | 'readable';
    includeDebug?: boolean;
    compress?: boolean;
  }) => ipcRenderer.invoke('export-logs', options),
  
  getRecentLogs: (count?: number) => ipcRenderer.invoke('get-recent-logs', count),
};

try {
  contextBridge.exposeInMainWorld('electronAPI', api);
} catch (error) {
  console.error('Failed to expose electronAPI:', error);
}