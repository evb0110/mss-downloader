import { contextBridge, ipcRenderer } from 'electron';
import type { DownloadProgress, DownloadStatus, DownloadCallbacks, LibraryInfo, UnifiedManifest } from '../shared/types';
import type { QueuedManuscript, QueueState } from '../shared/queueTypes';

console.log('Preload script loaded');

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
  parseManuscriptUrl: (url: string): Promise<UnifiedManifest> => ipcRenderer.invoke('parse-manuscript-url', url),

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
  
  getQueueState: (): Promise<QueueState> => 
    ipcRenderer.invoke('queue-get-state'),
  
  onQueueStateChanged: (callback: (state: QueueState) => void) => {
    ipcRenderer.on('queue-state-changed', (_, state) => callback(state));
    // Return unsubscribe function
    return () => ipcRenderer.removeAllListeners('queue-state-changed');
  },

  // No direct IndexedDB cleanup from renderer, will be part of main process/queue logic if needed
  cleanupIndexedDBCache: () => ipcRenderer.invoke('cleanup-indexeddb-cache'),
};

contextBridge.exposeInMainWorld('electronAPI', api);
console.log('electronAPI exposed to main world');