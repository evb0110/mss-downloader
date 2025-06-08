import { contextBridge, ipcRenderer } from 'electron';
import type { DownloadProgress, DownloadStatus, DownloadCallbacks } from '../shared/types';

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
  }
};

contextBridge.exposeInMainWorld('electronAPI', api);
console.log('electronAPI exposed to main world');