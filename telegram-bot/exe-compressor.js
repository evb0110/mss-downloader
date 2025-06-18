const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ExeCompressor {
    constructor() {
        this.tempDir = path.join(__dirname, 'temp');
        
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }
    
    async compressExecutable(filePath) {
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
        } catch (error) {
            console.log(`UPX compression failed: ${error.message}`);
        }
        
        // Try 7-Zip self-extracting archive
        try {
            const sfxResult = await this.createSelfExtractingArchive(filePath);
            if (sfxResult.success) {
                return sfxResult;
            }
        } catch (error) {
            console.log(`7-Zip SFX creation failed: ${error.message}`);
        }
        
        throw new Error('All compression methods failed');
    }
    
    async compressWithUPX(filePath) {
        try {
            // Check if UPX is available
            try {
                execSync('upx --version', { stdio: 'pipe' });
            } catch (error) {
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
            
        } catch (error) {
            throw new Error(`UPX compression failed: ${error.message}`);
        }
    }
    
    async createSelfExtractingArchive(filePath) {
        try {
            // Check if 7z is available
            try {
                execSync('7z', { stdio: 'pipe' });
            } catch (error) {
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
            
        } catch (error) {
            throw new Error(`Self-extracting archive creation failed: ${error.message}`);
        }
    }
    
    async createSimpleSFX(originalFile, outputPath) {
        // For now, let's just copy and compress with 7z in a different way
        // This is a simplified approach that creates a smaller file
        try {
            const command = `7z a -t7z -mx=9 -sfx "${outputPath}" "${originalFile}"`;
            execSync(command, { stdio: 'pipe' });
        } catch (error) {
            // If SFX creation fails, fall back to just copying with a note
            fs.copyFileSync(originalFile, outputPath);
            throw new Error('SFX creation not supported on this system');
        }
    }
    
    cleanup() {
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

module.exports = ExeCompressor;