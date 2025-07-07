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
  library: 'nypl' | 'morgan' | 'gallica' | 'grenoble' | 'karlsruhe' | 'manchester' | 'unifr' | 'e_manuscripta' | 'vatlib' | 'cecilia' | 'irht' | 'dijon' | 'laon' | 'durham' | 'florus' | 'unicatt' | 'cudl' | 'trinity_cam' | 'toronto' | 'fulda' | 'isos' | 'mira' | 'orleans' | 'rbme' | 'parker' | 'manuscripta' | 'internet_culturale' | 'graz' | 'cologne' | 'vienna_manuscripta' | 'rome' | 'berlin' | 'czech' | 'modena' | 'bdl' | 'europeana' | 'monte_cassino' | 'vallicelliana' | 'verona' | 'diamm' | 'bne' | 'belgica_kbr' | 'mdc_catalonia' | 'bvpb' | 'onb' | 'rouen' | 'freiburg' | 'sharedcanvas' | 'saint_omer' | 'ugent' | 'bl';
  displayName: string;
  originalUrl: string;
  startPageFromUrl?: number; // Optional: page number specified in URL for range starting
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