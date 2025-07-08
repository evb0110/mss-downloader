import { AbstractTileAdapter } from '../AbstractTileAdapter.js';
import {
  TileGridConfig,
  TileAuthConfig,
  TileCoordinate,
  TileValidationResult
} from '../interfaces.js';

export class BelgicaKbrAdapter extends AbstractTileAdapter {
  readonly name = 'belgica-kbr-ajaxzoom';
  readonly description = 'Belgica KBR AjaxZoom system with browser automation for 47-megapixel downloads';
  readonly supportedFormats = ['jpg'];

  private readonly MAX_ZOOM = 3;
  private readonly GRID_CONFIG: Record<number, { width: number; height: number }> = {
    0: { width: 1, height: 2 },
    1: { width: 2, height: 3 },
    2: { width: 4, height: 5 },
    3: { width: 8, height: 10 }
  };
  private readonly TILE_SIZE = 768;

  private async extractManuscriptChain(documentUrl: string): Promise<{
    documentId: string;
    uurlInfo: { url: string; id: string };
    galleryInfo: { url: string; mapPath: string };
    ajaxZoomConfig: { parameters: string; path: string };
  }> {
    try {
      const docContent = await this.fetchPageContent(documentUrl);
      const uurlMatch = docContent.match(/https:\/\/uurl\.kbr\.be\/(\d+)/);
      
      if (!uurlMatch) {
        throw new Error('Could not find UURL in document page');
      }
      
      const uurlInfo = {
        url: uurlMatch[0],
        id: uurlMatch[1]
      };
      
      const uurlContent = await this.fetchPageContent(uurlInfo.url);
      const galleryMatch = uurlContent.match(/src="([^"]*gallery\.php[^"]*)"/);
      
      if (!galleryMatch) {
        throw new Error('Could not find gallery URL in UURL page');
      }
      
      const galleryUrl = galleryMatch[1];
      const mapMatch = galleryUrl.match(/map=([^&]*)/);
      
      if (!mapMatch) {
        throw new Error('Could not extract map parameter from gallery URL');
      }
      
      const galleryInfo = {
        url: galleryUrl,
        mapPath: mapMatch[1]
      };
      
      const galleryContent = await this.fetchPageContent(galleryInfo.url);
      
      const paramMatch = galleryContent.match(/ajaxZoom\.parameter = '([^']*)'/) || 
                        galleryContent.match(/ajaxZoom\.parameter = "([^"]*)"/);
      
