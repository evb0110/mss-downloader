import { contextBridge, ipcRenderer } from 'electron';
import type { DownloadProgress, DownloadStatus, DownloadCallbacks } from '../shared/types';
import type { QueueState, QueuedManuscript } from '../shared/queueTypes';

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

  getSupportedLibraries: () => ipcRenderer.invoke('get-supported-libraries'),
  
  parseManuscriptUrl: (url: string) => ipcRenderer.invoke('parse-manuscript-url', url),

  onLanguageChanged: (callback: (language: string) => void) => {
    ipcRenderer.on('language-changed', (_, language) => callback(language));
    return () => ipcRenderer.removeAllListeners('language-changed');
  },

  // Queue management methods
  addToQueue: (manuscript: Omit<QueuedManuscript, 'id' | 'addedAt' | 'status'>) => 
    ipcRenderer.invoke('queue-add-manuscript', manuscript),
  
  removeFromQueue: (id: string) => 
    ipcRenderer.invoke('queue-remove-manuscript', id),
  
  startQueueProcessing: () => 
    ipcRenderer.invoke('queue-start-processing'),
  
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
  
  getQueueState: () => 
    ipcRenderer.invoke('queue-get-state'),
  
  onQueueStateChanged: (callback: (state: QueueState) => void) => {
    ipcRenderer.on('queue-state-changed', (_, state) => callback(state));
    return () => ipcRenderer.removeAllListeners('queue-state-changed');
  }
};

contextBridge.exposeInMainWorld('electronAPI', api);
console.log('electronAPI exposed to main world');