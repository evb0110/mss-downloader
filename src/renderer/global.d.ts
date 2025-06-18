import type { DownloadCallbacks } from '../shared/types';

// Vue module declarations
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, any>
  export default component
}

declare global {
  interface Window {
    electronAPI: {
      getLanguage: () => Promise<string>;
      downloadManuscript: (url: string, callbacks: DownloadCallbacks) => Promise<any>;
      getSupportedLibraries: () => Promise<any>;
      parseManuscriptUrl: (url: string) => Promise<any>;
      onLanguageChanged: (callback: (language: string) => void) => () => void;
      
      // Queue management
      addToQueue: (manuscript: any) => Promise<string>;
      removeFromQueue: (id: string) => Promise<boolean>;
      startQueueProcessing: () => Promise<void>;
      pauseQueueProcessing: () => Promise<void>;
      resumeQueueProcessing: () => Promise<void>;
      stopQueueProcessing: () => Promise<void>;
      pauseQueueItem: (id: string) => Promise<boolean>;
      resumeQueueItem: (id: string) => Promise<boolean>;
      clearCompletedFromQueue: () => Promise<void>;
      clearFailedFromQueue: () => Promise<void>;
      clearAllFromQueue: () => Promise<void>;
      updateQueueItem: (id: string, updates: any) => Promise<boolean>;
      moveQueueItem: (fromIndex: number, toIndex: number) => Promise<boolean>;
      getQueueState: () => Promise<any>;
      onQueueStateChanged: (callback: (state: any) => void) => () => void;
      
      // Config management
      getConfig: (key: string) => Promise<any>;
      setConfig: (key: string, value: any) => Promise<void>;
      getAllConfig: () => Promise<Record<string, any>>;
      setMultipleConfig: (updates: Record<string, any>) => Promise<void>;
      resetConfig: () => Promise<void>;
      onConfigChanged: (callback: (key: string, value: any) => void) => () => void;
      onConfigChangedMultiple: (callback: (updates: Record<string, any>) => void) => () => void;
      onConfigReset: (callback: (newConfig: Record<string, any>) => void) => () => void;
      
      // Cleanup
      cleanupIndexedDBCache: () => Promise<void>;
      
      // External links
      openExternal: (url: string) => Promise<boolean>;
    };
  }
}

export {};