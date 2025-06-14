import { PDFDocument, rgb } from 'pdf-lib';
import sharp from 'sharp';
import { configService } from './ConfigService.js';

export class EnhancedPdfMerger {
    constructor() {
        // Configuration is accessed via configService when needed
    }

    async createPDF(imageBuffers: Buffer[], options: any = {}): Promise<Uint8Array> {
        const { title = 'Manuscript', onProgress } = options;
        
        const pdfDoc = await PDFDocument.create();
        pdfDoc.setTitle(title);
        pdfDoc.setAuthor('Manuscript Downloader');
        pdfDoc.setSubject('Downloaded manuscript');
        pdfDoc.setCreator('Electron Manuscript Downloader');
        
        const totalPages = imageBuffers.length;
        
        for (let i = 0; i < totalPages; i++) {
            if (onProgress) {
                onProgress({
                    pageNumber: i + 1,
                    totalPages,
                    percentage: ((i + 1) / totalPages) * 100,
                });
            }
            
            try {
                await this.addImageToPDF(pdfDoc, imageBuffers[i], i + 1);
            } catch (error: any) {
                console.error(`Failed to add page ${i + 1} to PDF: ${error.message}`);
                // Continue with other pages
            }
        }
        
        const pdfBytes = await pdfDoc.save();
        return pdfBytes;
    }

    async addImageToPDF(pdfDoc: PDFDocument, imageBuffer: Buffer, pageNumber: number): Promise<void> {
        try {
            // Use sharp to process and optimize the image
            const imageInfo = await sharp(imageBuffer).metadata();
            const { width: originalWidth, height: originalHeight, format } = imageInfo;
            
            if (!originalWidth || !originalHeight) {
                throw new Error(`Invalid image dimensions for page ${pageNumber}`);
            }
            
            let processedImageBuffer: Buffer;
            
            // Convert to JPEG if not already, and optimize
            if (format !== 'jpeg') {
                processedImageBuffer = await sharp(imageBuffer)
                    .jpeg({ quality: Math.round(configService.get('pdfQuality') * 100), progressive: true })
                    .toBuffer();
            } else {
                // Re-compress JPEG for optimization
                processedImageBuffer = await sharp(imageBuffer)
                    .jpeg({ quality: Math.round(configService.get('pdfQuality') * 100), progressive: true })
                    .toBuffer();
            }
            
            // Embed image in PDF
            const image = await pdfDoc.embedJpg(processedImageBuffer);
            const imageDims = image.scale(1);
            
            // Create page with image dimensions
            const page = pdfDoc.addPage([imageDims.width, imageDims.height]);
            
            // Draw image to fill the entire page
            page.drawImage(image, {
                x: 0,
                y: 0,
                width: imageDims.width,
                height: imageDims.height,
            });
            
        } catch (error: any) {
            console.error(`Error processing page ${pageNumber}:`, error.message);
            
            // Fallback: create a blank page with error message
            const page = pdfDoc.addPage();
            const { height } = page.getSize();
            
            page.drawText(`Error loading page ${pageNumber}`, {
                x: 50,
                y: height - 50,
                size: 12,
                color: rgb(1, 0, 0),
            });
            
            page.drawText(error.message, {
                x: 50,
                y: height - 80,
                size: 10,
                color: rgb(0.5, 0.5, 0.5),
            });
        }
    }

    // Memory-efficient processing for large documents
    async createPDFChunked(imageBuffers: Buffer[], options: any = {}): Promise<Uint8Array> {
        const { title = 'Manuscript', onProgress, chunkSize = 50 } = options;
        
        const pdfDoc = await PDFDocument.create();
        pdfDoc.setTitle(title);
        pdfDoc.setAuthor('Manuscript Downloader');
        pdfDoc.setSubject('Downloaded manuscript');
        pdfDoc.setCreator('Electron Manuscript Downloader');
        
        const totalPages = imageBuffers.length;
        const chunks: Buffer[][] = [];
        
        // Split into chunks
        for (let i = 0; i < totalPages; i += chunkSize) {
            chunks.push(imageBuffers.slice(i, i + chunkSize));
        }
        
        let processedPages = 0;
        
        for (const chunk of chunks) {
            for (const imageBuffer of chunk) {
                if (onProgress) {
                    onProgress({
                        pageNumber: processedPages + 1,
                        totalPages,
                        percentage: ((processedPages + 1) / totalPages) * 100,
                    });
                }
                
                await this.addImageToPDF(pdfDoc, imageBuffer, processedPages + 1);
                processedPages++;
            }
            
            // Force garbage collection between chunks if available
            if (global.gc) {
                global.gc();
            }
        }
        
        const pdfBytes = await pdfDoc.save();
        return pdfBytes;
    }

    // Create split PDFs for very large manuscripts
    async createSplitPDFs(
        imageBuffers: Buffer[], 
        baseName: string, 
        outputDir: string, 
        options: {
            maxPagesPerPart?: number;
            startPage?: number;
            onProgress?: (progress: any) => void;
        } = {}
    ): Promise<{
        success: boolean;
        split: boolean;
        files: string[];
        totalPages: number;
        failedPages: number;
    }> {
        const { maxPagesPerPart = 100, startPage = 1, onProgress } = options;
        const totalPages = imageBuffers.length;
        const files: string[] = [];
        let failedPages = 0;
        
        // Calculate number of parts needed
        const totalParts = Math.ceil(totalPages / maxPagesPerPart);
        
        for (let partIndex = 0; partIndex < totalParts; partIndex++) {
            const partNumber = partIndex + 1;
            const startIdx = partIndex * maxPagesPerPart;
            const endIdx = Math.min(startIdx + maxPagesPerPart, totalPages);
            const partImages = imageBuffers.slice(startIdx, endIdx);
            
            // Calculate actual page numbers for this part
            const actualStartPage = startPage + startIdx;
            const actualEndPage = startPage + endIdx - 1;
            
            // Create filename with both part and page information
            const partFilename = `${baseName}_part_${partNumber.toString().padStart(2, '0')}_pages_${actualStartPage}-${actualEndPage}.pdf`;
            const partPath = `${outputDir}/${partFilename}`;
            
            try {
                const pdfBytes = await this.createPDF(partImages, {
                    title: `${baseName} - Part ${partNumber}`,
                    onProgress: (progress: any) => {
                        const overallProgress = {
                            currentPart: partNumber,
                            totalParts,
                            pageInPart: progress.pageNumber,
                            pagesInPart: partImages.length,
                            overallPage: startIdx + progress.pageNumber,
                            totalPages,
                            percentage: ((startIdx + progress.pageNumber) / totalPages) * 100
                        };
                        onProgress?.(overallProgress);
                    }
                });
                
                // Write the PDF file
                const fs = await import('fs/promises');
                await fs.writeFile(partPath, pdfBytes);
                files.push(partPath);
                
            } catch (error) {
                console.error(`Failed to create part ${partNumber}:`, error);
                failedPages += partImages.length;
            }
        }
        
        return {
            success: files.length > 0,
            split: true,
            files,
            totalPages,
            failedPages
        };
    }
}