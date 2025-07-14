import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { app } from 'electron';
import os from 'os';

export interface ConversionSettings {
  quality: number;
  dpi: number;
}

export interface ConversionProgress {
  stage: string;
  message: string;
  progress?: number;
  outputPath?: string;
}

export interface ConversionResult {
  success: boolean;
  outputPath?: string;
  pageCount?: number;
  error?: string;
}

export class NegativeConverterService {
  private tempDir: string;

  constructor() {
    this.tempDir = join(os.tmpdir(), 'mss-downloader-negative-conversion');
  }


  private async ensureDirectories(): Promise<void> {
    try {
      await fs.access(this.tempDir);
    } catch {
      await fs.mkdir(this.tempDir, { recursive: true });
    }
  }











  async convertPdf(
    fileData: Uint8Array,
    fileName: string,
    _settings: ConversionSettings,
    onProgress?: (progress: ConversionProgress) => void,
    customOutputDir?: string
  ): Promise<ConversionResult> {
    try {
      onProgress?.({
        stage: 'Initializing',
        message: 'Starting PDF to images conversion...',
        progress: 0
      });

      await this.ensureDirectories();

      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 15);
      const conversionDir = join(this.tempDir, `conversion_${timestamp}_${randomId}`);
      
      // Create unique conversion directory
      await fs.mkdir(conversionDir, { recursive: true });
      
      const tempPdfPath = join(conversionDir, `input.pdf`);
      
      await fs.writeFile(tempPdfPath, fileData);

      onProgress?.({
        stage: 'File Prepared',
        message: 'PDF file saved to temporary location',
        progress: 10
      });

      // Get the original filename without extension
      const originalBaseName = basename(fileName, '.pdf');
      
      // Set up output directories - temp work dir vs final output location
      let workDir: string; // Where images are processed
      let finalOutputDir: string; // Where final PDF goes
      
      if (customOutputDir) {
        // Custom folder chosen: put final PDF directly in chosen folder
        finalOutputDir = customOutputDir;
        workDir = join(customOutputDir, `${originalBaseName}_temp_${timestamp}`);
      } else {
        // Default Downloads structure: organized subfolder  
        let downloadsPath: string;
        try {
          downloadsPath = app.getPath('downloads');
        } catch {
          downloadsPath = join(os.homedir(), 'Downloads');
        }
        
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const organizedDir = join(downloadsPath, 'PDF_Negative_Conversions', today, `${originalBaseName}_inverted`);
        finalOutputDir = organizedDir;
        workDir = organizedDir;
      }
      
      await fs.mkdir(workDir, { recursive: true });
      await fs.mkdir(finalOutputDir, { recursive: true });

      onProgress?.({
        stage: 'Converting to Images',
        message: 'Using renderer process to convert PDF to images...',
        progress: 20
      });

      // Use the new IPC method to trigger PDF rendering in renderer process
      const { BrowserWindow } = require('electron');
      
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (!mainWindow) {
        throw new Error('No main window available for PDF rendering');
      }

      console.log('📄 Requesting PDF rendering from renderer process...');
      console.log(`   PDF: ${tempPdfPath}`);
      console.log(`   Work Dir: ${workDir}`);
      console.log(`   Final Dir: ${finalOutputDir}`);

      // Send PDF file path to renderer process (avoid memory issues with large files)
      mainWindow.webContents.send('start-pdf-rendering', { 
        pdfPath: tempPdfPath, // Send file path instead of data
        outputDir: workDir, // Use work directory for processing
        finalOutputDir: finalOutputDir, // Where final PDF should go
        originalBaseName: originalBaseName // For proper naming
      });

      onProgress?.({
        stage: 'PDF Processing Started',
        message: 'Converting PDF pages to images...',
        progress: 30
      });

      // Import the helper function from main.ts
      const { waitForRendererCompletion } = require('../main');
      
      // Wait for renderer to signal completion
      let actualPageCount: number;
      try {
        actualPageCount = await waitForRendererCompletion();
        console.log(`📄 Renderer completed: ${actualPageCount} pages`);
      } catch (error) {
        console.warn('⚠️ Renderer completion timeout, checking files manually');
        // Fallback to file checking
        try {
          const files = await fs.readdir(workDir);
          const pngFiles = files.filter(f => f.endsWith('.png'));
          actualPageCount = pngFiles.length;
        } catch {
          actualPageCount = 0;
        }
      }

      onProgress?.({
        stage: 'Images Ready',
        message: `Processed ${actualPageCount} pages - check output folder`,
        progress: 90
      });

      // Cleanup only temp PDF and source images, keep inverted images in case PDF merge failed
      try {
        await fs.rm(conversionDir, { recursive: true, force: true });
        console.log('🧹 Cleaned up temporary PDF file');
        
        // If using custom output, clean up only the source images from temp work directory
        if (customOutputDir && workDir !== finalOutputDir) {
          try {
            const files = await fs.readdir(workDir);
            const sourceImages = files.filter(f => f.startsWith('page-') && f.endsWith('.jpg'));
            
            for (const file of sourceImages) {
              await fs.unlink(join(workDir, file));
            }
            
            console.log(`🧹 Cleaned up ${sourceImages.length} source images, kept inverted images`);
            
            // Only remove work directory if it's empty (no inverted images left)
            const remainingFiles = await fs.readdir(workDir);
            if (remainingFiles.length === 0) {
              await fs.rm(workDir, { recursive: true, force: true });
              console.log('🧹 Removed empty work directory');
            }
          } catch (cleanupError) {
            console.warn('⚠️ Could not clean up source images:', cleanupError instanceof Error ? cleanupError.message : cleanupError);
          }
        }
      } catch (cleanupError) {
        console.warn('⚠️ Could not clean up temporary files:', cleanupError instanceof Error ? cleanupError.message : cleanupError);
      }

      onProgress?.({
        stage: 'Conversion Complete! ✅',
        message: `Successfully processed ${actualPageCount} pages`,
        progress: 100,
        outputPath: finalOutputDir
      });

      return {
        success: true,
        outputPath: finalOutputDir,
        pageCount: actualPageCount
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      onProgress?.({
        stage: 'Conversion Failed ❌',
        message: errorMessage
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }
}