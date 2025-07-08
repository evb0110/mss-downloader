import { AbstractTileAdapter } from '../AbstractTileAdapter';
import {
  TileGridConfig,
  TileAuthConfig,
  TileCoordinate,
  TileValidationResult
} from '../interfaces';

export class BelgicaKbrAjaxZoomAdapter extends AbstractTileAdapter {
  readonly name = 'belgica-kbr-ajaxzoom';
  readonly description = 'Belgica KBR AjaxZoom system with browser automation for 47-megapixel downloads';
  readonly supportedFormats = ['jpg'];

  private readonly TILE_SIZE = 768;
  private readonly GRID_WIDTH = 8;
  private readonly GRID_HEIGHT = 10;
  private readonly MAX_ZOOM = 3;

  async validateUrl(url: string): Promise<boolean> {
    try {
      const urlObj = new URL(url);
      return (
        urlObj.hostname === 'belgica.kbr.be' &&
        urlObj.pathname.includes('/doc/') &&
        urlObj.pathname.includes('SYRACUSE')
      );
    } catch (error) {
      return false;
    }
  }

  async analyzeManuscriptPage(url: string): Promise<TileGridConfig> {
    try {
      const uurlInfo = await this.extractUURLFromDocument(url);
      const galleryInfo = await this.extractGalleryFromUURL(uurlInfo.url);
      const ajaxZoomConfig = await this.extractAjaxZoomConfig(galleryInfo.url);
      
      return {
        gridWidth: this.GRID_WIDTH,
        gridHeight: this.GRID_HEIGHT,
        tileWidth: this.TILE_SIZE,
        tileHeight: this.TILE_SIZE,
        zoomLevel: this.MAX_ZOOM,
        totalWidth: this.GRID_WIDTH * this.TILE_SIZE,
        totalHeight: this.GRID_HEIGHT * this.TILE_SIZE,
        format: 'jpg',
        overlap: 0
      };
    } catch (error) {
      throw new Error(`Failed to analyze Belgica KBR manuscript: ${(error as Error).message}`);
    }
  }

  async generateTileUrls(baseUrl: string, config: TileGridConfig): Promise<string[]> {
    const urls: string[] = [];
    
    for (let y = 0; y < config.gridHeight; y++) {
      for (let x = 0; x < config.gridWidth; x++) {
        const tileUrl = `${baseUrl}${config.zoomLevel}-${x}-${y}.jpg`;
        urls.push(tileUrl);
      }
    }
    
    return urls;
  }

