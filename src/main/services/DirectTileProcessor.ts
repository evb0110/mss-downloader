import { promises as fs } from 'fs';
import https from 'https';
import http from 'http';
import { URL } from 'url';

/**
 * Direct Tile Processor
 * Downloads and assembles tiles without requiring DZI XML metadata
 * Used for libraries like Bordeaux that provide tiles but no metadata files
 */

interface TileInfo {
    baseUrl: string;
    maxLevel: number;
    tileSize: number;
    overlap: number;
    format: string;
    gridSize: {
        cols: number;
        rows: number;
    };
    estimatedDimensions: {
        width: number;
        height: number;
    };
}

interface Tile {
    level: number;
    column: number;
    row: number;
    url: string;
    exists: boolean;
    data?: Buffer;
}

export class DirectTileProcessor {
    
    /**
     * Fetch content from URL with 404 handling
     */
    private async fetchUrl(url: string): Promise<{ exists: boolean; data?: Buffer }> {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const protocol = urlObj.protocol === 'https:' ? https : http;
            
            const request = protocol.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }, (response) => {
                if (response.statusCode === 404) {
                    resolve({ exists: false });
                    return;
                }
                
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to fetch ${url}: ${response.statusCode}`));
                    return;
                }
                
                const chunks: Buffer[] = [];
                response.on('data', (chunk) => chunks.push(chunk));
                response.on('end', () => resolve({ exists: true, data: Buffer.concat(chunks) }));
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
     * Probe tile structure by testing tile existence
     */
    async probeTileStructure(baseUrl: string): Promise<TileInfo> {
        console.log('[DirectTile] Probing tile structure for:', baseUrl);
        
        // Common tile parameters
        const tileSize = 256;
        const overlap = 1;
        const format = 'jpg';
        
        // Find the highest zoom level
        let maxLevel = 0;
        for (let level = 20; level >= 0; level--) {
            const testUrl = `${baseUrl}_files/${level}/0_0.${format}`;
            try {
                const result = await this.fetchUrl(testUrl);
                if (result.exists) {
                    maxLevel = level;
                    console.log(`[DirectTile] Found max level: ${level}`);
                    break;
                }
            } catch (error) {
                // Continue searching
            }
        }
        
        // Probe grid size at max level
        let maxCol = 0;
        let maxRow = 0;
        
        // Binary search for max column
        let low = 0, high = 200;
        while (low < high) {
            const mid = Math.floor((low + high + 1) / 2);
            const testUrl = `${baseUrl}_files/${maxLevel}/${mid}_0.${format}`;
            try {
                const result = await this.fetchUrl(testUrl);
                if (result.exists) {
                    low = mid;
                } else {
                    high = mid - 1;
                }
            } catch (error) {
                high = mid - 1;
            }
        }
        maxCol = low;
        
        // Binary search for max row
        low = 0; high = 200;
        while (low < high) {
            const mid = Math.floor((low + high + 1) / 2);
            const testUrl = `${baseUrl}_files/${maxLevel}/0_${mid}.${format}`;
            try {
                const result = await this.fetchUrl(testUrl);
                if (result.exists) {
                    low = mid;
                } else {
                    high = mid - 1;
                }
            } catch (error) {
                high = mid - 1;
            }
        }
        maxRow = low;
        
        console.log(`[DirectTile] Grid size at level ${maxLevel}: ${maxCol + 1} x ${maxRow + 1} tiles`);
        
        // Calculate estimated dimensions
        const scale = Math.pow(2, maxLevel);
        const levelWidth = (maxCol + 1) * tileSize;
        const levelHeight = (maxRow + 1) * tileSize;
        const estimatedWidth = Math.ceil(levelWidth * scale / Math.pow(2, maxLevel));
        const estimatedHeight = Math.ceil(levelHeight * scale / Math.pow(2, maxLevel));
        
        return {
            baseUrl,
            maxLevel,
            tileSize,
            overlap,
            format,
            gridSize: {
                cols: maxCol + 1,
                rows: maxRow + 1
            },
            estimatedDimensions: {
                width: estimatedWidth,
                height: estimatedHeight
            }
        };
    }
    
    /**
     * Get all tiles for a specific level
     */
    private getTilesForLevel(tileInfo: TileInfo, level: number): Tile[] {
        const tiles: Tile[] = [];
        
        // Calculate grid size at this level
        const scaleFactor = Math.pow(2, tileInfo.maxLevel - level);
        const levelCols = Math.ceil(tileInfo.gridSize.cols / scaleFactor);
        const levelRows = Math.ceil(tileInfo.gridSize.rows / scaleFactor);
        
        for (let row = 0; row < levelRows; row++) {
            for (let col = 0; col < levelCols; col++) {
                tiles.push({
                    level,
                    column: col,
                    row,
                    url: `${tileInfo.baseUrl}_files/${level}/${col}_${row}.${tileInfo.format}`,
                    exists: true
                });
            }
        }
        
        return tiles;
    }
    
    /**
     * Download tiles with existence checking
     */
    private async downloadTiles(tiles: Tile[], onProgress?: (downloaded: number, total: number) => void): Promise<Tile[]> {
        const batchSize = 5;
        const downloadedTiles: Tile[] = [];
        
        console.log(`[DirectTile] Downloading up to ${tiles.length} tiles...`);
        
        let validTiles = 0;
        for (let i = 0; i < tiles.length; i += batchSize) {
            const batch = tiles.slice(i, Math.min(i + batchSize, tiles.length));
            
            const promises = batch.map(async (tile) => {
                try {
                    const result = await this.fetchUrl(tile.url);
                    if (result.exists && result.data) {
                        tile.exists = true;
                        tile.data = result.data;
                        validTiles++;
                        
                        if (validTiles % 10 === 0) {
                            console.log(`[DirectTile] Downloaded ${validTiles} tiles...`);
                        }
                        
                        // Report progress if callback provided
                        if (onProgress) {
                            onProgress(validTiles, tiles.length);
                        }
                        
                        return tile;
                    } else {
                        tile.exists = false;
                        return tile;
                    }
                } catch (error) {
                    console.warn(`[DirectTile] Failed to download tile ${tile.column}_${tile.row}:`, error.message);
                    tile.exists = false;
                    return tile;
                }
            });
            
            const batchResults = await Promise.all(promises);
            downloadedTiles.push(...batchResults.filter(t => t.exists));
        }
        
        console.log(`[DirectTile] Downloaded ${validTiles} valid tiles`);
        return downloadedTiles;
    }
    
    /**
     * Stitch tiles into a full image
     */
    private async stitchTiles(tiles: Tile[], tileInfo: TileInfo): Promise<Buffer> {
        console.log(`[DirectTile] Stitching ${tiles.length} tiles...`);
        
        try {
            // Try to use Canvas if available
            let Canvas: any;
            try {
                Canvas = await import('canvas' as any);
            } catch (error) {
                throw new Error('Canvas dependency required for tile assembly. Please install canvas package.');
            }
            
            // Use estimated dimensions
            const canvas = Canvas.createCanvas(tileInfo.estimatedDimensions.width, tileInfo.estimatedDimensions.height);
            const ctx = canvas.getContext('2d');
            
            let processedTiles = 0;
            for (const tile of tiles) {
                if (!tile.data) continue;
                
                try {
                    const img = await Canvas.loadImage(tile.data);
                    
                    // Calculate position (accounting for overlap)
                    const destX = tile.column * tileInfo.tileSize - (tile.column > 0 ? tileInfo.overlap : 0);
                    const destY = tile.row * tileInfo.tileSize - (tile.row > 0 ? tileInfo.overlap : 0);
                    
                    // Draw tile
                    const sourceX = tile.column > 0 ? tileInfo.overlap : 0;
                    const sourceY = tile.row > 0 ? tileInfo.overlap : 0;
                    
                    ctx.drawImage(
                        img,
                        sourceX, sourceY,
                        img.width - sourceX - (tile.column < tileInfo.gridSize.cols - 1 ? tileInfo.overlap : 0),
                        img.height - sourceY - (tile.row < tileInfo.gridSize.rows - 1 ? tileInfo.overlap : 0),
                        destX, destY,
                        img.width - sourceX - (tile.column < tileInfo.gridSize.cols - 1 ? tileInfo.overlap : 0),
                        img.height - sourceY - (tile.row < tileInfo.gridSize.rows - 1 ? tileInfo.overlap : 0)
                    );
                    
                    processedTiles++;
                    if (processedTiles % 10 === 0) {
                        console.log(`[DirectTile] Stitching progress: ${Math.round((processedTiles / tiles.length) * 100)}%`);
                    }
                } catch (error) {
                    console.error(`[DirectTile] Error processing tile ${tile.column}_${tile.row}:`, error.message);
                }
            }
            
            console.log('[DirectTile] Encoding to JPEG...');
            
            // Convert to JPEG buffer
            const jpegBuffer = await new Promise<Buffer>((resolve, reject) => {
                canvas.toBuffer('image/jpeg', { quality: 0.95 }, (err: Error | null, buffer: Buffer) => {
                    if (err) reject(err);
                    else resolve(buffer);
                });
            });
            
            console.log(`[DirectTile] Final image size: ${(jpegBuffer.length / 1024 / 1024).toFixed(2)} MB`);
            return jpegBuffer;
            
        } catch (error) {
            console.error('[DirectTile] Stitching error:', error);
            throw error;
        }
    }
    
    /**
     * Process a tiled image without DZI metadata
     */
    async processTiledImage(baseUrl: string, existingTileInfo?: TileInfo, onProgress?: (downloaded: number, total: number) => void): Promise<Buffer> {
        console.log('[DirectTile] Processing tiled image:', baseUrl);
        
        // Use provided tile info or probe structure
        const tileInfo = existingTileInfo || await this.probeTileStructure(baseUrl);
        
        // Get tiles for the highest resolution
        const tiles = this.getTilesForLevel(tileInfo, tileInfo.maxLevel);
        
        // Download tiles
        const downloadedTiles = await this.downloadTiles(tiles, onProgress);
        
        if (downloadedTiles.length === 0) {
            throw new Error('No valid tiles found');
        }
        
        // Stitch tiles
        const fullImage = await this.stitchTiles(downloadedTiles, tileInfo);
        
        return fullImage;
    }
    
    /**
     * Process multiple tiled pages
     */
    async processTiledPages(pageInfos: Array<{ baseUrl: string; tileInfo?: TileInfo }>): Promise<Buffer[]> {
        const images: Buffer[] = [];
        
        for (let i = 0; i < pageInfos.length; i++) {
            console.log(`[DirectTile] Processing page ${i + 1}/${pageInfos.length}`);
            try {
                const image = await this.processTiledImage(pageInfos[i].baseUrl, pageInfos[i].tileInfo);
                images.push(image);
            } catch (error) {
                console.error(`[DirectTile] Failed to process page ${i + 1}:`, error.message);
                throw error;
            }
        }
        
        return images;
    }
    
    /**
     * Process a single page for Bordeaux-style tiled manuscripts
     * Used by EnhancedManuscriptDownloaderService for individual page processing
     */
    async processPage(baseId: string, pageNum: number, outputPath: string, onProgress?: (downloaded: number, total: number) => void): Promise<{ success: boolean; error?: string }> {
        try {
            console.log(`[DirectTile] Processing Bordeaux page ${pageNum} with base ID: ${baseId}`);
            
            // Construct the tile URL for this specific page
            // Bordeaux uses pattern: baseId_pageNum (4 digits) for tiled pages
            const pageId = `${baseId}_${String(pageNum).padStart(4, '0')}`;
            const tileBaseUrl = `https://selene.bordeaux.fr/in/dz/${pageId}`;
            
            console.log(`[DirectTile] Tile base URL: ${tileBaseUrl}`);
            
            // First, test if any tiles exist for this page
            const testTileUrl = `${tileBaseUrl}_files/0/0_0.jpg`;
            console.log(`[DirectTile] Testing tile existence: ${testTileUrl}`);
            
            const testResult = await this.fetchUrl(testTileUrl);
            if (!testResult.exists) {
                // Try with different page number formats if the 4-digit padded doesn't work
                const alternativeFormats = [
                    String(pageNum), // No padding
                    String(pageNum).padStart(2, '0'), // 2-digit padding
                    String(pageNum).padStart(3, '0')  // 3-digit padding
                ];
                
                let foundFormat = null;
                for (const format of alternativeFormats) {
                    const altPageId = `${baseId}_${format}`;
                    const altTileUrl = `https://selene.bordeaux.fr/in/dz/${altPageId}_files/0/0_0.jpg`;
                    console.log(`[DirectTile] Testing alternative format: ${altTileUrl}`);
                    
                    const altResult = await this.fetchUrl(altTileUrl);
                    if (altResult.exists) {
                        foundFormat = altPageId;
                        break;
                    }
                }
                
                if (foundFormat) {
                    console.log(`[DirectTile] Found working format: ${foundFormat}`);
                    const altTileBaseUrl = `https://selene.bordeaux.fr/in/dz/${foundFormat}`;
                    const imageBuffer = await this.processTiledImage(altTileBaseUrl, undefined, onProgress);
                    await fs.writeFile(outputPath, imageBuffer);
                    console.log(`[DirectTile] Successfully saved page ${pageNum} to ${outputPath} using alternative format`);
                    return { success: true };
                } else {
                    throw new Error(`No tiles found for page ${pageNum}. Tested various formats including ${pageId}.`);
                }
            }
            
            // Process the tiled image using the original format
            const imageBuffer = await this.processTiledImage(tileBaseUrl, undefined, onProgress);
            
            // Save to output path
            await fs.writeFile(outputPath, imageBuffer);
            
            console.log(`[DirectTile] Successfully saved page ${pageNum} to ${outputPath}`);
            return { success: true };
            
        } catch (error: any) {
            console.error(`[DirectTile] Error processing page ${pageNum}:`, error.message);
            return { success: false, error: error.message };
        }
    }
}