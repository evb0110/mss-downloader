const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class GitHubReleaseUploader {
    constructor() {
        this.repoOwner = 'evb0110'; // Replace with your GitHub username
        this.repoName = 'mss-downloader'; // Replace with your repo name
    }
    
    async uploadToGitHubRelease(filePath, version) {
        try {
            // Check if gh CLI is available
            try {
                execSync('gh --version', { stdio: 'pipe' });
            } catch (error) {
                throw new Error('GitHub CLI not installed. Install with: brew install gh');
            }
            
            const fileName = path.basename(filePath);
            const stats = fs.statSync(filePath);
            const tagName = `v${version}`;
            const releaseName = `MSS Downloader v${version}`;
            
            console.log(`Creating GitHub release ${tagName}...`);
            
            // Create release (or update if exists)
            try {
                const createCommand = `gh release create "${tagName}" --title "${releaseName}" --notes "MSS Downloader v${version} - Windows AMD64 build" --repo "${this.repoOwner}/${this.repoName}"`;
                execSync(createCommand, { stdio: 'pipe' });
                console.log(`Release ${tagName} created`);
            } catch (error) {
                // Release might already exist, try to update it
                console.log(`Release ${tagName} might already exist, uploading file...`);
            }
            
            // Upload file to release
            const uploadCommand = `gh release upload "${tagName}" "${filePath}" --clobber --repo "${this.repoOwner}/${this.repoName}"`;
            execSync(uploadCommand, { stdio: 'pipe' });
            
            // Get download URL
            const urlCommand = `gh release view "${tagName}" --json assets --jq '.assets[] | select(.name=="${fileName}") | .url' --repo "${this.repoOwner}/${this.repoName}"`;
            const downloadUrl = execSync(urlCommand, { encoding: 'utf8' }).trim();
            
            console.log(`File uploaded successfully to GitHub Releases`);
            
            return {
                success: true,
                service: 'GitHub Releases',
                url: downloadUrl,
                fileName: fileName,
                size: stats.size,
                expires: 'permanent',
                tagName: tagName
            };
            
        } catch (error) {
            throw new Error(`GitHub release upload failed: ${error.message}`);
        }
    }
    
    formatDownloadMessage(uploadResult) {
        const sizeText = (uploadResult.size / 1024 / 1024).toFixed(2);
        
        return `🐙 **GitHub Releases Download**

📁 File: ${uploadResult.fileName}
📊 Size: ${sizeText} MB
☁️ Service: ${uploadResult.service}
🏷️ Release: ${uploadResult.tagName}
⏰ Expires: ${uploadResult.expires}

🔗 **Download Link:**
${uploadResult.url}

💡 **Instructions:**
1. Click the link above
2. Download will start automatically
3. Run the installer as normal

✅ **Permanent link** - Save for later use!`;
    }
}

module.exports = GitHubReleaseUploader;