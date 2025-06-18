const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const CloudUploader = require('./cloud-uploader');
const WorkingUploader = require('./working-uploader');
const BinarySplitter = require('./binary-splitter');
const ExeCompressor = require('./exe-compressor');
const SmartCompressor = require('./smart-compressor');
const GitHubReleasesManager = require('./github-releases');

class TelegramFileHandler {
    constructor() {
        this.maxFileSize = 50 * 1024 * 1024; // 50MB Telegram limit
        this.tempDir = path.join(__dirname, 'temp');
        this.cloudUploader = new CloudUploader();
        this.workingUploader = new WorkingUploader();
        this.binarySplitter = new BinarySplitter();
        this.exeCompressor = new ExeCompressor();
        this.smartCompressor = new SmartCompressor();
        this.githubReleases = new GitHubReleasesManager();
        
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }
    
    async prepareFileForTelegram(filePath) {
        if (!fs.existsSync(filePath)) {
            throw new Error('File not found');
        }
        
        const stats = fs.statSync(filePath);
        const fileName = path.basename(filePath);
        
        // If file is already under the limit, return as-is
        if (stats.size <= this.maxFileSize) {
            return {
                type: 'single',
                files: [{ path: filePath, name: fileName }],
                totalSize: stats.size,
                instructions: null
            };
        }
        
        console.log(`File too large (${(stats.size / 1024 / 1024).toFixed(2)}MB). Trying GitHub Releases...`);
        
        // Try GitHub Releases first (best solution - permanent, unlimited bandwidth)
        try {
            const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
            const version = packageJson.version;
            
            const releaseResult = await this.githubReleases.uploadBuild(version, filePath, `MSS Downloader v${version} for Windows AMD64`);
            return {
                type: 'github_release',
                downloadUrl: releaseResult.downloadUrl,
                fileName: releaseResult.fileName,
                version: releaseResult.version,
                totalSize: stats.size,
                instructions: releaseResult.instructions
            };
        } catch (error) {
            console.log(`GitHub Releases failed: ${error.message}`);
            console.log(`Trying smart compression...`);
        }
        
        // Try smart compression second (creates single working EXE)
        try {
            const compressionResult = await this.smartCompressor.createSmallExecutable(filePath);
            return {
                type: 'compressed_exe',
                files: [{ path: compressionResult.outputPath, name: compressionResult.outputName }],
                totalSize: compressionResult.compressedSize,
                originalSize: compressionResult.originalSize,
                method: compressionResult.method,
                compressionRatio: compressionResult.compressionRatio,
                instructions: compressionResult.instructions
            };
        } catch (error) {
            console.log(`Smart compression failed: ${error.message}`);
            console.log(`Trying cloud upload...`);
        }
        
        // Try cloud upload second (direct download link)
        try {
            const uploadResult = await this.workingUploader.uploadFile(filePath);
            return {
                type: 'cloud',
                uploadResult: uploadResult,
                totalSize: stats.size,
                instructions: this.workingUploader.formatDownloadMessage(uploadResult)
            };
        } catch (error) {
            console.log(`Working uploader failed: ${error.message}`);
            console.log(`Trying original cloud uploader...`);
            
            try {
                const uploadResult = await this.cloudUploader.uploadFile(filePath);
                return {
                    type: 'cloud',
                    uploadResult: uploadResult,
                    totalSize: stats.size,
                    instructions: this.cloudUploader.formatDownloadMessage(uploadResult)
                };
            } catch (error2) {
                console.log(`All cloud uploads failed: ${error2.message}`);
            }
        }
        
        // NO FALLBACK TO SPLITTING - reject if we can't deliver one file
        throw new Error(`File too large and no cloud storage available. Cannot deliver single EXE file.`);
    }
    
    async compressFile(filePath) {
        const fileName = path.basename(filePath, path.extname(filePath));
        const outputPath = path.join(this.tempDir, `${fileName}.zip`);
        
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(outputPath);
            const archive = archiver('zip', {
                zlib: { level: 9 } // Maximum compression
            });
            
            output.on('close', () => {
                console.log(`Compressed: ${archive.pointer()} bytes`);
                resolve(outputPath);
            });
            
            archive.on('error', (err) => {
                reject(err);
            });
            
            archive.pipe(output);
            archive.file(filePath, { name: path.basename(filePath) });
            archive.finalize();
        });
    }
    
    async splitFile(filePath) {
        const fileName = path.basename(filePath, '.zip');
        const parts = [];
        const chunkSize = this.maxFileSize - 1024; // Leave some buffer
        
        const fileBuffer = fs.readFileSync(filePath);
        const totalParts = Math.ceil(fileBuffer.length / chunkSize);
        
        for (let i = 0; i < totalParts; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, fileBuffer.length);
            const chunk = fileBuffer.slice(start, end);
            
            const partFileName = `${fileName}.part${i + 1}.zip`;
            const partPath = path.join(this.tempDir, partFileName);
            
            fs.writeFileSync(partPath, chunk);
            parts.push({
                path: partPath,
                name: partFileName,
                part: i + 1,
                totalParts: totalParts
            });
        }
        
        return parts;
    }
    
    cleanup() {
        // Clean up temporary files
        this.binarySplitter.cleanup();
        this.exeCompressor.cleanup();
        this.smartCompressor.cleanup();
        
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

module.exports = TelegramFileHandler;