import type { DownloadCallbacks } from '../shared/types';
import type { QueuedManuscript, QueueState } from '../shared/queueTypes';
import type { AppConfig } from '../main/services/ConfigService';

// Vue module declarations
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

// Define supported library response types
interface SupportedLibrary {
  key: string;
  name: string;
  baseUrl: string;
  supported: boolean;
}

// Define manuscript parse result
interface ParsedManuscript {
  url: string;
  library: string;
  displayName?: string;
  isSupported: boolean;
}

// Define log entry type
interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  component?: string;
  details?: Record<string, unknown>;
}

declare global {
  interface Window {
    electronAPI: {
      getLanguage: () => Promise<string>;
      downloadManuscript: (url: string, callbacks: DownloadCallbacks) => Promise<{ success: boolean; outputPath?: string; error?: string }>;
      getSupportedLibraries: () => Promise<SupportedLibrary[]>;
      parseManuscriptUrl: (url: string) => Promise<ParsedManuscript>;
      onLanguageChanged: (callback: (language: string) => void) => () => void;
      
      // Queue management
      addToQueue: (manuscript: QueuedManuscript) => Promise<string>;
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
      updateQueueItem: (id: string, updates: Partial<QueuedManuscript>) => Promise<boolean>;
      moveQueueItem: (fromIndex: number, toIndex: number) => Promise<boolean>;
      getQueueState: () => Promise<QueueState>;
      onQueueStateChanged: (callback: (state: QueueState) => void) => () => void;
      
      // Config management
      getConfig: (key: string) => Promise<unknown>;
      setConfig: (key: string, value: unknown) => Promise<void>;
      getAllConfig: () => Promise<AppConfig>;
      setMultipleConfig: (updates: Partial<AppConfig>) => Promise<void>;
      resetConfig: () => Promise<void>;
      onConfigChanged: (callback: (key: string, value: unknown) => void) => () => void;
      onConfigChangedMultiple: (callback: (updates: Partial<AppConfig>) => void) => () => void;
      onConfigReset: (callback: (newConfig: AppConfig) => void) => () => void;
      
      // Cleanup
      cleanupIndexedDBCache: () => Promise<void>;
      
      // External links
      openExternal: (url: string) => Promise<boolean>;
      
      // Download logs
      downloadLogs: () => Promise<{ success: boolean; filepath?: string; error?: string }>;
      
      // Comprehensive logging
      logRendererError: (error: {
        message: string;
        filename?: string;
        lineno?: number;
        colno?: number;
        stack?: string;
        type?: string;
      }) => Promise<void>;
      
      exportLogs: (options?: {
        format?: 'json' | 'readable';
        includeDebug?: boolean;
        compress?: boolean;
      }) => Promise<string>;
      
      getRecentLogs: (count?: number) => Promise<LogEntry[]>;
    };
  }
}

export {};