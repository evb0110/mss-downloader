import { join } from 'path';
import { promises as fs } from 'fs';
import { EnhancedPdfMerger } from './EnhancedPdfMerger';
import { getAppPath, showSaveDialog } from './ElectronCompat';

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

/**
 * PDF creation service for Electron manuscript downloader
 * Uses pdf-lib via EnhancedPdfMerger for high-quality PDF generation
 */
export class ElectronPdfMerger {
    private isProcessing = false;
    private enhancedMerger = new EnhancedPdfMerger();

    async createPDFFromImages(options: PdfMergerOptions): Promise<string> {
        const { images, outputPath, displayName, startPage, endPage, totalPages, autoSplit: _autoSplit, maxPagesPerPart: _maxPagesPerPart, onProgress, onError } = options;
        
        if (this.isProcessing) {
            throw new Error('PDF creation already in progress');
        }

        this.isProcessing = true;

        try {
            // Create PDF using pdf-lib with EnhancedPdfMerger
            
            let finalOutputPath = outputPath;
            if (!finalOutputPath) {
                // Generate default filename with manuscript name and page range
                let defaultFilename = 'manuscript.pdf';
                
                if (displayName) {
                    // Sanitize filename for filesystem compatibility
                    const cleanName = displayName
                        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')  // Remove unsafe characters  
                        .replace(/\s+/g, '_')                     // Replace spaces with underscores
                        .substring(0, 100) || 'manuscript';       // Limit length with fallback
                    
                    if (startPage && endPage && totalPages) {
                        // Include page range in filename
                        defaultFilename = `${cleanName}_pages_${startPage}-${endPage}.pdf`;
                    } else {
                        defaultFilename = `${cleanName}.pdf`;
                    }
                }
                
                const result = await showSaveDialog({
                    title: 'Save PDF',
                    defaultPath: join(getAppPath('downloads'), defaultFilename),
                    filters: [
                        { name: 'PDF files', extensions: ['pdf'] }
                    ]
                });
                
                if (result.canceled || !result.filePath) {
                    throw new Error('Save dialog cancelled');
                }
                
                finalOutputPath = result.filePath;
            }

            // CRITICAL FIX: Don't auto-split at PDF level - respect queue-level decisions
            // The queue already handled splitting based on user's global threshold
            // PDF-level splitting was creating unnecessary additional parts
            const shouldSplit = false; // Force single PDF creation
            
            if (shouldSplit) {
                // Create multiple PDF parts (currently disabled - shouldSplit = false)
                const baseName = displayName ? displayName
                    .replace(/[\u003c\u003e:"/\\|?*]/g, '_')
                    .replace(/\s+/g, '_')
                    .substring(0, 80) // Leave room for part suffixes
                    : 'Manuscript';
                
                // Create dedicated subfolder for split parts
                const outputDir = finalOutputPath.substring(0, finalOutputPath.lastIndexOf('/'));
                const folderBase = baseName
                    .replace(/_Part_\d+.*$/i, '')
                    .replace(/_pages_\d+-\d+.*$/i, '');
                const partsDir = join(outputDir, folderBase || baseName);
                
                try {
                    await fs.mkdir(partsDir, { recursive: true });
                } catch {
                    // Fallback to parent directory if mkdir fails
                }
                
                const result = await this.enhancedMerger.createSplitPDFs(images, baseName, partsDir || outputDir, {
                    maxPagesPerPart: _maxPagesPerPart || 100,
                    startPage: startPage || 1,
                    onProgress: (progress: { completed: number; total: number; message?: string }) => {
                        onProgress?.({
                            pageNumber: progress.completed,
                            totalPages: progress.total,
                            percentage: Math.round((progress.completed / progress.total) * 100)
                        });
                    }
                });
                
                if (result.success && result.files?.length > 0) {
                    return result.files[0] || '';
                } else {
                    throw new Error('Failed to create split PDFs');
                }
            } else {
                // Create single unified PDF using pdf-lib
                const pdfBytes = await this.enhancedMerger.createPDF(images, {
                    title: displayName || 'Manuscript',
                    onProgress: (current: number, total: number) => {
                        onProgress?.({
                            pageNumber: current,
                            totalPages: total,
                            percentage: Math.round((current / total) * 100)
                        });
                    }
                });
                
                // Write PDF to file system
                await fs.writeFile(finalOutputPath, pdfBytes);
            }

            return finalOutputPath;

        } catch (error: any) {
            onError?.(error instanceof Error ? error.message : String(error));
            throw error;
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Cancel ongoing PDF creation (not yet implemented)
     */
    abort(): void {
        // TODO: Implement abort functionality for long-running PDF creation
    }
}