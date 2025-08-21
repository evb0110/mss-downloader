import { AbstractTileAdapter } from '../AbstractTileAdapter';
import type { TileGridConfig, TileAuthConfig } from '../interfaces';

export class LocTileAdapter extends AbstractTileAdapter {
  readonly name = 'loc';
  readonly description = 'Library of Congress IIIF Tile Service Adapter';
  readonly supportedFormats = ['jpg', 'jpeg', 'png'];

  async validateUrl(url: string): Promise<boolean> {
    // Handle both direct tile URLs and base IIIF service URLs
    return url.includes('tile.loc.gov') || 
           (url.includes('loc.gov') && url.includes('/image-services/iiif/'));
  }

  async analyzeManuscriptPage(url: string): Promise<TileGridConfig> {
    try {
      // Extract the IIIF service URL from either format:
      // Direct tile: tile.loc.gov/image-services/iiif/service:rbc:rbc0001:2022:2022vollb14164:0081/full/full/0/default.jpg
      // Service base: any URL containing /image-services/iiif/
      
      let serviceUrl: string;
      if (url.includes('/full/full/0/default.')) {
        // Extract service URL from full tile URL
        const parts = url.split('/');
        const serviceIndex = parts.findIndex(part => part.includes('service:'));
        if (serviceIndex === -1) {
          throw new Error('Could not extract service ID from tile URL');
        }
        serviceUrl = parts.slice(0, serviceIndex + 1).join('/');
      } else {
        // Use URL as-is if it's already a service URL
        serviceUrl = url;
      }

      // Get image info from IIIF Image API
      const infoUrl = `${serviceUrl}/info.json`;
      console.log(`[LocTileAdapter] Fetching image info from: ${infoUrl}`);
      
      const response = await this.fetchWithTimeout(infoUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image info: HTTP ${response.status}`);
      }

      const imageInfo = await response.json();
      console.log(`[LocTileAdapter] Image info:`, {
        width: imageInfo.width,
        height: imageInfo.height,
        tileWidth: imageInfo.tiles?.[0]?.width,
        tileHeight: imageInfo.tiles?.[0]?.height
      });

      // Use image info to determine optimal tile configuration
      const imageWidth = imageInfo.width;
      const imageHeight = imageInfo.height;
      
      // Check for native tile support
      let tileWidth = 512;
      let tileHeight = 512;
      
      if (imageInfo.tiles && imageInfo.tiles.length > 0) {
        tileWidth = imageInfo.tiles[0].width || 512;
        tileHeight = imageInfo.tiles[0].height || 512;
      }

      // Calculate grid dimensions
      const gridWidth = Math.ceil(imageWidth / tileWidth);
      const gridHeight = Math.ceil(imageHeight / tileHeight);

      console.log(`[LocTileAdapter] Grid config: ${gridWidth}x${gridHeight} tiles, ${tileWidth}x${tileHeight} each`);

      return {
        gridWidth,
        gridHeight,
        tileWidth,
        tileHeight,
        totalWidth: imageWidth,
        totalHeight: imageHeight,
        zoomLevel: 0,
        format: 'jpg',
        overlap: 0
      };
    } catch (error) {
      console.error(`[LocTileAdapter] Analysis failed:`, error);
      throw new Error(`Failed to analyze LoC manuscript page: ${(error as Error).message}`);
    }
  }

  async generateTileUrls(baseUrl: string, config: TileGridConfig): Promise<string[]> {
    const urls: string[] = [];
    
    // Extract service URL from baseUrl parameter
    let serviceUrl = baseUrl;
    if (baseUrl.includes('/full/full/0/default.')) {
      // Extract service URL from full tile URL
      const parts = baseUrl.split('/');
      const serviceIndex = parts.findIndex(part => part.includes('service:'));
      if (serviceIndex !== -1) {
        serviceUrl = parts.slice(0, serviceIndex + 1).join('/');
      }
    }
    
    console.log(`[LocTileAdapter] Generating ${config.gridWidth * config.gridHeight} tile URLs from service: ${serviceUrl}`);
    
    const totalWidth = config.totalWidth || (config.gridWidth * config.tileWidth);
    const totalHeight = config.totalHeight || (config.gridHeight * config.tileHeight);
    
    for (let y = 0; y < config.gridHeight; y++) {
      for (let x = 0; x < config.gridWidth; x++) {
        // Calculate tile region in image coordinates
        const regionX = x * config.tileWidth;
        const regionY = y * config.tileHeight;
        const regionW = Math.min(config.tileWidth, totalWidth - regionX);
        const regionH = Math.min(config.tileHeight, totalHeight - regionY);
        
        // Build IIIF tile URL: {service-url}/{region}/{size}/{rotation}/{quality}.{format}
        const region = `${regionX},${regionY},${regionW},${regionH}`;
        const size = 'full'; // Keep original tile resolution
        const rotation = '0';
        const quality = 'default';
        const format = config.format || 'jpg';
        
        const tileUrl = `${serviceUrl}/${region}/${size}/${rotation}/${quality}.${format}`;
        urls.push(tileUrl);
        
        // Log first few and last few URLs for debugging
        if (urls.length <= 3 || urls.length === config.gridWidth * config.gridHeight) {
          console.log(`[LocTileAdapter] Tile ${x},${y}: ${tileUrl}`);
        }
      }
    }
    
    console.log(`[LocTileAdapter] Generated ${urls.length} tile URLs`);
    return urls;
  }

  async getAuthConfig(_UNUSED_baseUrl: string): Promise<TileAuthConfig> {
    // Library of Congress tiles typically don't require authentication
    // but may need proper referrer headers
    return {
      type: 'none',
      referrer: 'https://www.loc.gov/',
      customHeaders: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    };
  }
}