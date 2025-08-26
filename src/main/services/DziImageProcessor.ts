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
        
        // DZI format: <Image TileSize="256" Overlap="1" Format="jpg">\n  <Size Width="W" Height="H"/>\n</Image>
        const imageNode = (result as any).Image || (result as any).image;
        if (!imageNode || !imageNode.$) {
            throw new Error('Invalid DZI XML format: missing Image element or attributes');
        }
        const attrs = imageNode.$ as Record<string, string>;
        // Size element may be nested as Size or size depending on XML parser config
        const sizeNode = (imageNode.Size && imageNode.Size[0]) || (imageNode.size && imageNode.size[0]);
        if (!sizeNode || !sizeNode.$) {
            throw new Error('Invalid DZI XML format: missing Size element');
        }
        const sizeAttrs = sizeNode.$ as Record<string, string>;
        const widthStr = sizeAttrs['Width'] || sizeAttrs['width'];
        const heightStr = sizeAttrs['Height'] || sizeAttrs['height'];
        const tileSizeStr = attrs['TileSize'] || (attrs as any)['tilesize'] || '256';
        const overlapStr = attrs['Overlap'] || (attrs as any)['overlap'] || '1';
        const formatStr = attrs['Format'] || (attrs as any)['format'] || 'jpg';

        const width = parseInt(widthStr || '0', 10);
        const height = parseInt(heightStr || '0', 10);
        const tileSize = parseInt(tileSizeStr || '0', 10);
        const overlap = parseInt(overlapStr || '0', 10);
        const format = String(formatStr || 'jpg');

        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
            throw new Error(`Invalid DZI Size dimensions parsed: width=${widthStr}, height=${heightStr}`);
        }
        if (!Number.isFinite(tileSize) || tileSize <= 0) {
            throw new Error(`Invalid DZI TileSize parsed: ${tileSizeStr}`);
        }
        if (!Number.isFinite(overlap) || overlap < 0) {
            throw new Error(`Invalid DZI Overlap parsed: ${overlapStr}`);
        }

        return { width, height, tileSize, overlap, format };
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
        
        console.log(`[DZI] Downloading ${tiles?.length} tiles...`);
        
        for (let i = 0; i < tiles?.length; i += batchSize) {
            const batch = tiles.slice(i, Math.min(i + batchSize, tiles?.length));
            
            const promises = batch.map(async (tile) => {
                try {
                    const data = await this.fetchUrl(tile.url);
                    const key = `${tile.level}_${tile.column}_${tile.row}`;
                    tileData.set(key, data);
                    
                    if ((i + batch.indexOf(tile) + 1) % 10 === 0) {
                        console.log(`[DZI] Downloaded ${i + batch.indexOf(tile) + 1}/${tiles?.length} tiles`);
                    }
                } catch (error) {
                    // Tolerate missing/broken tiles: log and continue instead of failing the whole image
                    console.warn(`[DZI] Skipping missing/broken tile ${tile.level}/${tile.column}_${tile.row}:`, error instanceof Error ? error.message : String(error));
                }
            });
            
            await Promise.all(promises);
        }
        
        console.log('[DZI] Tiles download pass complete');
        return tileData;
    }
    
    /**
     * Stitch tiles into a full-resolution image
     */
    private async stitchTiles(tiles: TileInfo[], tileData: Map<string, Buffer>, metadata: DziMetadata): Promise<Buffer> {
        console.log(`[DZI] Stitching ${tiles?.length} tiles into ${metadata.width}x${metadata.height} image...`);
        
        // ULTRA-SAFE canvas dimensions to prevent RangeError: Invalid array length
        const MAX_CANVAS_SIZE = 16384; // Safe limit for most systems
        
        // Comprehensive dimension validation to handle NaN, negative, and non-integer values
        let safeWidth = metadata.width;
        let safeHeight = metadata.height;
        
        // Handle invalid numbers (NaN, Infinity, negative)
        if (!Number.isFinite(safeWidth) || safeWidth <= 0) {
            console.warn(`[DZI] Invalid width detected (${safeWidth}), using fallback`);
            safeWidth = 1000; // Fallback to reasonable size
        }
        
        if (!Number.isFinite(safeHeight) || safeHeight <= 0) {
            console.warn(`[DZI] Invalid height detected (${safeHeight}), using fallback`);
            safeHeight = 1000; // Fallback to reasonable size
        }
        
        // Ensure integers
        safeWidth = Math.floor(safeWidth);
        safeHeight = Math.floor(safeHeight);
        
        // Apply size limits
        safeWidth = Math.min(safeWidth, MAX_CANVAS_SIZE);
        safeHeight = Math.min(safeHeight, MAX_CANVAS_SIZE);
        
        console.log(`[DZI] Original dimensions: ${metadata.width}x${metadata.height}`);
        console.log(`[DZI] Safe dimensions: ${safeWidth}x${safeHeight}`);

        if (safeWidth !== metadata.width || safeHeight !== metadata.height) {
            console.warn(`[DZI] Dimensions adjusted to prevent memory allocation error`);
        }
        
        // Final validation
        if (safeWidth <= 0 || safeHeight <= 0 || !Number.isInteger(safeWidth) || !Number.isInteger(safeHeight)) {
            throw new Error(`Cannot create canvas with invalid dimensions ${safeWidth}x${safeHeight}`);
        }

        // Try node-canvas first; if unavailable, fall back to Jimp
        let useCanvas = false;
        let Canvas: any = null;
        try {
            Canvas = await import('canvas');
            useCanvas = Boolean(Canvas);
        } catch {
            useCanvas = false;
        }

        if (useCanvas) {
            try {
                const canvas = Canvas.createCanvas(safeWidth, safeHeight);
                const ctx = canvas.getContext('2d');
                
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
                        const destX = tile.column * metadata.tileSize - (tile.column > 0 ? metadata.overlap : 0);
                        const destY = tile.row * metadata.tileSize - (tile.row > 0 ? metadata.overlap : 0);
                        const sourceX = tile.column > 0 ? metadata.overlap : 0;
                        const sourceY = tile.row > 0 ? metadata.overlap : 0;
                        const drawWidth = Math.min(tile.width - sourceX, safeWidth - destX);
                        const drawHeight = Math.min(tile.height - sourceY, safeHeight - destY);
                        ctx.drawImage(
                            img,
                            sourceX, sourceY, drawWidth, drawHeight,
                            destX, destY, drawWidth, drawHeight
                        );
                        processedTiles++;
                        if (processedTiles % 10 === 0) {
                            console.log(`[DZI] Stitching progress: ${Math.round((processedTiles / tiles?.length) * 100)}%`);
                        }
                    } catch (error) {
                        console.error(`[DZI] Error processing tile ${key}:`, error instanceof Error ? error.message : String(error));
                    }
                }
                const buffer = canvas.toBuffer();
                console.log(`[DZI] Final image size: ${(buffer?.length / 1024 / 1024).toFixed(2)} MB`);
                return buffer;
            } catch (e) {
                console.warn('[DZI] node-canvas stitching failed, falling back to Jimp:', e instanceof Error ? e.message : String(e));
            }
        }

        // Fallback to Jimp-based stitching
        const JimpModule: any = await import('jimp');
        const Jimp: any = JimpModule.Jimp || JimpModule.default || JimpModule;

        const whiteBuffer = Buffer.alloc(safeWidth * safeHeight * 4);
        for (let i = 0; i < whiteBuffer.length; i += 4) {
            whiteBuffer[i] = 255;     // R
            whiteBuffer[i + 1] = 255; // G
            whiteBuffer[i + 2] = 255; // B
            whiteBuffer[i + 3] = 255; // A
        }
        const baseImage = new Jimp({ width: safeWidth, height: safeHeight, data: whiteBuffer });

        let processedTiles = 0;
        for (const tile of tiles) {
            const key = `${tile.level}_${tile.column}_${tile.row}`;
            const data = tileData.get(key);
            if (!data) {
                console.warn(`[DZI] Missing tile data for ${key}`);
                continue;
            }
            try {
                const img = await Jimp.read(data);
                const destX = tile.column * metadata.tileSize - (tile.column > 0 ? metadata.overlap : 0);
                const destY = tile.row * metadata.tileSize - (tile.row > 0 ? metadata.overlap : 0);

                const sourceX = tile.column > 0 ? metadata.overlap : 0;
                const sourceY = tile.row > 0 ? metadata.overlap : 0;
                const imgWidth = img.bitmap?.width || 256;
                const imgHeight = img.bitmap?.height || 256;
                const cropW = Math.min(imgWidth - sourceX, safeWidth - destX);
                const cropH = Math.min(imgHeight - sourceY, safeHeight - destY);
                const finalW = Math.max(1, cropW);
                const finalH = Math.max(1, cropH);
                if (sourceX !== 0 || sourceY !== 0 || finalW !== imgWidth || finalH !== imgHeight) {
                    img.crop({ x: sourceX, y: sourceY, w: finalW, h: finalH });
                }
                baseImage.composite(img, destX, destY);
                processedTiles++;
                if (processedTiles % 10 === 0) {
                    console.log(`[DZI] Jimp stitching progress: ${Math.round((processedTiles / tiles?.length) * 100)}%`);
                }
            } catch (error) {
                console.error(`[DZI] Error processing tile ${key} (Jimp):`, error instanceof Error ? error.message : String(error));
            }
        }
        const jpegBuffer: Buffer = await baseImage.getBuffer('image/jpeg', { quality: 85 });
        console.log(`[DZI] Final image size: ${(jpegBuffer?.length / 1024 / 1024).toFixed(2)} MB`);
        return jpegBuffer;
    }
    
    /**
     * Process a DZI image and return the full-resolution stitched image
     */
    async processDziImage(dziUrl: string): Promise<Buffer> {
        console.log('[DZI] Processing DZI image:', dziUrl);
        
        // Extract base URL (remove .dzi or .xml extension)
        const baseUrl = dziUrl.replace(/\.(dzi|xml)$/i, '');
        
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
        
        for (let i = 0; i < dziUrls?.length; i++) {
            console.log(`[DZI] Processing page ${i + 1}/${dziUrls?.length}`);
            try {
                const image = await this.processDziImage(dziUrls[i] || '');
                images.push(image);
            } catch (error) {
                console.error(`[DZI] Failed to process page ${i + 1}:`, error instanceof Error ? error.message : String(error));
                throw error;
            }
        }
        
        return images;
    }
}