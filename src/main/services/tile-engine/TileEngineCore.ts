import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { spawn } from 'child_process';
import type {
  ITileAdapter,
  TileEngineConfig,
  TileEngineResult,
  TileDownloadCallbacks,
  TileCoordinate,
  TileGridConfig,
  TileAuthConfig,
  TileDownloadProgress
} from './interfaces';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);

export class TileEngineCore extends EventEmitter {
  private config: TileEngineConfig;
  private adapters: Map<string, ITileAdapter> = new Map();
  private activeDownloads: Map<string, AbortController> = new Map();
  private rateLimit: {
    tokens: number;
    lastRefill: number;
  };

  constructor(config: TileEngineConfig) {
    super();
    this.config = config;
    this.rateLimit = {
      tokens: config.rateLimit.burstSize,
      lastRefill: Date.now()
    };
  }

  registerAdapter(adapter: ITileAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  getAdapter(name: string): ITileAdapter | undefined {
    return this.adapters.get(name);
  }

  getAvailableAdapters(): string[] {
    return Array.from(this.adapters.keys());
  }

  async downloadTilesAndStitch(
    url: string,
    adapterName: string,
    outputPath: string,
    callbacks?: TileDownloadCallbacks
  ): Promise<TileEngineResult> {
    const startTime = Date.now();
    const adapter = this.adapters.get(adapterName);
    
    if (!adapter) {
      throw new Error(`Adapter '${adapterName}' not found`);
    }

    const downloadId = `${Date.now()}-${Math.random()}`;
    const abortController = new AbortController();
    this.activeDownloads.set(downloadId, abortController);

    try {
      const isValid = await adapter.validateUrl(url);
      if (!isValid) {
        throw new Error(`Invalid URL for adapter '${adapterName}': ${url}`);
      }

      const gridConfig = await adapter.analyzeManuscriptPage(url);
      const optimizedConfig = await adapter.optimizeGridConfig(gridConfig);
      const tileUrls = await adapter.generateTileUrls(url, optimizedConfig);
      const authConfig = await adapter.getAuthConfig(url);

      const result = await this.downloadAndStitchTiles(
        tileUrls,
        optimizedConfig,
        authConfig,
        outputPath,
        adapter,
        callbacks,
        abortController
      );

      const totalTime = Date.now() - startTime;
      return {
        ...result,
        totalTime,
        metadata: {
          gridConfig: optimizedConfig,
          authConfig,
          finalDimensions: {
            width: optimizedConfig.gridWidth * optimizedConfig.tileWidth,
            height: optimizedConfig.gridHeight * optimizedConfig.tileHeight
          },
          totalBytes: result.totalTiles * 1024 * 50 // Estimated
        }
      };
    } catch (error) {
      callbacks?.onError?.(error as Error);
      throw error;
    } finally {
      this.activeDownloads.delete(downloadId);
    }
  }

  private async downloadAndStitchTiles(
    tileUrls: string[],
    gridConfig: TileGridConfig,
    authConfig: TileAuthConfig,
    outputPath: string,
    adapter: ITileAdapter,
    callbacks?: TileDownloadCallbacks,
    abortController?: AbortController
  ): Promise<TileEngineResult> {
    const tempDir = path.join(path.dirname(outputPath), 'temp_tiles');
    await mkdir(tempDir, { recursive: true });

    const downloadedTiles: TileCoordinate[] = [];
    const failedTiles: TileCoordinate[] = [];
    const errors: string[] = [];
    let downloadedBytes = 0;
    const startTime = Date.now();

    try {
      const tilePromises = tileUrls.map(async (url, index) => {
        if (abortController?.signal.aborted) {
          throw new Error('Download aborted');
        }

        const coordinate = this.indexToCoordinate(index, gridConfig);
        
        try {
          await this.waitForRateLimit();
          
          const buffer = await this.downloadTile(url, authConfig, abortController);
          const validation = await adapter.validateTileResponse(buffer, coordinate);
          
          if (!validation.isValid) {
            throw new Error(`Invalid tile: ${validation.errors.join(', ')}`);
          }

          const tilePath = path.join(tempDir, `tile_${coordinate.x}_${coordinate.y}.${gridConfig.format || 'jpg'}`);
          await writeFile(tilePath, buffer);
          
          downloadedTiles.push(coordinate);
          downloadedBytes += buffer.length;
          
          const progress: TileDownloadProgress = {
            totalTiles: tileUrls.length,
            downloadedTiles: downloadedTiles.length,
            currentTile: coordinate,
            percentage: (downloadedTiles.length / tileUrls.length) * 100,
            elapsedTime: Date.now() - startTime,
            estimatedTimeRemaining: this.calculateETA(downloadedTiles.length, tileUrls.length, Date.now() - startTime),
            bytesDownloaded: downloadedBytes,
            bytesTotal: tileUrls.length * 1024 * 50, // Estimated
            downloadSpeed: downloadedBytes / ((Date.now() - startTime) / 1000),
            failedTiles: [...failedTiles]
          };
          
          callbacks?.onProgress?.(progress);
          callbacks?.onTileDownloaded?.(coordinate, buffer);
          
          return { coordinate, success: true, path: tilePath };
        } catch (error) {
          failedTiles.push(coordinate);
          errors.push(`Tile ${coordinate.x},${coordinate.y}: ${(error as Error).message}`);
          callbacks?.onTileError?.(coordinate, error as Error);
          
          if (this.config.retryAttempts > 0) {
            return this.retryTileDownload(url, coordinate, authConfig, tempDir, gridConfig, abortController);
          }
          
          return { coordinate, success: false, error: (error as Error).message };
        }
      });

      const results = await Promise.allSettled(tilePromises);
      
      const successfulTiles = results
        .filter(r => r.status === 'fulfilled' && r.value.success)
        .map(r => (r as any).value);

      if (successfulTiles.length === 0) {
        throw new Error('No tiles downloaded successfully');
      }

      const stitchedPath = await this.stitchTiles(successfulTiles, gridConfig, outputPath, tempDir);
      
      await this.cleanupTempFiles(tempDir);
      
      const totalTime = Date.now() - startTime;
      callbacks?.onComplete?.(stitchedPath, totalTime);

      return {
        success: true,
        outputPath: stitchedPath,
        totalTime,
        totalTiles: tileUrls.length,
        downloadedTiles: downloadedTiles.length,
        failedTiles,
        errors,
        metadata: {
          gridConfig,
          authConfig,
          finalDimensions: {
            width: gridConfig.gridWidth * gridConfig.tileWidth,
            height: gridConfig.gridHeight * gridConfig.tileHeight
          },
          totalBytes: downloadedBytes
        }
      };
    } catch (error) {
      await this.cleanupTempFiles(tempDir);
      throw error;
    }
  }

  private async downloadTile(
    url: string,
    authConfig: TileAuthConfig,
    abortController?: AbortController
  ): Promise<Buffer> {
    const headers: Record<string, string> = {};
    
    if (authConfig.referrer) {
      headers['Referer'] = authConfig.referrer;
    }
    
    if (authConfig.customHeaders) {
      Object.assign(headers, authConfig.customHeaders);
    }
    
    if (authConfig.type === 'bearer' && authConfig.token) {
      headers['Authorization'] = `Bearer ${authConfig.token}`;
    }
    
    if (authConfig.type === 'basic' && authConfig.username && authConfig.password) {
      const credentials = Buffer.from(`${authConfig.username}:${authConfig.password}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    const response = await fetch(url, {
      headers,
      signal: abortController?.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  private async retryTileDownload(
    url: string,
    coordinate: TileCoordinate,
    authConfig: TileAuthConfig,
    tempDir: string,
    gridConfig: TileGridConfig,
    abortController?: AbortController
  ): Promise<{ coordinate: TileCoordinate; success: boolean; path?: string; error?: string }> {
    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * (attempt + 1)));
        
        const buffer = await this.downloadTile(url, authConfig, abortController);
        const tilePath = path.join(tempDir, `tile_${coordinate.x}_${coordinate.y}.${gridConfig.format || 'jpg'}`);
        await writeFile(tilePath, buffer);
        
        return { coordinate, success: true, path: tilePath };
      } catch (error) {
        if (attempt === this.config.retryAttempts - 1) {
          return { coordinate, success: false, error: (error as Error).message };
        }
      }
    }
    
    return { coordinate, success: false, error: 'Max retries exceeded' };
  }

  private async stitchTiles(
    tiles: any[],
    gridConfig: TileGridConfig,
    outputPath: string,
    _tempDir: string
  ): Promise<string> {
    const montageArgs = [
      '-mode', 'concatenate',
      '-tile', `${gridConfig.gridWidth}x${gridConfig.gridHeight}`,
      '-geometry', `${gridConfig.tileWidth}x${gridConfig.tileHeight}+0+0`,
      '-background', 'white'
    ];

    const sortedTiles = tiles.sort((a, b) => {
      if (a.coordinate.y !== b.coordinate.y) {
        return a.coordinate.y - b.coordinate.y;
      }
      return a.coordinate.x - b.coordinate.x;
    });

    const inputPaths = sortedTiles.map(tile => tile.path);
    const args = [...montageArgs, ...inputPaths, outputPath];

    return new Promise((resolve, reject) => {
      const process = spawn('magick', args);
      
      let stderr = '';
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`ImageMagick failed with code ${code}: ${stderr}`));
        }
      });
      
      process.on('error', (error) => {
        reject(new Error(`Failed to spawn ImageMagick: ${error.message}`));
      });
    });
  }

  private async cleanupTempFiles(tempDir: string): Promise<void> {
    try {
      const files = await fs.promises.readdir(tempDir);
      await Promise.all(files.map(file => unlink(path.join(tempDir, file))));
      await fs.promises.rmdir(tempDir);
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  private indexToCoordinate(index: number, gridConfig: TileGridConfig): TileCoordinate {
    const x = index % gridConfig.gridWidth;
    const y = Math.floor(index / gridConfig.gridWidth);
    return { x, y, z: gridConfig.zoomLevel };
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRefill = now - this.rateLimit.lastRefill;
    
    const tokensToAdd = Math.floor(timeSinceLastRefill / 1000 * this.config.rateLimit.requestsPerSecond);
    this.rateLimit.tokens = Math.min(this.config.rateLimit.burstSize, this.rateLimit.tokens + tokensToAdd);
    this.rateLimit.lastRefill = now;
    
    if (this.rateLimit.tokens <= 0) {
      const waitTime = (1000 / this.config.rateLimit.requestsPerSecond);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.rateLimit.tokens = 1;
    } else {
      this.rateLimit.tokens--;
    }
  }

  private calculateETA(completed: number, total: number, elapsedTime: number): number {
    if (completed === 0) return 0;
    const rate = completed / elapsedTime;
    return (total - completed) / rate;
  }

  abortDownload(downloadId: string): void {
    const controller = this.activeDownloads.get(downloadId);
    controller?.abort();
    this.activeDownloads.delete(downloadId);
  }

  abortAllDownloads(): void {
    this.activeDownloads.forEach(controller => controller.abort());
    this.activeDownloads.clear();
  }
}