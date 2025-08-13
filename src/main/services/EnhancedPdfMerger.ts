import { PDFDocument, rgb } from 'pdf-lib';

export class EnhancedPdfMerger {
    constructor() {
    }

    async createPDF(imageBuffers: Buffer[], options: { title?: string; onProgress?: (current: number, total: number) => void } = {}): Promise<Uint8Array> {
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
            } catch (error: unknown) {
                console.error(`Failed to add page ${i + 1} to PDF: ${(error as Error).message}`);
                // Continue with other pages
            }
        }
        
        const pdfBytes = await pdfDoc.save();
        return pdfBytes;
    }

    async addImageToPDF(pdfDoc: PDFDocument, imageBuffer: Buffer, pageNumber: number): Promise<void> {
        try {
            // Use original image buffer without any processing
            let image;
            try {
                // Try as JPEG first
                image = await pdfDoc.embedJpg(imageBuffer);
            } catch {
                try {
                    // Fallback to PNG
                    image = await pdfDoc.embedPng(imageBuffer);
                } catch (embedError: unknown) {
                    throw new Error(`Failed to embed image: ${embedError.message}`);
                }
            }
            
            const imageDims = image.scale(1);
            
            // Create page with original image dimensions
            const page = pdfDoc.addPage([imageDims.width, imageDims.height]);
            
            // Draw image to fill the entire page
            page.drawImage(image, {
                x: 0,
                y: 0,
                width: imageDims.width,
                height: imageDims.height,
            });
            
        } catch (error: unknown) {
            console.error(`Error processing page ${pageNumber}:`, (error as Error).message);
            
            // Fallback: create a blank page with error message
            const page = pdfDoc.addPage();
            const { height } = page.getSize();
            
            page.drawText(`Error loading page ${pageNumber}`, {
                x: 50,
                y: height - 50,
                size: 12,
                color: rgb(1, 0, 0),
            });
            
            page.drawText((error as Error).message, {
                x: 50,
                y: height - 80,
                size: 10,
                color: rgb(0.5, 0.5, 0.5),
            });
        }
    }

    // Memory-efficient processing for large documents
    async createPDFChunked(imageBuffers: Buffer[], options: { title?: string; onProgress?: (progress: number) => void; library?: string; totalPages?: number; chunkSize?: number } = {}): Promise<Uint8Array> {
        const { title = 'Manuscript', onProgress, library, totalPages: expectedTotalPages } = options;
        let { chunkSize = 50 } = options;
        
        // Dynamic batch size for large manuscripts to prevent memory issues
        if (library === 'manuscripta' && expectedTotalPages) {
            if (expectedTotalPages > 300) {
                chunkSize = 10; // Very small batches for 300+ page manuscripta.se
                console.log(`Large manuscripta.se manuscript detected (${expectedTotalPages} pages), using very small batch size: ${chunkSize}`);
            } else if (expectedTotalPages > 200) {
                chunkSize = 15;
                console.log(`Large manuscripta.se manuscript detected (${expectedTotalPages} pages), using small batch size: ${chunkSize}`);
            } else if (expectedTotalPages > 100) {
                chunkSize = 25;
            }
        } else if (imageBuffers.length > 200) {
            // General large manuscript handling
            chunkSize = Math.max(8, Math.min(30, Math.floor(150 / Math.sqrt(imageBuffers.length))));
            console.log(`Large manuscript detected (${imageBuffers.length} pages), using calculated batch size: ${chunkSize}`);
        }
        
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
                // For very large manuscripts, add a small delay to allow memory cleanup
                if (library === 'manuscripta' && expectedTotalPages && expectedTotalPages > 200) {
                    await new Promise(resolve => setTimeout(resolve, 150)); // 150ms pause for memory cleanup
                    console.log(`Memory cleanup pause after batch ${Math.floor(processedPages / chunkSize)} of ${chunks.length}`);
                }
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
            onProgress?: (progress: { completed: number; total: number; message?: string }) => void;
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
                    onProgress: (progress: { pageNumber: number }) => {
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