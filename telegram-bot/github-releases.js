const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class GitHubReleasesManager {
    constructor() {
        this.repoOwner = null;
        this.repoName = null;
        this.maxReleases = 2; // Keep only 2 releases for AMD64
        this.initializeRepo();
    }
    
    initializeRepo() {
        try {
            // Get remote origin URL to extract owner/repo
            const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
            
            // Parse GitHub URL (both HTTPS and SSH formats)
            let match = remoteUrl.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
            if (match) {
                this.repoOwner = match[1];
                this.repoName = match[2];
                console.log(`GitHub repo detected: ${this.repoOwner}/${this.repoName}`);
            } else {
                throw new Error('Could not parse GitHub repository from remote URL');
            }
        } catch (error) {
            console.error('Error detecting GitHub repository:', error.message);
            throw new Error('GitHub repository not detected. Ensure you are in a git repository with GitHub remote.');
        }
    }
    
    // Convert filename to GitHub's sanitized format
    sanitizeFilenameForGitHub(fileName) {
        // GitHub converts filenames by:
        // 1. Replacing spaces with dots
        // 2. Extracting content from parentheses and adding with dots
        // 3. Removing parentheses themselves
        
        let sanitized = fileName;
        
        // Extract content from parentheses and replace with dots
        sanitized = sanitized.replace(/\s*\(([^)]+)\)\s*/g, '.$1.');
        
        // Replace remaining spaces with dots
        sanitized = sanitized.replace(/\s+/g, '.');
        
        // Remove double dots
        sanitized = sanitized.replace(/\.+/g, '.');
        
        return sanitized;
    }

    async createRelease(version, buildFile, releaseNotes = '') {
        if (!fs.existsSync(buildFile)) {
            throw new Error(`Build file not found: ${buildFile}`);
        }
        
        const fileName = path.basename(buildFile);
        const tagName = `v${version}`;
        const releaseName = `MSS Downloader v${version} (Windows AMD64)`;
        
        try {
            // Clean up old releases first
            await this.cleanupOldReleases();
            
            // Create the release
            console.log(`Creating GitHub release ${tagName}...`);
            const createCommand = `gh release create "${tagName}" --title "${releaseName}" --notes "${releaseNotes || `Release v${version} for Windows AMD64`}"`;
            execSync(createCommand, { stdio: 'inherit' });
            
            // Upload the build file
            console.log(`Uploading ${fileName}...`);
            const uploadCommand = `gh release upload "${tagName}" "${buildFile}"`;
            execSync(uploadCommand, { stdio: 'inherit' });
            
            // Get the download URL using GitHub's sanitized filename format
            const sanitizedFileName = this.sanitizeFilenameForGitHub(fileName);
            const downloadUrl = `https://github.com/${this.repoOwner}/${this.repoName}/releases/download/${tagName}/${sanitizedFileName}`;
            
            console.log(`✅ Release created successfully!`);
            console.log(`📥 Original filename: ${fileName}`);
            console.log(`📥 GitHub filename: ${sanitizedFileName}`);
            console.log(`📥 Download URL: ${downloadUrl}`);
            
            return {
                tagName,
                downloadUrl,
                fileName: sanitizedFileName, // Use sanitized filename
                version
            };
            
        } catch (error) {
            throw new Error(`Failed to create GitHub release: ${error.message}`);
        }
    }
    
    async cleanupOldReleases() {
        try {
            // Get all releases
            const releasesJson = execSync('gh release list --json tagName,createdAt', { encoding: 'utf8' });
            const releases = JSON.parse(releasesJson);
            
            // Sort by creation date (newest first)
            releases.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            // Delete releases beyond the limit
            if (releases.length >= this.maxReleases) {
                const releasesToDelete = releases.slice(this.maxReleases - 1); // Keep maxReleases-1, delete the rest
                
                for (const release of releasesToDelete) {
                    try {
                        console.log(`Deleting old release: ${release.tagName}`);
                        execSync(`gh release delete "${release.tagName}" --yes`, { stdio: 'inherit' });
                    } catch (error) {
                        console.error(`Failed to delete release ${release.tagName}:`, error.message);
                    }
                }
            }
        } catch (error) {
            console.error('Error during cleanup:', error.message);
            // Don't throw - cleanup failure shouldn't prevent new release creation
        }
    }
    
    async getLatestRelease() {
        try {
            const releasesJson = execSync('gh release list --limit 1 --json tagName,assets,publishedAt', { encoding: 'utf8' });
            const releases = JSON.parse(releasesJson);
            
            if (releases.length === 0) {
                return null;
            }
            
            const release = releases[0];
            const amdAsset = release.assets.find(asset => 
                asset.name.includes('x64') || asset.name.includes('amd64') || asset.name.includes('Setup')
            );
            
            if (!amdAsset) {
                return null;
            }
            
            return {
                tagName: release.tagName,
                downloadUrl: amdAsset.browser_download_url,
                fileName: amdAsset.name,
                size: amdAsset.size,
                publishedAt: release.publishedAt
            };
        } catch (error) {
            console.error('Error getting latest release:', error.message);
            return null;
        }
    }
    
    formatReleaseMessage(releaseInfo) {
        const sizeText = (releaseInfo.size / 1024 / 1024).toFixed(2);
        const publishedDate = new Date(releaseInfo.publishedAt).toLocaleDateString();
        
        return `🚀 **GitHub Release Available**

📦 Version: ${releaseInfo.tagName}
📁 File: ${releaseInfo.fileName}
📊 Size: ${sizeText} MB
📅 Published: ${publishedDate}

🔗 **Direct Download:**
${releaseInfo.downloadUrl}

💡 **Instructions:**
1. Click the link above
2. Download will start automatically
3. Run the installer as normal

✅ **Permanent Link** - No expiration!`;
    }
    
    async uploadBuild(version, buildFile, releaseNotes = '') {
        try {
            const releaseInfo = await this.createRelease(version, buildFile, releaseNotes);
            
            return {
                type: 'github_release',
                downloadUrl: releaseInfo.downloadUrl,
                fileName: releaseInfo.fileName,
                version: releaseInfo.version,
                tagName: releaseInfo.tagName,
                instructions: this.formatReleaseMessage(releaseInfo)
            };
        } catch (error) {
            throw new Error(`GitHub release upload failed: ${error.message}`);
        }
    }
}

module.exports = GitHubReleasesManager;