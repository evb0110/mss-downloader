import * as path from 'path';
import { app } from 'electron';
import { TileEngineCore } from './TileEngineCore.js';
import {
  TileEngineConfig,
  TileEngineResult,
  TileDownloadCallbacks,
  ITileAdapter,
  TileDownloadProgress
} from './interfaces.js';

export class TileEngineService {
  private engine: TileEngineCore;
  private defaultConfig: TileEngineConfig;

  constructor(config?: Partial<TileEngineConfig>) {
    this.defaultConfig = {
      maxConcurrentDownloads: 5,
      retryAttempts: 3,
      retryDelay: 1000,
      timeoutMs: 30000,
      rateLimit: {
        requestsPerSecond: 2,
        burstSize: 5
      },
      caching: {
        enabled: true,
        maxSize: 100 * 1024 * 1024,
        ttlMs: 24 * 60 * 60 * 1000
      },
      stitching: {
        outputFormat: 'jpg',
        quality: 95,
        compression: 95,
        maxMemoryUsage: 512 * 1024 * 1024,
        useStreaming: true,
        tempDirectory: path.join(app.getPath('temp'), 'tile-engine')
      },
      ...config
    };

    this.engine = new TileEngineCore(this.defaultConfig);
    this.registerDefaultAdapters();
  }

  private registerDefaultAdapters(): void {
    // No default adapters currently registered
  }

  async downloadTilesAndStitch(
    url: string,
    outputPath: string,
    callbacks?: TileDownloadCallbacks
  ): Promise<TileEngineResult> {
    const adapter = await this.detectAdapter(url);
    
    if (!adapter) {
      throw new Error(`No suitable tile adapter found for URL: ${url}`);
    }

    return this.engine.downloadTilesAndStitch(
      url,
      adapter.name,
      outputPath,
      callbacks
    );
  }

  async detectAdapter(url: string): Promise<ITileAdapter | null> {
    const availableAdapters = this.engine.getAvailableAdapters();
    
    for (const adapterName of availableAdapters) {
      const adapter = this.engine.getAdapter(adapterName);
      if (adapter && await adapter.validateUrl(url)) {
        return adapter;
      }
    }
    
    return null;
  }

  async analyzeUrl(url: string): Promise<{
    adapter: ITileAdapter;
    gridConfig: any;
    authConfig: any;
    estimatedTiles: number;
    estimatedSize: number;
    estimatedTime: number;
  } | null> {
    const adapter = await this.detectAdapter(url);
    
    if (!adapter) {
      return null;
    }

    try {
      const gridConfig = await adapter.analyzeManuscriptPage(url);
      const authConfig = await adapter.getAuthConfig(url);
      const estimatedTiles = gridConfig.gridWidth * gridConfig.gridHeight;
      const estimatedSize = estimatedTiles * 50 * 1024; // 50KB per tile estimate
      const estimatedTime = Math.ceil(estimatedTiles / this.defaultConfig.rateLimit.requestsPerSecond);

      return {
        adapter,
        gridConfig,
        authConfig,
        estimatedTiles,
        estimatedSize,
        estimatedTime
      };
    } catch (error) {
      console.error('Error analyzing URL:', (error as Error).message);
      return null;
    }
  }

  getSupportedAdapters(): string[] {
    return this.engine.getAvailableAdapters();
  }

  getAdapterInfo(name: string): ITileAdapter | undefined {
    return this.engine.getAdapter(name);
  }

  async isTileBasedUrl(url: string): Promise<boolean> {
    const adapter = await this.detectAdapter(url);
    return adapter !== null;
  }

