import https from 'https';
import http from 'http';
import { URL } from 'url';
import xml2js from 'xml2js';

/**
 * DZI (Deep Zoom Image) Processor
 * Downloads and assembles tiles from Deep Zoom Image format (used by Bordeaux and other libraries)
 * Provides full-resolution image data from tiled sources
 */

interface DziMetadata {
    width: number;
    height: number;
    tileSize: number;
    overlap: number;
    format: string;
}

interface TileInfo {
    level: number;
    column: number;
    row: number;
    url: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

export class DziImageProcessor {
    
    /**
     * Fetch content from URL with proper error handling
     */
    private async fetchUrl(url: string): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const protocol = urlObj.protocol === 'https:' ? https : http;
            
            const request = protocol.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to fetch ${url}: ${response.statusCode}`));
                    return;
                }
                
                const chunks: Buffer[] = [];
                response.on('data', (chunk) => chunks.push(chunk));
                response.on('end', () => resolve(Buffer.concat(chunks)));
                response.on('error', reject);
            });
            
            request.on('error', reject);
            request.setTimeout(30000, () => {
                request.destroy();
                reject(new Error(`Timeout fetching ${url}`));
            });
        });
    }
    
    /**
     * Parse DZI XML metadata
     */
    private async parseDziMetadata(dziUrl: string): Promise<DziMetadata> {
        console.log('[DZI] Fetching metadata from:', dziUrl);
        const xmlBuffer = await this.fetchUrl(dziUrl);
        const xmlString = xmlBuffer.toString('utf-8');
        
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(xmlString);
        
        if (!result.Image || !result.Image.$) {
            throw new Error('Invalid DZI XML format');
        }
        
        const imageAttrs = result.Image.$;
        return {
            width: parseInt(imageAttrs.Width),
            height: parseInt(imageAttrs.Height),
            tileSize: parseInt(imageAttrs.TileSize),
            overlap: parseInt(imageAttrs.Overlap),
            format: imageAttrs.Format || 'jpg'
        };
    }
    
    /**
     * Calculate the maximum zoom level for a DZI image
     */
    private calculateMaxLevel(width: number, height: number): number {
        const maxDimension = Math.max(width, height);
        return Math.ceil(Math.log2(maxDimension));
    }
    
    /**
     * Get all tiles needed for the highest resolution level
     */
    private getTilesForLevel(metadata: DziMetadata, level: number, baseUrl: string): TileInfo[] {
        const tiles: TileInfo[] = [];
        // const scale = Math.pow(2, level);
        
        // Calculate dimensions at this level
        const levelWidth = Math.ceil(metadata.width / Math.pow(2, this.calculateMaxLevel(metadata.width, metadata.height) - level));
        const levelHeight = Math.ceil(metadata.height / Math.pow(2, this.calculateMaxLevel(metadata.width, metadata.height) - level));
        
        // Calculate number of tiles
        const numCols = Math.ceil(levelWidth / metadata.tileSize);
        const numRows = Math.ceil(levelHeight / metadata.tileSize);
        
        console.log(`[DZI] Level ${level}: ${levelWidth}x${levelHeight}, ${numCols}x${numRows} tiles`);
        
        for (let row = 0; row < numRows; row++) {
            for (let col = 0; col < numCols; col++) {
                // Calculate tile dimensions (accounting for edge tiles)
                const x = col * metadata.tileSize;
                const y = row * metadata.tileSize;
                const width = Math.min(metadata.tileSize, levelWidth - x);
                const height = Math.min(metadata.tileSize, levelHeight - y);
                
                // Construct tile URL
                const tileUrl = `${baseUrl}_files/${level}/${col}_${row}.${metadata.format}`;
                
                tiles.push({
                    level,
                    column: col,
                    row,
                    url: tileUrl,
                    x: x - (col > 0 ? metadata.overlap : 0),
                    y: y - (row > 0 ? metadata.overlap : 0),
                    width: width + (col > 0 ? metadata.overlap : 0) + (col < numCols - 1 ? metadata.overlap : 0),
                    height: height + (row > 0 ? metadata.overlap : 0) + (row < numRows - 1 ? metadata.overlap : 0)
                });
            }
        }
        
        return tiles;
    }
    
    /**
     * Download all tiles for an image
     */
    private async downloadTiles(tiles: TileInfo[]): Promise<Map<string, Buffer>> {
        const tileData = new Map<string, Buffer>();
        const batchSize = 5; // Download tiles in batches
        
        console.log(`[DZI] Downloading ${tiles.length} tiles...`);
        
        for (let i = 0; i < tiles.length; i += batchSize) {
            const batch = tiles.slice(i, Math.min(i + batchSize, tiles.length));
            
            const promises = batch.map(async (tile) => {
                try {
                    const data = await this.fetchUrl(tile.url);
                    const key = `${tile.level}_${tile.column}_${tile.row}`;
                    tileData.set(key, data);
                    
                    if ((i + batch.indexOf(tile) + 1) % 10 === 0) {
                        console.log(`[DZI] Downloaded ${i + batch.indexOf(tile) + 1}/${tiles.length} tiles`);
                    }
                } catch (error) {
                    console.error(`[DZI] Failed to download tile ${tile.column}_${tile.row}:`, error.message);
                    throw error;
                }
            });
            
            await Promise.all(promises);
        }
        
        console.log('[DZI] All tiles downloaded successfully');
        return tileData;
    }
    
    /**
     * Stitch tiles into a full-resolution image
     */
    private async stitchTiles(tiles: TileInfo[], tileData: Map<string, Buffer>, metadata: DziMetadata): Promise<Buffer> {
        console.log(`[DZI] Stitching ${tiles.length} tiles into ${metadata.width}x${metadata.height} image...`);
        
        try {
            // Try to use Canvas if available
            let Canvas;
            try {
                Canvas = await import('canvas');
            } catch {
                // Canvas not available - return error
                throw new Error('Canvas dependency required for DZI tile assembly. Please install canvas package.');
            }
            
            const canvas = Canvas.createCanvas(metadata.width, metadata.height);
            const ctx = canvas.getContext('2d');
            
            // Process tiles
            let processedTiles = 0;
            for (const tile of tiles) {
                const key = `${tile.level}_${tile.column}_${tile.row}`;
                const data = tileData.get(key);
                
                if (!data) {
                    console.warn(`[DZI] Missing tile data for ${key}`);
                    continue;
                }
                
                try {
                    const img = await Canvas.loadImage(data);
                    
                    // Calculate actual position (accounting for overlap)
                    const destX = tile.column * metadata.tileSize - (tile.column > 0 ? metadata.overlap : 0);
                    const destY = tile.row * metadata.tileSize - (tile.row > 0 ? metadata.overlap : 0);
                    
                    // Draw tile (cropping overlap areas)
                    const sourceX = tile.column > 0 ? metadata.overlap : 0;
                    const sourceY = tile.row > 0 ? metadata.overlap : 0;
                    const drawWidth = Math.min(tile.width - sourceX, metadata.width - destX);
                    const drawHeight = Math.min(tile.height - sourceY, metadata.height - destY);
                    
                    ctx.drawImage(
                        img,
                        sourceX, sourceY, drawWidth, drawHeight,
                        destX, destY, drawWidth, drawHeight
                    );
                    
                    processedTiles++;
                    if (processedTiles % 10 === 0) {
                        console.log(`[DZI] Stitching progress: ${Math.round((processedTiles / tiles.length) * 100)}%`);
                    }
                } catch (error) {
                    console.error(`[DZI] Error processing tile ${key}:`, error.message);
                }
            }
            
            console.log('[DZI] Stitching complete, encoding to JPEG...');
            
            // Convert to JPEG buffer
            const jpegBuffer = await new Promise<Buffer>((resolve, reject) => {
                canvas.toBuffer('image/jpeg', { quality: 0.95 }, (err: Error | null, buffer: Buffer) => {
                    if (err) reject(err);
                    else resolve(buffer);
                });
            });
            
            console.log(`[DZI] Final image size: ${(jpegBuffer.length / 1024 / 1024).toFixed(2)} MB`);
            return jpegBuffer;
            
        } catch (error) {
            console.error('[DZI] Stitching error:', error);
            throw error;
        }
    }
    
    /**
     * Process a DZI image and return the full-resolution stitched image
     */
    async processDziImage(dziUrl: string): Promise<Buffer> {
        console.log('[DZI] Processing DZI image:', dziUrl);
        
        // Extract base URL (remove .dzi extension)
        const baseUrl = dziUrl.replace(/\.dzi$/i, '');
        
        // Fetch and parse DZI metadata
        const metadata = await this.parseDziMetadata(dziUrl);
        console.log('[DZI] Image metadata:', metadata);
        
        // Calculate maximum zoom level
        const maxLevel = this.calculateMaxLevel(metadata.width, metadata.height);
        console.log('[DZI] Maximum zoom level:', maxLevel);
        
        // Get tiles for the highest resolution level
        const tiles = this.getTilesForLevel(metadata, maxLevel, baseUrl);
        
        // Download all tiles
        const tileData = await this.downloadTiles(tiles);
        
        // Stitch tiles into full image
        const fullImage = await this.stitchTiles(tiles, tileData, metadata);
        
        return fullImage;
    }
    
    /**
     * Process multiple DZI pages into separate images
     */
    async processDziPages(dziUrls: string[]): Promise<Buffer[]> {
        const images: Buffer[] = [];
        
        for (let i = 0; i < dziUrls.length; i++) {
            console.log(`[DZI] Processing page ${i + 1}/${dziUrls.length}`);
            try {
                const image = await this.processDziImage(dziUrls[i]);
                images.push(image);
            } catch (error) {
                console.error(`[DZI] Failed to process page ${i + 1}:`, error.message);
                throw error;
            }
        }
        
        return images;
    }
}