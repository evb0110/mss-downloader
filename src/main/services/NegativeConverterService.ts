import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { join, dirname, basename } from 'path';
import { app } from 'electron';
import os from 'os';

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
  private outputDir: string;

  constructor() {
    this.tempDir = join(os.tmpdir(), 'mss-downloader-negative-conversion');
    this.outputDir = join(app.getPath('documents'), 'MSS Downloader', 'Converted Positives');
  }

  private async ensureDirectories(): Promise<void> {
    for (const dir of [this.tempDir, this.outputDir]) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
      }
    }
  }

  private async checkImageMagickAvailability(): Promise<boolean> {
    try {
      await execAsync('magick -version');
      return true;
    } catch {
      try {
        await execAsync('convert -version');
        return true;
      } catch {
        return false;
      }
    }
  }

  private async getMagickCommand(): Promise<string> {
    try {
      await execAsync('magick -version');
      return 'magick';
    } catch {
      try {
        await execAsync('convert -version');
        return 'convert';
      } catch {
        throw new Error('ImageMagick not found. Please install ImageMagick to use the negative converter.');
      }
    }
  }

  private async extractImages(
    pdfPath: string, 
    onProgress?: (progress: ConversionProgress) => void
  ): Promise<string[]> {
    onProgress?.({
      stage: 'Extracting Images',
      message: 'Extracting images from PDF...',
      progress: 10
    });

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
      // Use pdfimages - slow but reliable
      await execAsync(`pdfimages -png "${pdfPath}" "${join(extractDir, 'page')}"`, { 
        timeout: 300000 // 5 minutes
      });

      onProgress?.({
        stage: 'Extraction Complete',
        message: 'Images extracted successfully',
        progress: 30
      });

      const files = await fs.readdir(extractDir);
      const imageFiles = files
        .filter(file => file.endsWith('.png'))
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

  private async invertImages(
    imagePaths: string[], 
    onProgress?: (progress: ConversionProgress) => void
  ): Promise<string[]> {
    const magickCommand = await this.getMagickCommand();
    const invertedPaths: string[] = [];
    
    onProgress?.({
      stage: 'Inverting Images',
      message: 'Converting negatives to positives...',
      progress: 40
    });

    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];
      const fileName = basename(imagePath, '.png');
      const outputPath = join(dirname(imagePath), `${fileName}_positive.png`);

      try {
        if (magickCommand === 'magick') {
          await execAsync(`magick "${imagePath}" -negate "${outputPath}"`, { 
            timeout: 30000
          });
        } else {
          await execAsync(`convert "${imagePath}" -negate "${outputPath}"`, { 
            timeout: 30000
          });
        }
        
        invertedPaths.push(outputPath);

        const progress = 40 + Math.round((i + 1) / imagePaths.length * 40);
        onProgress?.({
          stage: 'Inverting Images',
          message: `Processed ${i + 1}/${imagePaths.length} images`,
          progress
        });
      } catch (error) {
        // Skip failed images silently
      }
    }

    if (invertedPaths.length === 0) {
      throw new Error('No images were successfully inverted');
    }

    return invertedPaths;
  }

  private async createPdfFromImages(
    imagePaths: string[],
    outputPath: string,
    settings: ConversionSettings,
    onProgress?: (progress: ConversionProgress) => void
  ): Promise<void> {
    onProgress?.({
      stage: 'Creating PDF',
      message: `Merging ${imagePaths.length} images into PDF...`,
      progress: 85
    });

    const magickCommand = await this.getMagickCommand();
    const imageList = imagePaths.map(img => `"${img}"`).join(' ');

    // Build the command with settings
    let densityFlag = '';
    if (settings.dpi > 0) {
      densityFlag = `-density ${settings.dpi}`;
    }

    try {
      if (magickCommand === 'magick') {
        await execAsync(`magick ${imageList} ${densityFlag} -quality ${settings.quality} "${outputPath}"`, {
          timeout: 300000, // 5 minutes
          maxBuffer: 1024 * 1024 * 100
        });
      } else {
        await execAsync(`convert ${imageList} ${densityFlag} -quality ${settings.quality} "${outputPath}"`, {
          timeout: 300000,
          maxBuffer: 1024 * 1024 * 100
        });
      }

      onProgress?.({
        stage: 'PDF Creation Complete',
        message: 'Positive PDF created successfully',
        progress: 95
      });
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
    settings: ConversionSettings,
    onProgress?: (progress: ConversionProgress) => void
  ): Promise<ConversionResult> {
    try {
      if (!(await this.checkImageMagickAvailability())) {
        throw new Error('ImageMagick is not installed or not available in PATH. Please install ImageMagick to use the negative converter.');
      }

      await this.ensureDirectories();

      onProgress?.({
        stage: 'Initializing',
        message: 'Preparing conversion process...',
        progress: 0
      });

      const timestamp = Date.now();
      const tempPdfPath = join(this.tempDir, `temp_pdf_${timestamp}.pdf`);
      await fs.writeFile(tempPdfPath, fileData);

      onProgress?.({
        stage: 'File Prepared',
        message: 'PDF file saved to temporary location',
        progress: 5
      });

      const extractedImages = await this.extractImages(tempPdfPath, onProgress);
      
      if (extractedImages.length === 0) {
        throw new Error('No images found in the PDF file');
      }

      const invertedImages = await this.invertImages(extractedImages, onProgress);
      
      // Get the original filename without extension
      const originalBaseName = basename(fileName, '.pdf');
      
      // Keep the original name exactly as provided, no sanitization
      const outputFileName = `${originalBaseName}_positive.pdf`;
      
      // Place in Downloads folder for easy access
      const outputPath = join(app.getPath('downloads'), outputFileName);

      await this.createPdfFromImages(invertedImages, outputPath, settings, onProgress);

      await this.cleanupTempFiles(dirname(extractedImages[0]));
      await fs.unlink(tempPdfPath);

      onProgress?.({
        stage: 'Conversion Complete! ✅',
        message: `Successfully converted ${invertedImages.length} pages`,
        progress: 100
      });

      return {
        success: true,
        outputPath,
        pageCount: invertedImages.length
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

  getOutputDirectory(): string {
    return this.outputDir;
  }

}