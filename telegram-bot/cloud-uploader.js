const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class CloudUploader {
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
    
    async uploadFile(filePath) {
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
                } catch (error) {
                    console.error(`${service.name} failed:`, error.message);
                    continue;
                }
            }
        }
        
        throw new Error('All upload services failed or file too large');
    }
    
    async uploadToTransferSh(filePath) {
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
        } catch (error) {
            throw new Error(`transfer.sh upload failed: ${error.message}`);
        }
    }
    
    async uploadToFileIo(filePath) {
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
        } catch (error) {
            throw new Error(`file.io upload failed: ${error.message}`);
        }
    }
    
    formatDownloadMessage(uploadResult) {
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

module.exports = CloudUploader;