  async getAuthConfig(baseUrl: string): Promise<TileAuthConfig> {
    const referrer = await this.extractReferrerFromManuscript(baseUrl);
    
    return {
      type: 'referrer',
      referrer,
      customHeaders: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site',
        'Cache-Control': 'no-cache'
      }
    };
  }

  async validateTileResponse(response: Buffer, coordinate: TileCoordinate): Promise<TileValidationResult> {
    const baseValidation = await super.validateTileResponse(response, coordinate);
    
    if (!baseValidation.isValid) {
      return baseValidation;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    if (response.length < 5000) {
      warnings.push('Small tile size detected, may be placeholder');
    }

    const isValidJpeg = response.subarray(0, 2).toString('hex') === 'ffd8' &&
                       response.subarray(response.length - 2).toString('hex') === 'ffd9';
    
    if (!isValidJpeg) {
      errors.push('Invalid JPEG format');
    }

    const dimensions = this.parseImageDimensions(response);
    if (dimensions && (dimensions.width !== this.TILE_SIZE || dimensions.height !== this.TILE_SIZE)) {
      warnings.push(`Unexpected tile dimensions: ${dimensions.width}x${dimensions.height}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        actualDimensions: dimensions || undefined,
        expectedDimensions: { width: this.TILE_SIZE, height: this.TILE_SIZE },
        tileCount: 1,
        totalSize: response.length
      }
    };
  }

  private async extractUURLFromDocument(documentUrl: string): Promise<{ url: string; id: string }> {
    try {
      const content = await this.fetchPageContent(documentUrl);
      const uurlMatch = content.match(/https:\/\/uurl\.kbr\.be\/(\d+)/);
      
      if (!uurlMatch) {
        throw new Error('Could not find UURL in document page');
      }
      
      return {
        url: uurlMatch[0],
        id: uurlMatch[1]
      };
    } catch (error) {
      throw new Error(`Failed to extract UURL: ${(error as Error).message}`);
    }
  }

  private async extractGalleryFromUURL(uurlUrl: string): Promise<{ url: string; mapPath: string }> {
    try {
      const content = await this.fetchPageContent(uurlUrl);
      const galleryMatch = content.match(/src="([^"]*gallery\.php[^"]*)"/);
      
      if (!galleryMatch) {
        throw new Error('Could not find gallery URL in UURL page');
      }
      
      const galleryUrl = galleryMatch[1];
      const mapMatch = galleryUrl.match(/map=([^&]*)/);
      
      if (!mapMatch) {
        throw new Error('Could not extract map parameter from gallery URL');
      }
      
      return {
        url: galleryUrl,
        mapPath: mapMatch[1]
      };
    } catch (error) {
      throw new Error(`Failed to extract gallery info: ${(error as Error).message}`);
    }
  }

  private async extractAjaxZoomConfig(galleryUrl: string): Promise<{ parameters: string; path: string }> {
    try {
      const content = await this.fetchPageContent(galleryUrl);
      
      const paramMatch = content.match(/ajaxZoom\.parameter = '([^']*)'/) || 
                        content.match(/ajaxZoom\.parameter = "([^"]*)"/);
      
      const pathMatch = content.match(/ajaxZoom\.path = '([^']*)'/) || 
                       content.match(/ajaxZoom\.path = "([^"]*)"/);
      
      if (!paramMatch || !pathMatch) {
        throw new Error('Could not find AjaxZoom configuration in gallery page');
      }
      
      return {
        parameters: paramMatch[1],
        path: pathMatch[1]
      };
    } catch (error) {
      throw new Error(`Failed to extract AjaxZoom config: ${(error as Error).message}`);
    }
  }

  private async extractReferrerFromManuscript(baseUrl: string): Promise<string> {
    try {
      const urlObj = new URL(baseUrl);
      return `${urlObj.protocol}//${urlObj.host}/`;
    } catch (error) {
      return 'https://viewerd.kbr.be/';
    }
  }

  async optimizeGridConfig(config: TileGridConfig): Promise<TileGridConfig> {
    const baseConfig = await super.optimizeGridConfig(config);
    
    return {
      ...baseConfig,
      gridWidth: this.GRID_WIDTH,
      gridHeight: this.GRID_HEIGHT,
      zoomLevel: this.MAX_ZOOM,
      format: 'jpg'
    };
  }

  async extractManuscriptFromDocument(documentUrl: string): Promise<{
    documentId: string;
    uurlUrl: string;
    galleryUrl: string;
    mapPath: string;
    ajaxZoomConfig: { parameters: string; path: string };
  }> {
    try {
      const uurlInfo = await this.extractUURLFromDocument(documentUrl);
      const galleryInfo = await this.extractGalleryFromUURL(uurlInfo.url);
      const ajaxZoomConfig = await this.extractAjaxZoomConfig(galleryInfo.url);
      
      const documentIdMatch = documentUrl.match(/\/([^\/]+)$/);
      const documentId = documentIdMatch ? documentIdMatch[1] : 'unknown';
      
      return {
        documentId,
        uurlUrl: uurlInfo.url,
        galleryUrl: galleryInfo.url,
        mapPath: galleryInfo.mapPath,
        ajaxZoomConfig
      };
    } catch (error) {
      throw new Error(`Failed to extract manuscript info: ${(error as Error).message}`);
    }
  }

  async getTileBaseUrl(documentUrl: string, pageNumber: number = 1): Promise<string> {
    const manuscriptInfo = await this.extractManuscriptFromDocument(documentUrl);
    
    const baseUrl = `https://viewerd.kbr.be/display/SYRACUSE/zoomtiles/${manuscriptInfo.documentId}_${pageNumber.toString().padStart(4, '0')}/`;
    
    return baseUrl;
  }

  async getAllAvailablePages(documentUrl: string): Promise<string[]> {
    const manuscriptInfo = await this.extractManuscriptFromDocument(documentUrl);
    
    const pageUrls: string[] = [];
    let pageNumber = 1;
    let consecutiveFailures = 0;
    
    while (consecutiveFailures < 3) {
      const pageId = `${manuscriptInfo.documentId}_${pageNumber.toString().padStart(4, '0')}`;
      const pageUrl = `https://viewerd.kbr.be/display/SYRACUSE/zoomtiles/${pageId}/`;
      
      try {
        const testTileUrl = `${pageUrl}${this.MAX_ZOOM}-0-0.jpg`;
        const authConfig = await this.getAuthConfig(pageUrl);
        
        const response = await this.fetchWithTimeout(testTileUrl, {
          headers: {
            'Referer': authConfig.referrer,
            ...authConfig.customHeaders
          }
        });
        
        if (response.ok) {
          pageUrls.push(pageUrl);
          consecutiveFailures = 0;
        } else {
          consecutiveFailures++;
        }
      } catch (error) {
        consecutiveFailures++;
      }
      
      pageNumber++;
      
      if (pageNumber > 1000) {
        break;
      }
    }
    
    return pageUrls;
  }

  async getZoomLevelInfo(baseUrl: string): Promise<Record<number, TileGridConfig>> {
    const configs: Record<number, TileGridConfig> = {};
    
    const gridConfigs = {
      0: { width: 1, height: 2 },
      1: { width: 2, height: 3 },
      2: { width: 4, height: 5 },
      3: { width: 8, height: 10 }
    };
    
    for (let zoom = 0; zoom <= this.MAX_ZOOM; zoom++) {
      const gridConfig = gridConfigs[zoom];
      configs[zoom] = {
        gridWidth: gridConfig.width,
        gridHeight: gridConfig.height,
        tileWidth: this.TILE_SIZE,
        tileHeight: this.TILE_SIZE,
        zoomLevel: zoom,
        totalWidth: gridConfig.width * this.TILE_SIZE,
        totalHeight: gridConfig.height * this.TILE_SIZE,
        format: 'jpg',
        overlap: 0
      };
    }
    
    return configs;
  }
}