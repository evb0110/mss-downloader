import { app, dialog } from 'electron';
import { join } from 'path';
import { promises as fs } from 'fs';
import { EnhancedPdfMerger } from './EnhancedPdfMerger';

interface PdfMergerOptions {
    images: Buffer[];
    outputPath?: string;
    displayName?: string;
    startPage?: number;
    endPage?: number;
    totalPages?: number;
    autoSplit?: boolean;
    maxPagesPerPart?: number;
    onProgress?: (progress: { pageNumber: number; totalPages: number; percentage: number }) => void;
    onError?: (error: string) => void;
}

export class ElectronPdfMerger {
    private isProcessing = false;
    private enhancedMerger = new EnhancedPdfMerger();

    async createPDFFromImages(options: PdfMergerOptions): Promise<string> {
        const { images, outputPath, displayName, startPage, endPage, totalPages, autoSplit, maxPagesPerPart, onProgress, onError } = options;
        
        if (this.isProcessing) {
            throw new Error('PDF creation already in progress');
        }

        this.isProcessing = true;

        try {
            // For now, we'll use a simplified approach
            // Convert Buffer images to Blobs for web worker compatibility  
            // const imageBlobs = images.map(buffer => new Blob([buffer]));
            
            // For now, we'll use a simplified approach
            // In a full implementation, you'd create a Node.js worker thread
            // that uses a server-side PDF library like PDFKit or pdf-lib
            
            let finalOutputPath = outputPath;
            if (!finalOutputPath) {
                // Construct filename like source project
                let defaultFilename = 'manuscript.pdf';
                
                if (displayName) {
                    // Use filesystem-safe sanitization while preserving more characters
                    const cleanName = displayName
                        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')  // Remove filesystem-unsafe and control characters
                        .replace(/\s+/g, '_')                     // Replace spaces with underscores
                        .substring(0, 100) || 'manuscript';       // Limit to 100 characters with fallback
                    
                    if (startPage && endPage && totalPages) {
                        // Always include page numbers for clarity
                        defaultFilename = `${cleanName}_pages_${startPage}-${endPage}.pdf`;
                    } else {
                        // Fallback for missing page info
                        defaultFilename = `${cleanName}.pdf`;
                    }
                }
                
                const result = await dialog.showSaveDialog({
                    title: 'Save PDF',
                    defaultPath: join(app.getPath('downloads'), defaultFilename),
                    filters: [
                        { name: 'PDF files', extensions: ['pdf'] }
                    ]
                });
                
                if (result.canceled || !result.filePath) {
                    throw new Error('Save dialog cancelled');
                }
                
                finalOutputPath = result.filePath;
            }

            // Check if document should be auto-split
            const shouldSplit = autoSplit && images.length > (maxPagesPerPart || 100);
            
            if (shouldSplit) {
                // Create split PDFs with both part and page numbers
                const baseName = displayName ? displayName
                    .replace(/[<>:"/\\|?*]/g, '_')
                    .replace(/\s+/g, '_')
                    .substring(0, 80) // Leave room for part/page suffixes
                    : 'Manuscript';
                
                const outputDir = finalOutputPath.substring(0, finalOutputPath.lastIndexOf('/'));
                
                const result = await this.enhancedMerger.createSplitPDFs(images, baseName, outputDir, {
                    maxPagesPerPart: maxPagesPerPart || 100,
                    startPage: startPage || 1,
                    onProgress: (progress: any) => {
                        onProgress?.({
                            pageNumber: progress.overallPage,
                            totalPages: progress.totalPages,
                            percentage: Math.round(progress.percentage)
                        });
                    }
                });
                
                if (result.success && result.files.length > 0) {
                    // Return the first file path (caller can check for multiple files)
                    return result.files[0];
                } else {
                    throw new Error('Failed to create split PDFs');
                }
            } else {
                // Create single PDF
                const pdfBytes = await this.enhancedMerger.createPDF(images, {
                    title: displayName || 'Manuscript',
                    onProgress: (progress: { pageNumber: number; totalPages: number; percentage: number }) => {
                        onProgress?.({
                            pageNumber: progress.pageNumber,
                            totalPages: progress.totalPages,
                            percentage: Math.round(progress.percentage)
                        });
                    }
                });
                
                // Write the actual PDF bytes to file
                await fs.writeFile(finalOutputPath, pdfBytes);
            }

            return finalOutputPath;

        } catch (error: any) {
            onError?.(error.message);
            throw error;
        } finally {
            this.isProcessing = false;
        }
    }

    abort(): void {
        // TODO: Implement abort functionality
    }
}