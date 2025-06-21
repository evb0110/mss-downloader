export interface DownloadProgress {
  totalPages: number;
  downloadedPages: number;
  currentPage: number;
  totalImages: number;
  downloadedImages: number;
  currentImageIndex: number;
  pagesProcessed: number;
  percentage: number;
  elapsedTime: number;
  estimatedTimeRemaining: number;
  bytesDownloaded: number;
  bytesTotal: number;
  downloadSpeed: number;
}

export interface DownloadStatus {
  phase: 'parsing' | 'downloading' | 'processing' | 'completed' | 'error';
  message: string;
}

export interface DownloadCallbacks {
  onProgress?: (progress: DownloadProgress) => void;
  onStatusChange?: (status: DownloadStatus) => void;
  onError?: (error: string) => void;
}

export interface ManuscriptManifest {
  pageLinks: string[];
  totalPages: number;
  library: 'nypl' | 'gallica' | 'unifr' | 'vatlib' | 'cecilia' | 'irht' | 'dijon' | 'laon' | 'durham' | 'florus' | 'unicatt' | 'cudl' | 'trinity_cam' | 'isos' | 'mira' | 'orleans' | 'rbme' | 'parker' | 'manuscripta' | 'internet_culturale';
  displayName: string;
  originalUrl: string;
}

export interface LibraryInfo {
  name: string;
  example: string;
  description: string;
}

export interface ElectronAPI {
  getLanguage: () => Promise<string>;
  downloadManuscript: (url: string, callbacks: DownloadCallbacks) => Promise<void>;
  getSupportedLibraries: () => Promise<LibraryInfo[]>;
  parseManuscriptUrl: (url: string) => Promise<ManuscriptManifest>;
  onLanguageChanged: (callback: (language: string) => void) => () => void;
  clearCache: () => Promise<void>;
  getCacheStats: () => Promise<{ size: number; entries: number }>;
  solveCaptcha: (url: string) => Promise<{ success: boolean; content?: string; error?: string }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}