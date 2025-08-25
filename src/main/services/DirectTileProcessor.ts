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
            } catch {
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
            } catch {
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
            } catch {
                high = mid - 1;
            }
        }
        maxRow = low;
        
        console.log(`[DirectTile] Grid size at level ${maxLevel}: ${maxCol + 1} x ${maxRow + 1} tiles`);
        
        // Calculate estimated dimensions with memory validation
        const scale = Math.pow(2, maxLevel);
        const levelWidth = (maxCol + 1) * tileSize;
        const levelHeight = (maxRow + 1) * tileSize;
        let estimatedWidth = Math.ceil(levelWidth * scale / Math.pow(2, maxLevel));
        let estimatedHeight = Math.ceil(levelHeight * scale / Math.pow(2, maxLevel));

        // Validate against memory limits to prevent RangeError: Invalid array length
        const pixelCount = estimatedWidth * estimatedHeight;
        const estimatedMemory = pixelCount * 4; // 4 bytes per RGBA pixel
        const MAX_SAFE_MEMORY = 1024 * 1024 * 1024; // 1GB safe limit

        if (estimatedMemory > MAX_SAFE_MEMORY) {
            const scaleFactor = Math.sqrt(MAX_SAFE_MEMORY / estimatedMemory);
            estimatedWidth = Math.floor(estimatedWidth * scaleFactor);
            estimatedHeight = Math.floor(estimatedHeight * scaleFactor);
            console.warn(`[DirectTile] Dimensions scaled down to prevent memory allocation error: ${estimatedWidth}x${estimatedHeight} (was ${Math.ceil(levelWidth * scale / Math.pow(2, maxLevel))}x${Math.ceil(levelHeight * scale / Math.pow(2, maxLevel))})`);
        }
        
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
        
        console.log(`[DirectTile] Downloading up to ${tiles?.length} tiles...`);
        
        let validTiles = 0;
        for (let i = 0; i < tiles?.length; i += batchSize) {
            const batch = tiles.slice(i, Math.min(i + batchSize, tiles?.length));
            
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
                            onProgress(validTiles, tiles?.length);
                        }
                        
                        return tile;
                    } else {
                        tile.exists = false;
                        return tile;
                    }
                } catch (error: any) {
                    console.warn(`[DirectTile] Failed to download tile ${tile.column}_${tile.row}:`, error instanceof Error ? error.message : String(error));
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
        console.log(`[DirectTile] Stitching ${tiles?.length} tiles...`);
        
        try {
            // Use Jimp to avoid native canvas dependency
            const JimpModule: any = await import('jimp');
            const Jimp: any = JimpModule.Jimp || JimpModule.default || JimpModule;

            // ULTRA-SAFE dimensions to prevent RangeError: Invalid array length
            const MAX_DIMENSION = 16384; // Safe limit for most systems
            
            // Comprehensive dimension validation to handle NaN, negative, and non-integer values
            let safeWidth = tileInfo.estimatedDimensions.width;
            let safeHeight = tileInfo.estimatedDimensions.height;
            
            if (!Number.isFinite(safeWidth) || safeWidth <= 0) {
                console.warn(`[DirectTile] Invalid width detected (${safeWidth}), using fallback`);
                safeWidth = 1000;
            }
            if (!Number.isFinite(safeHeight) || safeHeight <= 0) {
                console.warn(`[DirectTile] Invalid height detected (${safeHeight}), using fallback`);
                safeHeight = 1000;
            }
            
            safeWidth = Math.floor(Math.min(safeWidth, MAX_DIMENSION));
            safeHeight = Math.floor(Math.min(safeHeight, MAX_DIMENSION));
            
            console.log(`[DirectTile] Original dimensions: ${tileInfo.estimatedDimensions.width}x${tileInfo.estimatedDimensions.height}`);
            console.log(`[DirectTile] Safe dimensions: ${safeWidth}x${safeHeight}`);

            if (safeWidth <= 0 || safeHeight <= 0) {
                throw new Error(`Cannot create image with invalid dimensions ${safeWidth}x${safeHeight}`);
            }

            // Create base image (white background) - Jimp v1.6.0+ syntax
            const whiteBuffer = Buffer.alloc(safeWidth * safeHeight * 4);
            // Fill with white (RGBA: 255,255,255,255)
            for (let i = 0; i < whiteBuffer.length; i += 4) {
                whiteBuffer[i] = 255;     // R
                whiteBuffer[i + 1] = 255; // G  
                whiteBuffer[i + 2] = 255; // B
                whiteBuffer[i + 3] = 255; // A
            }
            const baseImage = new Jimp({ width: safeWidth, height: safeHeight, data: whiteBuffer });
            
            let processedTiles = 0;
            for (const tile of tiles) {
                if (!tile.data) continue;
                try {
                    const img = await Jimp.read(tile.data);

                    // Calculate position (accounting for overlap)
                    const destX = tile.column * tileInfo.tileSize - (tile.column > 0 ? tileInfo.overlap : 0);
                    const destY = tile.row * tileInfo.tileSize - (tile.row > 0 ? tileInfo.overlap : 0);
                    
                    // Crop to remove overlap at source edges - Jimp v1.6.0+ uses bitmap properties
                    const sourceX = tile.column > 0 ? tileInfo.overlap : 0;
                    const sourceY = tile.row > 0 ? tileInfo.overlap : 0;
                    const imgWidth = img.bitmap?.width || img.getWidth?.() || 256;
                    const imgHeight = img.bitmap?.height || img.getHeight?.() || 256;
                    const cropW = imgWidth - sourceX - (tile.column < tileInfo.gridSize.cols - 1 ? tileInfo.overlap : 0);
                    const cropH = imgHeight - sourceY - (tile.row < tileInfo.gridSize.rows - 1 ? tileInfo.overlap : 0);
                    
                    // Guard against negative crop sizes (defensive)
                    const finalW = Math.max(1, cropW);
                    const finalH = Math.max(1, cropH);
                    if (sourceX !== 0 || sourceY !== 0 || finalW !== imgWidth || finalH !== imgHeight) {
                        img.crop({ x: sourceX, y: sourceY, w: finalW, h: finalH });
                    }

                    // Composite the tile
                    baseImage.composite(img, destX, destY);

                    processedTiles++;
                    if (processedTiles % 10 === 0) {
                        console.log(`[DirectTile] Stitching progress: ${Math.round((processedTiles / tiles?.length) * 100)}%`);
                    }
                } catch (error: any) {
                    console.error(`[DirectTile] Error processing tile ${tile.column}_${tile.row}:`, error instanceof Error ? error.message : String(error));
                }
            }

            // Encode to JPEG with quality settings - Jimp v1.6.0+ syntax
            const jpegBuffer: Buffer = await baseImage.getBuffer('image/jpeg', { quality: 85 });

            console.log(`[DirectTile] Final image size: ${(jpegBuffer?.length / 1024 / 1024).toFixed(2)} MB`);
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
        
        if (downloadedTiles?.length === 0) {
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
        
        for (let i = 0; i < pageInfos?.length; i++) {
            console.log(`[DirectTile] Processing page ${i + 1}/${pageInfos?.length}`);
            try {
                const image = await this.processTiledImage(pageInfos[i]?.baseUrl || '', pageInfos[i]?.tileInfo);
                images.push(image);
            } catch (error: any) {
                console.error(`[DirectTile] Failed to process page ${i + 1}:`, error instanceof Error ? error.message : String(error));
                throw error;
            }
        }
        
        return images;
    }
    
    /**
     * Process a single page for Bordeaux-style tiled manuscripts
     * Used by EnhancedManuscriptDownloaderService for individual page processing
     */
    async processPage(baseId: string, pageNum: number, outputPath: string, onProgress?: (downloaded: number, total: number) => void, tileHostBaseUrl?: string): Promise<{ success: boolean; error?: string }> {
        try {
            console.log(`[DirectTile] Processing Bordeaux page ${pageNum} with base ID: ${baseId}`);
            
            // Construct the tile URL for this specific page using provided host when available
            const paddedPage = String(pageNum).padStart(4, '0');
            const pageId = `${baseId}_${paddedPage}`;
            const resolvedHost = (tileHostBaseUrl && typeof tileHostBaseUrl === 'string') ? tileHostBaseUrl.replace(/\/$/, '') : 'https://selene.bordeaux.fr/in/dz';
            const tileBaseUrl = `${resolvedHost}/${pageId}`;
            console.log(`[DirectTile] Tile base URL (primary): ${tileBaseUrl}`);

            // Probe tile structure across levels instead of testing only level 0
            try {
                const tileInfo = await this.probeTileStructure(tileBaseUrl);
                const imageBuffer = await this.processTiledImage(tileBaseUrl, tileInfo, onProgress);
                await fs.writeFile(outputPath, imageBuffer);
                console.log(`[DirectTile] Successfully saved page ${pageNum} to ${outputPath}`);
                return { success: true };
            } catch (primaryProbeErr: any) {
                console.warn(`[DirectTile] Primary probe failed for ${pageId}: ${primaryProbeErr?.message || primaryProbeErr}. Trying alternative page formats...`);
            }

            // Try with different page number formats if the 4-digit padded doesn't work
            const alternativeFormats = [
                String(pageNum), // No padding
                String(pageNum).padStart(2, '0'), // 2-digit padding
                String(pageNum).padStart(3, '0')  // 3-digit padding
            ];

            for (const format of alternativeFormats) {
                const altPageId = `${baseId}_${format}`;
                const altTileBaseUrl = `${resolvedHost}/${altPageId}`;
                console.log(`[DirectTile] Probing alternative format base: ${altTileBaseUrl}`);
                try {
                    const altTileInfo = await this.probeTileStructure(altTileBaseUrl);
                    const imageBuffer = await this.processTiledImage(altTileBaseUrl, altTileInfo, onProgress);
                    await fs.writeFile(outputPath, imageBuffer);
                    console.log(`[DirectTile] Successfully saved page ${pageNum} to ${outputPath} using alternative format ${format}`);
                    return { success: true };
                } catch (altErr: any) {
                    console.warn(`[DirectTile] Alternative format probe failed for ${altPageId}: ${altErr?.message || altErr}`);
                }
            }

            throw new Error(`No tiles found for page ${pageNum} of base ${baseId}. Tried formats: 4, 3, 2, and no padding.`);
        } catch (error: any) {
            console.error(`[DirectTile] Error processing page ${pageNum}:`, error instanceof Error ? error.message : String(error));
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }
}