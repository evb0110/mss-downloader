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

export class WorkingUploader {
  private services: UploadService[];

  constructor() {
    this.services = [
      {
        name: 'curl upload',
        upload: this.uploadViaCurl.bind(this),
        maxSize: 500 * 1024 * 1024, // 500MB
        expires: '14 days'
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
  
  private async uploadViaCurl(filePath: string): Promise<{ url: string }> {
    try {
      const fileName = path.basename(filePath);
      
      // Try multiple services with curl
      const services = [
        `https://temp.sh/${fileName}`,
        `https://0x0.st`,
        `https://uguu.se/upload.php`
      ];
      
      for (const serviceUrl of services) {
        try {
          let command: string;
          
          if (serviceUrl.includes('temp.sh')) {
            command = `curl -T "${filePath}" "${serviceUrl}"`;
          } else if (serviceUrl.includes('0x0.st')) {
            command = `curl -F "file=@${filePath}" "${serviceUrl}"`;
          } else if (serviceUrl.includes('uguu.se')) {
            command = `curl -F "files[]=@${filePath}" "${serviceUrl}" | grep -o 'https://[^"]*'`;
          } else {
            continue;
          }
          
          const result = execSync(command, { 
            encoding: 'utf8',
            timeout: 60000 // 1 minute timeout
          });
          
          const url = result.trim();
          
          // Validate URL
          if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
            return { url };
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.log(`Service ${serviceUrl} failed: ${errorMessage}`);
          continue;
        }
      }
      
      throw new Error('All curl upload services failed');
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Curl upload failed: ${errorMessage}`);
    }
  }
  
  formatDownloadMessage(uploadResult: UploadResult): string {
    const sizeText = (uploadResult.size / 1024 / 1024).toFixed(2);
    
    return `☁️ **Cloud Download Available**

📁 File: ${uploadResult.fileName}
📊 Size: ${sizeText} MB
🌐 Service: ${uploadResult.service}
⏰ Expires: ${uploadResult.expires}

🔗 **Direct Download Link:**
${uploadResult.url}

💡 **Instructions:**
1. Click the link above
2. Download will start automatically
3. Run the installer as normal

⚠️ Link expires in ${uploadResult.expires} - download soon!`;
  }
}