export interface TileCoordinate {
  x: number;
  y: number;
  z: number;
}

export interface TileGridConfig {
  gridWidth: number;
  gridHeight: number;
  tileWidth: number;
  tileHeight: number;
  zoomLevel: number;
  totalWidth?: number;
  totalHeight?: number;
  overlap?: number;
  format?: 'jpg' | 'png' | 'webp';
}

export interface TileAuthConfig {
  type: 'none' | 'referrer' | 'cookies' | 'bearer' | 'basic' | 'custom';
  referrer?: string;
  cookies?: Record<string, string>;
  token?: string;
  username?: string;
  password?: string;
  customHeaders?: Record<string, string>;
}

export interface TileStitchingOptions {
  outputFormat: 'jpg' | 'png' | 'webp';
  quality?: number;
  compression?: number;
  maxMemoryUsage?: number;
  useStreaming?: boolean;
  tempDirectory?: string;
}

export interface TileDownloadProgress {
  totalTiles: number;
  downloadedTiles: number;
  currentTile: TileCoordinate;
  percentage: number;
  elapsedTime: number;
  estimatedTimeRemaining: number;
  bytesDownloaded: number;
  bytesTotal: number;
  downloadSpeed: number;
  failedTiles: TileCoordinate[];
}

export interface TileDownloadResult {
  success: boolean;
  coordinate: TileCoordinate;
  buffer?: Buffer;
  path?: string;
  error?: string;
  retryCount?: number;
  downloadTime?: number;
}

export interface TileDownloadCallbacks {
  onProgress?: (progress: TileDownloadProgress) => void;
  onTileDownloaded?: (coordinate: TileCoordinate, buffer: Buffer) => void;
  onTileError?: (coordinate: TileCoordinate, error: Error) => void;
  onComplete?: (outputPath: string, totalTime: number) => void;
  onError?: (error: Error) => void;
}

export interface TileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    actualDimensions?: { width: number; height: number };
    expectedDimensions?: { width: number; height: number };
    tileCount?: number;
    totalSize?: number;
  };
}

export interface ITileAdapter {
  readonly name: string;
  readonly description: string;
  readonly supportedFormats: string[];
  
  validateUrl(url: string): Promise<boolean>;
  analyzeManuscriptPage(url: string): Promise<TileGridConfig>;
  generateTileUrls(baseUrl: string, config: TileGridConfig): Promise<string[]>;
  getAuthConfig(baseUrl: string): Promise<TileAuthConfig>;
  validateTileResponse(response: Buffer, coordinate: TileCoordinate): Promise<TileValidationResult>;
  optimizeGridConfig(config: TileGridConfig): Promise<TileGridConfig>;
}

export interface TileEngineConfig {
  maxConcurrentDownloads: number;
  retryAttempts: number;
  retryDelay: number;
  timeoutMs: number;
  rateLimit: {
    requestsPerSecond: number;
    burstSize: number;
  };
  caching: {
    enabled: boolean;
    maxSize: number;
    ttlMs: number;
  };
  stitching: TileStitchingOptions;
}

export interface TileEngineResult {
  success: boolean;
  outputPath?: string;
  totalTime: number;
  totalTiles: number;
  downloadedTiles: number;
  failedTiles: TileCoordinate[];
  errors: string[];
  metadata: {
    gridConfig: TileGridConfig;
    authConfig: TileAuthConfig;
    finalDimensions: { width: number; height: number };
    totalBytes: number;
  };
}