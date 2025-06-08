import type { DownloadCallbacks } from '../shared/types';

declare global {
  interface Window {
    electronAPI: {
      getLanguage: () => Promise<string>;
      downloadManuscript: (url: string, callbacks: DownloadCallbacks) => Promise<any>;
      getSupportedLibraries: () => Promise<any>;
      parseManuscriptUrl: (url: string) => Promise<any>;
      onLanguageChanged: (callback: (language: string) => void) => () => void;
    };
  }
}

export {};