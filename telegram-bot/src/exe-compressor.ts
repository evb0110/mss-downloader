import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CompressionResult {
  success: boolean;
  method: string;
  outputPath: string;
  outputName: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: string;
  instructions: string;
}

export class ExeCompressor {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(__dirname, '..', 'temp');
    
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }
  
  async compressExecutable(filePath: string): Promise<CompressionResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found');
    }
    
    const fileName = path.basename(filePath);
    const originalStats = fs.statSync(filePath);
    
    console.log(`Attempting to compress ${fileName} (${(originalStats.size / 1024 / 1024).toFixed(2)}MB)...`);
    
    // Try UPX compression first (best option)
    try {
      const upxResult = await this.compressWithUPX(filePath);
      if (upxResult.success) {
        return upxResult;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`UPX compression failed: ${errorMessage}`);
    }
    
    // Try 7-Zip self-extracting archive
    try {
      const sfxResult = await this.createSelfExtractingArchive(filePath);
      if (sfxResult.success) {
        return sfxResult;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`7-Zip SFX creation failed: ${errorMessage}`);
    }
    
    throw new Error('All compression methods failed');
  }
  
  private async compressWithUPX(filePath: string): Promise<CompressionResult> {
    try {
      // Check if UPX is available
      try {
        execSync('upx --version', { stdio: 'pipe' });
      } catch {
        throw new Error('UPX not installed. Install with: brew install upx');
      }
      
      const fileName = path.basename(filePath);
      const nameWithoutExt = path.basename(fileName, path.extname(fileName));
      const ext = path.extname(fileName);
      const outputFileName = `${nameWithoutExt}_compressed${ext}`;
      const outputPath = path.join(this.tempDir, outputFileName);
      
      // Copy original file to temp directory
      fs.copyFileSync(filePath, outputPath);
      
      // Compress with UPX (maximum compression)
      const command = `upx --best --lzma "${outputPath}"`;
      execSync(command, { stdio: 'pipe' });
      
      const compressedStats = fs.statSync(outputPath);
      const compressionRatio = ((1 - compressedStats.size / fs.statSync(filePath).size) * 100).toFixed(1);
      
      console.log(`UPX compression successful: ${compressionRatio}% size reduction`);
      
      return {
        success: true,
        method: 'UPX',
        outputPath: outputPath,
        outputName: outputFileName,
        originalSize: fs.statSync(filePath).size,
        compressedSize: compressedStats.size,
        compressionRatio: compressionRatio,
        instructions: `This installer has been compressed with UPX for faster download.\n\nSimply run the file - it will automatically decompress and install MSS Downloader.\n\n✅ Single file, no extraction needed!`
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`UPX compression failed: ${errorMessage}`);
    }
  }
  
  private async createSelfExtractingArchive(filePath: string): Promise<CompressionResult> {
    try {
      // Check if 7z is available
      try {
        execSync('7z', { stdio: 'pipe' });
      } catch {
        throw new Error('7-Zip not installed. Install with: brew install p7zip');
      }
      
      const fileName = path.basename(filePath);
      const nameWithoutExt = path.basename(fileName, path.extname(fileName));
      const outputFileName = `${nameWithoutExt}_SFX.exe`;
      const outputPath = path.join(this.tempDir, outputFileName);
      const tempArchive = path.join(this.tempDir, `${nameWithoutExt}.7z`);
      
      // Create 7z archive with maximum compression
      const archiveCommand = `7z a -t7z -m0=lzma2 -mx=9 -mfb=64 -md=32m -ms=on "${tempArchive}" "${filePath}"`;
      execSync(archiveCommand, { stdio: 'pipe' });
      
      // Create self-extracting archive
      // Note: This requires the 7z SFX module, which might not be available on macOS
      // Let's create a simple batch script instead
      await this.createSimpleSFX(filePath, outputPath);
      
      const compressedStats = fs.statSync(outputPath);
      const compressionRatio = ((1 - compressedStats.size / fs.statSync(filePath).size) * 100).toFixed(1);
      
      console.log(`Self-extracting archive created: ${compressionRatio}% size reduction`);
      
      // Cleanup temp archive
      if (fs.existsSync(tempArchive)) {
        fs.unlinkSync(tempArchive);
      }
      
      return {
        success: true,
        method: '7-Zip SFX',
        outputPath: outputPath,
        outputName: outputFileName,
        originalSize: fs.statSync(filePath).size,
        compressedSize: compressedStats.size,
        compressionRatio: compressionRatio,
        instructions: `This is a self-extracting installer.\n\nSimply run the file - it will automatically extract and launch the MSS Downloader installer.\n\n✅ Single file, automatic installation!`
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Self-extracting archive creation failed: ${errorMessage}`);
    }
  }
  
  private async createSimpleSFX(originalFile: string, outputPath: string): Promise<void> {
    // For now, let's just copy and compress with 7z in a different way
    // This is a simplified approach that creates a smaller file
    try {
      const command = `7z a -t7z -mx=9 -sfx "${outputPath}" "${originalFile}"`;
      execSync(command, { stdio: 'pipe' });
    } catch {
      // If SFX creation fails, fall back to just copying with a note
      fs.copyFileSync(originalFile, outputPath);
      throw new Error('SFX creation not supported on this system');
    }
  }
  
  cleanup(): void {
    if (fs.existsSync(this.tempDir)) {
      const files = fs.readdirSync(this.tempDir);
      files.forEach(file => {
        const filePath = path.join(this.tempDir, file);
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.error(`Error deleting temp file ${file}:`, error);
        }
      });
    }
  }
}