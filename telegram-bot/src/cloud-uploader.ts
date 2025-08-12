import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface UploadService {
  name: string;
  upload: (filePath: string) => Promise<{ url: string }>;
  maxSize: number;
  expires: string;
}

interface UploadResult {
  service: string;
  url: string;
  fileName: string;
  size: number;
  expires: string;
  success: boolean;
}

export class CloudUploader {
  private services: UploadService[];

  constructor() {
    this.services = [
      {
        name: 'transfer.sh',
        upload: this.uploadToTransferSh.bind(this),
        maxSize: 10 * 1024 * 1024 * 1024, // 10GB
        expires: '14 days'
      },
      {
        name: 'file.io',
        upload: this.uploadToFileIo.bind(this),
        maxSize: 100 * 1024 * 1024, // 100MB
        expires: '1 day'
      }
    ];
  }
  
  async uploadFile(filePath: string): Promise<UploadResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found');
    }
    
    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    
    console.log(`Uploading ${fileName} (${(stats.size / 1024 / 1024).toFixed(2)}MB) to cloud storage...`);
    
    // Try each service until one works
    for (const service of this.services) {
      if (stats.size <= service.maxSize) {
        try {
          console.log(`Trying ${service.name}...`);
          const result = await service.upload(filePath);
          
          return {
            service: service.name,
            url: result.url,
            fileName: fileName,
            size: stats.size,
            expires: service.expires,
            success: true
          };
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`${service.name} failed:`, errorMessage);
          continue;
        }
      }
    }
    
    throw new Error('All upload services failed or file too large');
  }
  
  private async uploadToTransferSh(filePath: string): Promise<{ url: string }> {
    try {
      const fileName = path.basename(filePath);
      const command = `curl -T "${filePath}" "https://transfer.sh/${fileName}"`;
      
      const result = execSync(command, { 
        encoding: 'utf8',
        timeout: 30000 // 30 seconds timeout
      });
      
      const url = result.trim();
      
      if (!url.startsWith('https://transfer.sh/')) {
        throw new Error('Invalid response from transfer.sh');
      }
      
      return { url };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`transfer.sh upload failed: ${errorMessage}`);
    }
  }
  
  private async uploadToFileIo(filePath: string): Promise<{ url: string }> {
    try {
      const command = `curl -F "file=@${filePath}" https://file.io`;
      
      const result = execSync(command, { 
        encoding: 'utf8',
        timeout: 30000 // 30 seconds timeout
      });
      
      const response = JSON.parse(result);
      
      if (!response.success || !response.link) {
        throw new Error('file.io upload failed');
      }
      
      return { url: response.link };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`file.io upload failed: ${errorMessage}`);
    }
  }
  
  formatDownloadMessage(uploadResult: UploadResult): string {
    const sizeText = (uploadResult.size / 1024 / 1024).toFixed(2);
    
    return `🌐 **Direct Download Available**

📁 File: ${uploadResult.fileName}
📊 Size: ${sizeText} MB
☁️ Service: ${uploadResult.service}
⏰ Expires: ${uploadResult.expires}

🔗 **Download Link:**
${uploadResult.url}

💡 **Instructions:**
1. Click the link above
2. Download will start automatically
3. Run the installer as normal

⚠️ Save this link! It will expire in ${uploadResult.expires}.`;
  }
}