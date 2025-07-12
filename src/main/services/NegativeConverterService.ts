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
    onProgress?: (progress: ConversionProgress) => void
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
      
      // Create output directory in Downloads folder
      let downloadsPath: string;
      try {
        downloadsPath = app.getPath('downloads');
      } catch {
        // Fallback for testing without Electron
        downloadsPath = join(os.homedir(), 'Downloads');
      }
      
      const outputDir = join(downloadsPath, `${originalBaseName}_images_${timestamp}`);
      await fs.mkdir(outputDir, { recursive: true });

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
      console.log(`   Output: ${outputDir}`);

      // Read PDF data and send to renderer process
      const pdfData = await fs.readFile(tempPdfPath);
      
      // Send PDF data directly to renderer (not file path)
      mainWindow.webContents.send('start-pdf-rendering', { 
        pdfData: Array.from(pdfData), // Convert to array for IPC transfer
        outputDir: outputDir 
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
          const files = await fs.readdir(outputDir);
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

      // Cleanup temp PDF
      try {
        await fs.rm(conversionDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn('⚠️ Could not clean up temporary directory:', cleanupError instanceof Error ? cleanupError.message : cleanupError);
      }

      onProgress?.({
        stage: 'Conversion Complete! ✅',
        message: `Successfully processed ${actualPageCount} pages`,
        progress: 100
      });

      return {
        success: true,
        outputPath: outputDir,
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