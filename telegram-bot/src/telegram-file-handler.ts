import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { FileResult } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TelegramFileHandler {
  private maxFileSize: number;
  private tempDir: string;

  constructor() {
    this.maxFileSize = 50 * 1024 * 1024; // 50MB Telegram limit
    this.tempDir = path.join(__dirname, '..', 'temp');
    
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async prepareFileForTelegram(filePath: string): Promise<FileResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found');
    }
    
    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    
    // If file is already under the limit, return as-is
    if (stats.size <= this.maxFileSize) {
      return {
        type: 'direct',
        files: [{ path: filePath, name: fileName }]
      };
    }
    
    console.log(`📦 File too large (${(stats.size / 1024 / 1024).toFixed(2)}MB). Using GitHub Releases URL...`);
    
    // For large files, provide GitHub Releases download URL
    try {
      const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const version = packageJson.version;
      
      // Generate GitHub Releases URL based on filename
      const githubUrl = this.generateGitHubReleasesUrl(version, fileName);
      
      return {
        type: 'url',
        downloadUrl: githubUrl,
        fileName: fileName,
        fileSize: stats.size,
        version: version
      };
    } catch (error) {
      console.error('Failed to generate GitHub Releases URL:', error);
      throw new Error(`File too large (${(stats.size / 1024 / 1024).toFixed(2)}MB) and cannot provide download URL`);
    }
  }

  private generateGitHubReleasesUrl(version: string, fileName: string): string {
    const repoOwner = 'evb0110';
    const repoName = 'mss-downloader';
    return `https://github.com/${repoOwner}/${repoName}/releases/download/v${version}/${fileName}`;
  }

  cleanup(): void {
    // Clean up temporary files if needed
    if (fs.existsSync(this.tempDir)) {
      const files = fs.readdirSync(this.tempDir);
      files.forEach(file => {
        const filePath = path.join(this.tempDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      });
    }
  }
}