export interface DownloadProgress {
  totalPages: number;
  downloadedPages: number;
  currentPage: number;
  totalImages: number;
  downloadedImages: number;
  currentImageIndex: number;
  pagesProcessed: number;
  percentage: number;
  progress?: number; // Alternative progress field
  elapsedTime: number;
  estimatedTimeRemaining: number;
  eta?: number; // Estimated time of arrival
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
  library: 'nypl' | 'morgan' | 'gallica' | 'grenoble' | 'karlsruhe' | 'manchester' | 'munich' | 'unifr' | 'e_manuscripta' | 'vatlib' | 'cecilia' | 'irht' | 'loc' | 'dijon' | 'laon' | 'durham' | 'florus' | 'unicatt' | 'cudl' | 'trinity_cam' | 'toronto' | 'fulda' | 'isos' | 'mira' | 'arca' | 'rbme' | 'parker' | 'manuscripta' | 'internet_culturale' | 'graz' | 'gams' | 'cologne' | 'vienna_manuscripta' | 'rome' | 'berlin' | 'czech' | 'modena' | 'bdl' | 'europeana' | 'monte_cassino' | 'vallicelliana' | 'omnes_vallicelliana' | 'verona' | 'diamm' | 'bne' | 'mdc_catalonia' | 'bvpb' | 'onb' | 'rouen' | 'freiburg' | 'sharedcanvas' | 'saint_omer' | 'ugent' | 'bl' | 'bodleian' | 'wolfenbuettel' | 'florence' | 'hhu' | 'vatican' | 'belgica_kbr' | 'bordeaux' | 'linz';
  displayName: string;
  title?: string; // Optional title property
  originalUrl: string;
  startPageFromUrl?: number; // Optional: page number specified in URL for range starting
  requiresTileProcessor?: boolean; // Optional: indicates if tile processing is needed
  tileConfig?: Record<string, unknown>; // Optional: tile configuration data
  pageBlocks?: Record<string, unknown>; // Optional: page block data for special processing
  partInfo?: {
    partNumber: number;
    totalParts: number;
    originalDisplayName: string;
    pageRange: { start: number; end: number };
  };
}

export interface LibraryInfo {
  name: string;
  example: string;
  description: string;
  status?: 'temporarily_unavailable' | 'operational';
  geoBlocked?: boolean;
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
  logRendererError: (error: { message: string; filename?: string; lineno?: number; colno?: number; stack?: string; type: string }) => void;
  updateRenderingProgress: (stage: string, message: string, percentage: number) => Promise<void>;
  saveImageFile: (filePath: string, data: Uint8Array) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}