      const pathMatch = galleryContent.match(/ajaxZoom\.path = '([^']*)'/) || 
                       galleryContent.match(/ajaxZoom\.path = "([^"]*)"/);
      
      if (!paramMatch || !pathMatch) {
        throw new Error('Could not find AjaxZoom configuration in gallery page');
      }
      
      const ajaxZoomConfig = {
        parameters: paramMatch[1],
        path: pathMatch[1]
      };
      
      const documentIdMatch = documentUrl.match(/\/([^/]+)$/);
      const documentId = documentIdMatch ? documentIdMatch[1] : 'unknown';
      
      return {
        documentId,
        uurlInfo,
        galleryInfo,
        ajaxZoomConfig
      };
    } catch (error) {
      throw new Error(`Failed to extract manuscript chain: ${(error as Error).message}`);
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

  async validateUrl(url: string): Promise<boolean> {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === 'belgica.kbr.be' && 
             urlObj.pathname.includes('/doc/') &&
             urlObj.pathname.includes('SYRACUSE');
    } catch (error) {
      return false;
    }
  }

  async analyzeManuscriptPage(url: string): Promise<TileGridConfig> {
    try {
      // Validate that we can extract the manuscript chain
      await this.extractManuscriptChain(url);
      
      const maxZoomConfig = this.GRID_CONFIG[this.MAX_ZOOM];
      
      return {
        gridWidth: maxZoomConfig.width,
        gridHeight: maxZoomConfig.height,
        tileWidth: this.TILE_SIZE,
        tileHeight: this.TILE_SIZE,
        zoomLevel: this.MAX_ZOOM,
        totalWidth: maxZoomConfig.width * this.TILE_SIZE,
        totalHeight: maxZoomConfig.height * this.TILE_SIZE,
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
    try {
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
    } catch (error) {
      return {
        type: 'referrer',
        referrer: 'https://viewerd.kbr.be/',
        customHeaders: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache'
        }
      };
    }
  }

  async validateTileResponse(response: Buffer, coordinate: TileCoordinate): Promise<TileValidationResult> {
    const baseValidation = await super.validateTileResponse(response, coordinate);
    
    if (!baseValidation.isValid) {
      return baseValidation;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    if (response.length < 5000) {
      warnings.push('Small tile size detected, may be placeholder or low quality');
    }

    if (response.length > 200000) {
      warnings.push('Large tile size detected, may indicate very high quality');
    }

    const isValidJpeg = response.subarray(0, 2).toString('hex') === 'ffd8' &&
                       response.subarray(response.length - 2).toString('hex') === 'ffd9';
    
    if (!isValidJpeg) {
      errors.push('Invalid JPEG format or corrupted file');
    }

    const dimensions = this.parseImageDimensions(response);
    if (dimensions && (dimensions.width !== this.TILE_SIZE || dimensions.height !== this.TILE_SIZE)) {
      warnings.push(`Unexpected tile dimensions: ${dimensions.width}x${dimensions.height}, expected ${this.TILE_SIZE}x${this.TILE_SIZE}`);
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

  async optimizeGridConfig(config: TileGridConfig): Promise<TileGridConfig> {
    const baseConfig = await super.optimizeGridConfig(config);
    
    return {
      ...baseConfig,
      zoomLevel: this.MAX_ZOOM,
      format: 'jpg'
    };
  }

  // NOTE: This adapter extracts the manuscript chain but requires browser automation
  // for actual tile download. Direct tile URLs return 404 errors because the system
  // uses AjaxZoom with complex parameter encoding that requires interactive sessions.
  // For full functionality, integrate with Puppeteer to:
  // 1. Load the gallery page in a browser
  // 2. Interact with AjaxZoom viewer to trigger tile loading
  // 3. Intercept network requests to capture tiles
  // 4. Stitch captured tiles into high-resolution images

  parseManuscriptUrl(url: string): {
    baseUrl: string;
    manuscriptId: string;
    documentPath: string;
    displayUrl: string;
  } {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/').filter(s => s);
    
    const zoomtilesIndex = pathSegments.indexOf('zoomtiles');
    if (zoomtilesIndex === -1) {
      throw new Error('Invalid Belgica KBR URL: missing zoomtiles path');
    }

    const manuscriptId = pathSegments[zoomtilesIndex + 1];
    if (!manuscriptId) {
      throw new Error('Invalid Belgica KBR URL: missing manuscript ID');
    }

    const documentPath = pathSegments.slice(1, zoomtilesIndex).join('/');
    const displayUrl = `${urlObj.protocol}//${urlObj.host}/${documentPath}/`;
    const baseUrl = `${url}/`;

    return {
      baseUrl,
      manuscriptId,
      documentPath,
      displayUrl
    };
  }

  async getAllAvailablePages(documentUrl: string): Promise<string[]> {
    try {
      const manuscriptInfo = await this.extractManuscriptChain(documentUrl);
      
      const pageUrls: string[] = [];
      let pageNumber = 1;
      let consecutiveFailures = 0;
      
      while (consecutiveFailures < 3) {
        const pageId = `${manuscriptInfo.documentId}_${pageNumber.toString().padStart(4, '0')}`;
        const pageUrl = `https://viewerd.kbr.be/display/SYRACUSE/zoomtiles/${pageId}/`;
        
        try {
          const testTileUrl = `${pageUrl}${this.MAX_ZOOM}-0-0.jpg`;
          const response = await this.fetchWithTimeout(testTileUrl, {
            headers: {
              'Referer': manuscriptInfo.galleryInfo.url,
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
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
    } catch (error) {
      throw new Error(`Failed to get available pages: ${(error as Error).message}`);
    }
  }

  async getZoomLevelInfo(_baseUrl: string): Promise<Record<number, TileGridConfig>> {
    const configs: Record<number, TileGridConfig> = {};
    
    for (let zoom = 0; zoom <= this.MAX_ZOOM; zoom++) {
      const gridConfig = this.GRID_CONFIG[zoom];
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