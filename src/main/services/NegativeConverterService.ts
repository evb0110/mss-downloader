import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { join, dirname, basename } from 'path';
import { app } from 'electron';
import os from 'os';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

const execAsync = promisify(exec);

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

  private async extractImagesWithPdfImages(
    pdfPath: string, 
    onProgress?: (progress: ConversionProgress) => void
  ): Promise<string[]> {
    onProgress?.(({
      stage: 'Extracting Images',
      message: 'Extracting images from PDF...',
      progress: 10
    }));

    const timestamp = Date.now();
    const extractDir = join(this.tempDir, `extract_${timestamp}`);
    
    try {
      await fs.access(extractDir);
      await fs.rm(extractDir, { recursive: true });
    } catch {
      // Directory doesn't exist, that's fine
    }
    
    await fs.mkdir(extractDir, { recursive: true });

    try {
      // Extract as JPEG for better performance and smaller size
      await execAsync(`pdfimages -j "${pdfPath}" "${join(extractDir, 'page')}"`, { 
        timeout: 60000 // 1 minute should be enough
      });

      onProgress?.(({
        stage: 'Images Extracted',
        message: 'Images extracted successfully',
        progress: 25
      }));

      const files = await fs.readdir(extractDir);
      const imageFiles = files
        .filter(file => file.endsWith('.jpg') || file.endsWith('.jpeg'))
        .sort((a, b) => {
          const aNum = parseInt(a.match(/\d+/)?.[0] || '0');
          const bNum = parseInt(b.match(/\d+/)?.[0] || '0');
          return aNum - bNum;
        })
        .map(file => join(extractDir, file));

      return imageFiles;
    } catch (error) {
      throw new Error(`Failed to extract images: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async invertImagesWithSharp(
    imagePaths: string[], 
    onProgress?: (progress: ConversionProgress) => void
  ): Promise<Buffer[]> {
    const invertedBuffers: Buffer[] = [];
    
    onProgress?.(({
      stage: 'Inverting Images',
      message: 'Converting negatives to positives...',
      progress: 30
    }));

    // Process images in parallel for much better performance
    const processPromises = imagePaths.map(async (imagePath, index) => {
      try {
        const buffer = await sharp(imagePath)
          .negate() // This is the inversion operation - much faster than ImageMagick
          .jpeg({ quality: 90 }) // Keep reasonable quality while reducing size
          .toBuffer();

        onProgress?.(({
          stage: 'Inverting Images',
          message: `Processed ${index + 1}/${imagePaths.length} images`,
          progress: 30 + Math.round((index + 1) / imagePaths.length * 50)
        }));

        return { index, buffer };
      } catch (error) {
        console.warn(`Failed to invert image ${imagePath}:`, error);
        return null;
      }
    });

    // Wait for all images to be processed
    const results = await Promise.all(processPromises);
    
    // Sort results by index to maintain order
    const sortedResults = results
      .filter(result => result !== null)
      .sort((a, b) => a!.index - b!.index);

    sortedResults.forEach(result => {
      if (result) {
        invertedBuffers.push(result.buffer);
      }
    });

    if (invertedBuffers.length === 0) {
      throw new Error('No images were successfully inverted');
    }

    return invertedBuffers;
  }

  private async createPdfFromBuffers(
    imageBuffers: Buffer[],
    outputPath: string,
    onProgress?: (progress: ConversionProgress) => void
  ): Promise<void> {
    onProgress?.(({
      stage: 'Creating PDF',
      message: `Merging ${imageBuffers.length} images into PDF...`,
      progress: 85
    }));

    try {
      const pdfDoc = await PDFDocument.create();

      for (const buffer of imageBuffers) {
        const img = await pdfDoc.embedJpg(buffer);
        const page = pdfDoc.addPage([img.width, img.height]);
        page.drawImage(img, {
          x: 0,
          y: 0,
          width: img.width,
          height: img.height,
        });
      }

      const pdfBytes = await pdfDoc.save();
      await fs.writeFile(outputPath, pdfBytes);

      onProgress?.(({
        stage: 'PDF Creation Complete',
        message: 'Positive PDF created successfully',
        progress: 95
      }));
    } catch (error) {
      throw new Error(`Failed to create PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async cleanupTempFiles(dir: string): Promise<void> {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  async convertPdf(
    fileData: Uint8Array,
    fileName: string,
    _settings: ConversionSettings,
    onProgress?: (progress: ConversionProgress) => void
  ): Promise<ConversionResult> {
    try {
      await this.ensureDirectories();

      onProgress?.(({
        stage: 'Initializing',
        message: 'Preparing conversion process...',
        progress: 0
      }));

      const timestamp = Date.now();
      const tempPdfPath = join(this.tempDir, `temp_pdf_${timestamp}.pdf`);
      await fs.writeFile(tempPdfPath, fileData);

      onProgress?.(({
        stage: 'File Prepared',
        message: 'PDF file saved to temporary location',
        progress: 5
      }));

      const extractedImages = await this.extractImagesWithPdfImages(tempPdfPath, onProgress);
      
      if (extractedImages.length === 0) {
        throw new Error('No images found in the PDF file');
      }

      const invertedBuffers = await this.invertImagesWithSharp(extractedImages, onProgress);
      
      // Get the original filename without extension
      const originalBaseName = basename(fileName, '.pdf');
      
      // Keep the original name exactly as provided, no sanitization
      const outputFileName = `${originalBaseName}_positive.pdf`;
      
      // Place in Downloads folder for easy access
      const outputPath = join(app.getPath('downloads'), outputFileName);

      await this.createPdfFromBuffers(invertedBuffers, outputPath, onProgress);

      // Cleanup
      await this.cleanupTempFiles(dirname(extractedImages[0]));
      await fs.unlink(tempPdfPath);

      onProgress?.(({
        stage: 'Conversion Complete! ✅',
        message: `Successfully converted ${invertedBuffers.length} pages`,
        progress: 100
      }));

      return {
        success: true,
        outputPath,
        pageCount: invertedBuffers.length
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      onProgress?.(({
        stage: 'Conversion Failed ❌',
        message: errorMessage
      }));

      return {
        success: false,
        error: errorMessage
      };
    }
  }
}