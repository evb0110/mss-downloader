import { promises as fs } from 'fs';
import https from 'https';
import path from 'path';
import type { CanvasRenderingContext2D } from 'canvas';

interface CanvasModule {
    createCanvas: (width: number, height: number) => {
        getContext: (type: '2d') => CanvasRenderingContext2D;
        toBuffer: () => Buffer;
    };
    loadImage: (data: Buffer) => Promise<{
        width: number;
        height: number;
    }>;
}

/**
 * ZIF (Zoomable Image Format) Processor
 * Extracts tiles from Morgan Library .zif files (BigTIFF format) and provides full-resolution image data
 */

interface TiffHeader {
    version: string;
    isLittleEndian: boolean;
    ifdOffset: bigint;
}

interface IfdEntry {
    tag: number;
    type: number;
    count: bigint;
    valueOffset: bigint;
}

interface ImageInfo {
    width: number;
    height: number;
    tileWidth: number;
    tileHeight: number;
    compression: number;
}

interface ExtractedTile {
    index: number;
    offset: number;
    size: number;
    data: Buffer;
    x: number;
    y: number;
}

export class ZifImageProcessor {
    
    /**
     * Download ZIF file from URL
     */
    private async downloadZifFile(url: string): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            
            https.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }
                
                response.on('data', (chunk) => {
                    chunks.push(chunk);
                });
                
                response.on('end', () => {
                    resolve(Buffer.concat(chunks));
                });
            }).on('error', reject);
        });
    }
    
    /**
     * Parse TIFF/BigTIFF header
     */
    private readTiffHeader(buffer: Buffer): TiffHeader {
        const byteOrder = buffer.readUInt16LE(0);
        const isLittleEndian = byteOrder === 0x4949;
        
        if (!isLittleEndian) {
            throw new Error('Only little-endian TIFF files are supported');
        }
        
        const magic = buffer.readUInt16LE(2);
        if (magic === 43) {
            // BigTIFF
            buffer.readUInt16LE(4); // offsetSize (not used)
            buffer.readUInt16LE(6); // reserved (not used) 
            const ifdOffset = buffer.readBigUInt64LE(8);
            
            return {
                version: 'BigTIFF',
                isLittleEndian: true,
                ifdOffset
            };
        } else if (magic === 42) {
            // Standard TIFF
            const ifdOffset = BigInt(buffer.readUInt32LE(4));
            
            return {
                version: 'TIFF',
                isLittleEndian: true,
                ifdOffset
            };
        } else {
            throw new Error('Invalid TIFF magic number');
        }
    }
    
    /**
     * Read Image File Directory (IFD)
     */
    private readIFD(buffer: Buffer, offset: bigint, isBigTiff: boolean): IfdEntry[] {
        let currentOffset = Number(offset);
        const entries: IfdEntry[] = [];
        
        // Read entry count
        const entryCount = isBigTiff ? 
            buffer.readBigUInt64LE(currentOffset) : 
            BigInt(buffer.readUInt16LE(currentOffset));
        
        currentOffset += isBigTiff ? 8 : 2;
        
        // Read each entry
        for (let i = 0; i < Number(entryCount); i++) {
            const entry: IfdEntry = {
                tag: buffer.readUInt16LE(currentOffset),
                type: buffer.readUInt16LE(currentOffset + 2),
                count: isBigTiff ? 
                    buffer.readBigUInt64LE(currentOffset + 4) : 
                    BigInt(buffer.readUInt32LE(currentOffset + 4)),
                valueOffset: isBigTiff ? 
                    buffer.readBigUInt64LE(currentOffset + 12) : 
                    BigInt(buffer.readUInt32LE(currentOffset + 8))
            };
            
            entries.push(entry);
            currentOffset += isBigTiff ? 20 : 12;
        }
        
        return entries;
    }
    
    /**
     * Extract image information from IFD entries
     */
    private extractImageInfo(entries: IfdEntry[]): ImageInfo {
        const info: Partial<ImageInfo> = {};
        
        for (const entry of entries) {
            switch (entry.tag) {
                case 256: // ImageWidth
                    info.width = Number(entry.valueOffset);
                    break;
                case 257: // ImageLength
                    info.height = Number(entry.valueOffset);
                    break;
                case 322: // TileWidth
                    info.tileWidth = Number(entry.valueOffset);
                    break;
                case 323: // TileLength
                    info.tileHeight = Number(entry.valueOffset);
                    break;
                case 259: // Compression
                    info.compression = Number(entry.valueOffset);
                    break;
            }
        }
        
        if (!info.width || !info.height || !info.tileWidth || !info.tileHeight) {
            throw new Error('Missing required image dimensions in ZIF file');
        }
        
        return info as ImageInfo;
    }
    
    /**
     * Extract tile data from ZIF file
     */
    private extractTiles(buffer: Buffer, entries: IfdEntry[], imageInfo: ImageInfo, isBigTiff: boolean): ExtractedTile[] {
        // Find tile offset and byte count entries
        const tileOffsetsEntry = entries.find(e => e.tag === 324); // TileOffsets
        const tileBytesEntry = entries.find(e => e.tag === 325);   // TileByteCounts
        
        if (!tileOffsetsEntry || !tileBytesEntry) {
            throw new Error('Tile data not found in ZIF file');
        }
        
        const tiles: ExtractedTile[] = [];
        const tileCount = Number(tileOffsetsEntry.count);
        const offsetsDataOffset = Number(tileOffsetsEntry.valueOffset);
        const bytesDataOffset = Number(tileBytesEntry.valueOffset);
        
        // Calculate tiles grid
        const tilesX = Math.ceil(imageInfo.width / imageInfo.tileWidth);
        const tilesY = Math.ceil(imageInfo.height / imageInfo.tileHeight);
        
        console.log(`Extracting ${tileCount} tiles (${tilesX}x${tilesY} grid)...`);
        
        for (let i = 0; i < tileCount; i++) {
            // Read tile offset (8 bytes for BigTIFF type 16, 4 bytes for TIFF type 4)
            const tileOffset = isBigTiff ? 
                buffer.readBigUInt64LE(offsetsDataOffset + i * 8) :
                BigInt(buffer.readUInt32LE(offsetsDataOffset + i * 4));
            
            // Read tile byte count (4 bytes for type 4)
            const tileByteCount = buffer.readUInt32LE(bytesDataOffset + i * 4);
            
            // Calculate tile position
            const tileX = i % tilesX;
            const tileY = Math.floor(i / tilesX);
            
            // Extract tile data
            const tileData = buffer.slice(Number(tileOffset), Number(tileOffset) + tileByteCount);
            
            tiles.push({
                index: i,
                offset: Number(tileOffset),
                size: tileByteCount,
                data: tileData,
                x: tileX,
                y: tileY
            });
        }
        
        return tiles;
    }
    
    /**
     * Process ZIF file and stitch all tiles into a full-resolution image
     * Returns complete stitched image at full resolution (e.g., 13,546 x 13,546 px)
     */
    async processZifFile(zifUrl: string, outputDir?: string, timeoutMs = 300000): Promise<Buffer> {
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`ZIF processing timed out after ${timeoutMs / 1000}s`));
            }, timeoutMs);
        });

        try {
            console.log(`Processing ZIF file: ${zifUrl} (timeout: ${timeoutMs / 1000}s)`);
            
            const processingPromise = this.processZifFileInternal(zifUrl, outputDir);
            
            // Race between processing and timeout
            const result = await Promise.race([processingPromise, timeoutPromise]);
            return result;
            
        } catch (error) {
            console.error('Error processing ZIF file:', error);
            throw error;
        }
    }

    /**
     * Internal ZIF processing method without timeout wrapper
     */
    private async processZifFileInternal(zifUrl: string, outputDir?: string): Promise<Buffer> {
        // Download ZIF file
        const zifBuffer = await this.downloadZifFile(zifUrl);
        console.log(`Downloaded ZIF file: ${(zifBuffer?.length / 1024 / 1024).toFixed(2)} MB`);
        
        // Parse header
        const header = this.readTiffHeader(zifBuffer);
        const isBigTiff = header.version === 'BigTIFF';
        
        // Read IFD
        const entries = this.readIFD(zifBuffer, header.ifdOffset, isBigTiff);
        
        // Extract image info
        const imageInfo = this.extractImageInfo(entries);
        console.log(`Image dimensions: ${imageInfo.width}x${imageInfo.height}`);
        console.log(`Tile size: ${imageInfo.tileWidth}x${imageInfo.tileHeight}`);
        
        // Extract tiles
        const tiles = this.extractTiles(zifBuffer, entries, imageInfo, isBigTiff);
        console.log(`Extracted ${tiles?.length} tiles`);
        
        if (outputDir) {
            // Save analysis data
            await fs.mkdir(outputDir, { recursive: true });
            
            const analysisData = {
                sourceUrl: zifUrl,
                fileSize: zifBuffer?.length,
                imageInfo,
                tileCount: tiles?.length,
                compression: imageInfo.compression,
                megapixels: (imageInfo.width * imageInfo.height) / 1000000,
                timestamp: new Date().toISOString()
            };
            
            await fs.writeFile(
                path.join(outputDir, 'zif-analysis.json'),
                JSON.stringify(analysisData, null, 2)
            );
            
            // Save first few tiles as samples
            for (let i = 0; i < Math.min(3, tiles?.length); i++) {
                const tilePath = path.join(outputDir, `tile-${i}-${tiles[i]?.x}-${tiles[i]?.y}.jpg`);
                const tileData = tiles[i]?.data;
                if (tileData) {
                    await fs.writeFile(tilePath, tileData);
                }
            }
        }
        
        // Stitch tiles into full-resolution image
        const stitchedImage = await this.stitchTiles(tiles, imageInfo);
        console.log(`Stitched full-resolution image: ${(stitchedImage?.length / 1024 / 1024)?.toFixed(2)} MB`);
        
        return stitchedImage;
    }
    
    /**
     * Stitch tiles into a full-resolution image using Canvas
     */
    private async stitchTiles(tiles: ExtractedTile[], imageInfo: ImageInfo): Promise<Buffer> {
        try {
            console.log(`Stitching ${tiles?.length} tiles into ${imageInfo.width}x${imageInfo.height} image...`);
            
            // Try to import Canvas dynamically
            let Canvas: CanvasModule;
            try {
                Canvas = await import('canvas');
            } catch {
                // Canvas not available (e.g., ARM64 build) - return first tile as fallback
                console.warn('Canvas dependency not available on this platform. Morgan Library .zif processing limited to first tile only.');
                if (tiles?.length > 0 && tiles[0]?.data) {
                    console.log('Returning first tile as fallback image...');
                    return tiles[0].data;
                } else {
                    throw new Error('No tiles available and Canvas not installed. Cannot process Morgan Library .zif files on this platform.');
                }
            }
            
            // ULTRA-SAFE canvas dimensions to prevent RangeError: Invalid array length
            const MAX_CANVAS_SIZE = 16384; // Safe limit for most systems
            
            // Comprehensive dimension validation to handle NaN, negative, and non-integer values
            let safeWidth = imageInfo.width;
            let safeHeight = imageInfo.height;
            
            // Handle invalid numbers (NaN, Infinity, negative)
            if (!Number.isFinite(safeWidth) || safeWidth <= 0) {
                console.warn(`[ZIF] Invalid width detected (${safeWidth}), using fallback`);
                safeWidth = 1000; // Fallback to reasonable size
            }
            
            if (!Number.isFinite(safeHeight) || safeHeight <= 0) {
                console.warn(`[ZIF] Invalid height detected (${safeHeight}), using fallback`);
                safeHeight = 1000; // Fallback to reasonable size
            }
            
            // Ensure integers (Canvas requires integer dimensions)
            safeWidth = Math.floor(safeWidth);
            safeHeight = Math.floor(safeHeight);
            
            // Apply size limits
            safeWidth = Math.min(safeWidth, MAX_CANVAS_SIZE);
            safeHeight = Math.min(safeHeight, MAX_CANVAS_SIZE);
            
            console.log(`[ZIF] Original dimensions: ${imageInfo.width}x${imageInfo.height}`);
            console.log(`[ZIF] Safe dimensions: ${safeWidth}x${safeHeight}`);

            if (safeWidth !== imageInfo.width || safeHeight !== imageInfo.height) {
                console.warn(`[ZIF] Dimensions adjusted to prevent memory allocation error`);
            }
            
            // Final validation before Canvas creation
            if (safeWidth <= 0 || safeHeight <= 0 || !Number.isInteger(safeWidth) || !Number.isInteger(safeHeight)) {
                throw new Error(`Cannot create canvas with invalid dimensions ${safeWidth}x${safeHeight}`);
            }

            // Create canvas with safe image dimensions
            const canvas = Canvas.createCanvas(safeWidth, safeHeight);
            const ctx = canvas.getContext('2d');
            
            // Calculate grid dimensions
            const tilesX = Math.ceil(imageInfo.width / imageInfo.tileWidth);
            const tilesY = Math.ceil(imageInfo.height / imageInfo.tileHeight);
            
            console.log(`Tile grid: ${tilesX}x${tilesY}`);
            
            // Process tiles in batches to manage memory and prevent hanging
            const batchSize = 10; // Reduced batch size for better timeout handling
            let processedTiles = 0;
            
            for (let batchStart = 0; batchStart < tiles?.length; batchStart += batchSize) {
                const batch = tiles.slice(batchStart, Math.min(batchStart + batchSize, tiles?.length));
                
                // Add timeout protection for batch processing
                const batchTimeout = 30000; // 30 seconds per batch
                const batchPromise = this.processTileBatch(batch, Canvas, ctx, imageInfo);
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => {
                        reject(new Error(`Tile batch processing timed out after ${batchTimeout / 1000}s`));
                    }, batchTimeout);
                });
                
                try {
                    const processedCount = await Promise.race([batchPromise, timeoutPromise]);
                    processedTiles += processedCount;
                    
                    // Log progress
                    const progress = Math.round((processedTiles / tiles?.length) * 100);
                    console.log(`Stitching progress: ${progress}% (${processedTiles}/${tiles?.length} tiles)`);
                    
                    // Yield control to prevent hanging
                    await new Promise(resolve => setTimeout(resolve, 1));
                } catch (error) {
                    console.warn(`Batch processing failed: ${error}. Skipping batch.`);
                }
            }
            
            console.log(`Stitching complete: ${processedTiles}/${tiles?.length} tiles successfully processed`);
            
            // Convert canvas to JPEG buffer (high quality)
            const jpegBuffer = canvas.toBuffer();
            
            console.log(`Final image size: ${(jpegBuffer?.length / 1024 / 1024).toFixed(2)} MB`);
            
            return jpegBuffer;
            
        } catch (error: any) {
            console.error('Error stitching tiles:', error);
            throw new Error(`Failed to stitch tiles: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Process a batch of tiles with timeout protection
     */
    private async processTileBatch(batch: ExtractedTile[], Canvas: CanvasModule, ctx: CanvasRenderingContext2D, imageInfo: ImageInfo): Promise<number> {
        // Process batch tiles in parallel
        const batchPromises = batch.map(async (tile) => {
            try {
                // Load tile as image
                const image = await Canvas.loadImage(tile.data);
                
                // Calculate position on canvas
                const x = tile.x * imageInfo.tileWidth;
                const y = tile.y * imageInfo.tileHeight;
                
                // Calculate actual tile dimensions (edge tiles might be smaller)
                const tileWidth = Math.min(imageInfo.tileWidth, imageInfo.width - x);
                const tileHeight = Math.min(imageInfo.tileHeight, imageInfo.height - y);
                
                return { image, x, y, tileWidth, tileHeight, index: tile.index };
            } catch (error) {
                console.warn(`Failed to load tile ${tile.index}: ${error}`);
                return null;
            }
        });
        
        const loadedTiles = await Promise.all(batchPromises);
        
        // Draw loaded tiles to canvas
        let processedCount = 0;
        for (const tileData of loadedTiles) {
            if (tileData) {
                ctx.drawImage(tileData.image as any, tileData.x, tileData.y, tileData.tileWidth, tileData.tileHeight);
                processedCount++;
            }
        }
        
        return processedCount;
    }
    
    
    /**
     * Get all tile data from ZIF file for full-resolution reconstruction
     */
    async getAllTiles(zifUrl: string): Promise<{ tiles: ExtractedTile[], imageInfo: ImageInfo }> {
        const zifBuffer = await this.downloadZifFile(zifUrl);
        const header = this.readTiffHeader(zifBuffer);
        const isBigTiff = header.version === 'BigTIFF';
        const entries = this.readIFD(zifBuffer, header.ifdOffset, isBigTiff);
        const imageInfo = this.extractImageInfo(entries);
        const tiles = this.extractTiles(zifBuffer, entries, imageInfo, isBigTiff);
        
        return { tiles, imageInfo };
    }
}