import type {
  ITileAdapter,
  TileGridConfig,
  TileAuthConfig,
  TileCoordinate,
  TileValidationResult
} from './interfaces';

export abstract class AbstractTileAdapter implements ITileAdapter {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly supportedFormats: string[];

  abstract validateUrl(url: string): Promise<boolean>;
  abstract analyzeManuscriptPage(url: string): Promise<TileGridConfig>;
  abstract generateTileUrls(baseUrl: string, config: TileGridConfig): Promise<string[]>;
  abstract getAuthConfig(baseUrl: string): Promise<TileAuthConfig>;

  async validateTileResponse(response: Buffer, _UNUSED_coordinate: TileCoordinate): Promise<TileValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (response.length === 0) {
      errors.push('Empty response buffer');
      return { isValid: false, errors, warnings };
    }

    if (response.length < 100) {
      errors.push('Response too small to be a valid image');
      return { isValid: false, errors, warnings };
    }

    const isJpeg = response.subarray(0, 2).toString('hex') === 'ffd8';
    const isPng = response.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
    const isWebP = response.subarray(0, 4).toString('ascii') === 'RIFF' && 
                   response.subarray(8, 12).toString('ascii') === 'WEBP';

    if (!isJpeg && !isPng && !isWebP) {
      errors.push('Invalid image format detected');
      return { isValid: false, errors, warnings };
    }

    if (response.length > 5 * 1024 * 1024) {
      warnings.push('Large tile size detected (>5MB)');
    }

    return {
      isValid: true,
      errors,
      warnings,
      metadata: {
        tileCount: 1,
        totalSize: response.length
      }
    };
  }

  async optimizeGridConfig(config: TileGridConfig): Promise<TileGridConfig> {
    return {
      ...config,
      format: config.format || 'jpg',
      overlap: config.overlap || 0
    };
  }

  protected extractBaseUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}`;
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }
  }

  protected extractPathSegments(url: string): string[] {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.split('/').filter(segment => segment.length > 0);
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }
  }

  protected extractQueryParams(url: string): URLSearchParams {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams;
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }
  }

  protected buildUrl(baseUrl: string, path: string, params?: Record<string, string>): string {
    const url = new URL(path, baseUrl);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    
    return url.toString();
  }

  protected async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeoutMs: number = 30000
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  protected async fetchPageContent(url: string, headers: Record<string, string> = {}): Promise<string> {
    const response = await this.fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        ...headers
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  }

  protected parseImageDimensions(imageBuffer: Buffer): { width: number; height: number } | null {
    try {
      if (imageBuffer.length < 24) {
        return null;
      }

      const header = imageBuffer.subarray(0, 24);
      
      if (header.subarray(0, 2).toString('hex') === 'ffd8') {
        return this.parseJpegDimensions(imageBuffer);
      }
      
      if (header.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') {
        return this.parsePngDimensions(imageBuffer);
      }
      
      return null;
    } catch {
      return null;
    }
  }

  private parseJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
    let offset = 2;
    
    while (offset < buffer.length - 8) {
      const marker = buffer.readUInt16BE(offset);
      
      if (marker === 0xffc0 || marker === 0xffc2) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }
      
      const length = buffer.readUInt16BE(offset + 2);
      offset += 2 + length;
    }
    
    return null;
  }

  private parsePngDimensions(buffer: Buffer): { width: number; height: number } | null {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }
}