  createProgressCallback(
    onProgress?: (progress: any) => void,
    onStatusChange?: (status: any) => void
  ): TileDownloadCallbacks {
    return {
      onProgress: (progress: TileDownloadProgress) => {
        onProgress?.({
          totalPages: 1,
          downloadedPages: 0,
          currentPage: 1,
          totalImages: progress.totalTiles,
          downloadedImages: progress.downloadedTiles,
          currentImageIndex: progress.downloadedTiles,
          pagesProcessed: 0,
          percentage: progress.percentage,
          elapsedTime: progress.elapsedTime,
          estimatedTimeRemaining: progress.estimatedTimeRemaining,
          bytesDownloaded: progress.bytesDownloaded,
          bytesTotal: progress.bytesTotal,
          downloadSpeed: progress.downloadSpeed
        });
      },
      onComplete: (outputPath: string, _totalTime: number) => {
        onStatusChange?.({
          phase: 'completed',
          message: `Tile download completed: ${outputPath}`
        });
      },
      onError: (error: Error) => {
        onStatusChange?.({
          phase: 'error',
          message: `Tile download failed: ${error.message}`
        });
      }
    };
  }

  async downloadWithProgressIntegration(
    url: string,
    outputPath: string,
    onProgress?: (progress: any) => void,
    onStatusChange?: (status: any) => void
  ): Promise<TileEngineResult> {
    onStatusChange?.({
      phase: 'parsing',
      message: 'Analyzing tile-based manuscript page...'
    });

    const analysis = await this.analyzeUrl(url);
    if (!analysis) {
      throw new Error('URL is not supported by any tile adapter');
    }

    onStatusChange?.({
      phase: 'downloading',
      message: `Downloading ${analysis.estimatedTiles} tiles using ${analysis.adapter.name} adapter...`
    });

    const callbacks = this.createProgressCallback(onProgress, onStatusChange);
    
    const result = await this.downloadTilesAndStitch(url, outputPath, callbacks);
    
    if (result.success) {
      onStatusChange?.({
        phase: 'completed',
        message: `Successfully downloaded and stitched ${result.downloadedTiles} tiles`
      });
    } else {
      onStatusChange?.({
        phase: 'error',
        message: `Failed to download tiles: ${result.errors.join(', ')}`
      });
    }

    return result;
  }

  async validateTileSystem(url: string): Promise<{
    isValid: boolean;
    adapter?: string;
    gridConfig?: any;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const analysis = await this.analyzeUrl(url);
      
      if (!analysis) {
        errors.push('No suitable tile adapter found for this URL');
        return { isValid: false, errors, warnings };
      }

      const testTileUrl = await analysis.adapter.generateTileUrls(url, analysis.gridConfig);
      
      if (testTileUrl.length === 0) {
        errors.push('No tiles could be generated for this URL');
        return { isValid: false, adapter: analysis.adapter.name, errors, warnings };
      }

      if (analysis.estimatedTiles > 100) {
        warnings.push(`Large number of tiles detected (${analysis.estimatedTiles}), download may take significant time`);
      }

      if (analysis.estimatedSize > 50 * 1024 * 1024) {
        warnings.push(`Large estimated download size (${Math.round(analysis.estimatedSize / 1024 / 1024)}MB)`);
      }

      return {
        isValid: true,
        adapter: analysis.adapter.name,
        gridConfig: analysis.gridConfig,
        errors,
        warnings
      };
    } catch (error) {
      errors.push(`Validation error: ${(error as Error).message}`);
      return { isValid: false, errors, warnings };
    }
  }

  updateConfig(config: Partial<TileEngineConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
    this.engine = new TileEngineCore(this.defaultConfig);
    this.registerDefaultAdapters();
  }

  getConfig(): TileEngineConfig {
    return { ...this.defaultConfig };
  }

  registerAdapter(adapter: ITileAdapter): void {
    this.engine.registerAdapter(adapter);
  }

  abortAllDownloads(): void {
    this.engine.abortAllDownloads();
  }

  getStatistics(): {
    supportedAdapters: number;
    defaultConfig: TileEngineConfig;
    supportedFormats: string[];
  } {
    const adapters = this.engine.getAvailableAdapters();
    const supportedFormats = new Set<string>();
    
    adapters.forEach(name => {
      const adapter = this.engine.getAdapter(name);
      if (adapter) {
        adapter.supportedFormats.forEach(format => supportedFormats.add(format));
      }
    });

    return {
      supportedAdapters: adapters.length,
      defaultConfig: this.defaultConfig,
      supportedFormats: Array.from(supportedFormats)
    };
  }
}