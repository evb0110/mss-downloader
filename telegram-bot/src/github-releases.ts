import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface ReleaseInfo {
  tagName: string;
  downloadUrl: string;
  fileName: string;
  version?: string;
  size?: number;
  publishedAt?: string;
}

interface UploadResult {
  type: 'github_release';
  downloadUrl: string;
  fileName: string;
  version: string;
  tagName: string;
  instructions: string;
}

interface GitHubRelease {
  tagName: string;
  createdAt: string;
  publishedAt?: string;
  assets: GitHubAsset[];
}

interface GitHubAsset {
  name: string;
  size: number;
  browser_download_url?: string;
}

export class GitHubReleasesManager {
  private repoOwner: string | null;
  private repoName: string | null;
  private maxReleases: number;

  constructor() {
    this.repoOwner = null;
    this.repoName = null;
    this.maxReleases = 2; // Keep only 2 releases for AMD64
    this.initializeRepo();
  }
  
  private initializeRepo(): void {
    try {
      // Get remote origin URL to extract owner/repo
      const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
      
      // Parse GitHub URL (both HTTPS and SSH formats)
      const match = remoteUrl.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
      if (match) {
        this.repoOwner = match[1];
        this.repoName = match[2];
        console.log(`GitHub repo detected: ${this.repoOwner}/${this.repoName}`);
      } else {
        throw new Error('Could not parse GitHub repository from remote URL');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error detecting GitHub repository:', errorMessage);
      throw new Error('GitHub repository not detected. Ensure you are in a git repository with GitHub remote.');
    }
  }
  
  // Convert filename to GitHub's sanitized format
  private sanitizeFilenameForGitHub(fileName: string): string {
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

  private async createRelease(version: string, buildFile: string, releaseNotes = ''): Promise<ReleaseInfo> {
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
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create GitHub release: ${errorMessage}`);
    }
  }
  
  private async cleanupOldReleases(): Promise<void> {
    try {
      // Get all releases
      const releasesJson = execSync('gh release list --json tagName,createdAt', { encoding: 'utf8' });
      const releases: GitHubRelease[] = JSON.parse(releasesJson);
      
      // Sort by creation date (newest first)
      releases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Delete releases beyond the limit  
      if (releases.length > this.maxReleases) {
        const releasesToDelete = releases.slice(this.maxReleases); // Keep maxReleases, delete the rest
        
        for (const release of releasesToDelete) {
          try {
            console.log(`Deleting old release: ${release.tagName}`);
            execSync(`gh release delete "${release.tagName}" --yes`, { stdio: 'inherit' });
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Failed to delete release ${release.tagName}:`, errorMessage);
          }
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error during cleanup:', errorMessage);
      // Don't throw - cleanup failure shouldn't prevent new release creation
    }
  }
  
  async getLatestRelease(): Promise<ReleaseInfo | null> {
    try {
      const releasesJson = execSync('gh release list --limit 1 --json tagName,assets,publishedAt', { encoding: 'utf8' });
      const releases: GitHubRelease[] = JSON.parse(releasesJson);
      
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
        downloadUrl: amdAsset.browser_download_url || '',
        fileName: amdAsset.name,
        size: amdAsset.size,
        publishedAt: release.publishedAt
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error getting latest release:', errorMessage);
      return null;
    }
  }
  
  private formatReleaseMessage(releaseInfo: ReleaseInfo): string {
    const sizeText = releaseInfo.size ? (releaseInfo.size / 1024 / 1024).toFixed(2) : 'Unknown';
    const publishedDate = releaseInfo.publishedAt ? new Date(releaseInfo.publishedAt).toLocaleDateString() : 'Unknown';
    
    return `🚀 **GitHub Release Available**

📦 Version: ${releaseInfo.tagName}
📁 File: ${releaseInfo.fileName}
📊 Size: ${sizeText} MB
📅 Published: ${publishedDate}

🔗 **Direct Download:**
${releaseInfo.downloadUrl}

💡 **Installation Instructions:**
1. Click the link above to download
2. Run the installer (digitally signed and safe)
3. Follow the installer prompts

💡 **Note:** The app is digitally signed for security. Windows should install without warnings.

✅ **Permanent Link** - No expiration!`;
  }
  
  async uploadBuild(version: string, buildFile: string, releaseNotes = ''): Promise<UploadResult> {
    try {
      const fileName = path.basename(buildFile);
      
      // First check if the release already exists for this specific file
      const existingRelease = await this.getExistingRelease(version, fileName);
      if (existingRelease) {
        console.log(`✅ Using existing GitHub release: v${version}`);
        console.log(`📥 Download URL: ${existingRelease.downloadUrl}`);
        
        return {
          type: 'github_release',
          downloadUrl: existingRelease.downloadUrl,
          fileName: existingRelease.fileName,
          version: version,
          tagName: `v${version}`,
          instructions: this.formatReleaseMessage(existingRelease)
        };
      }
      
      // If not, create a new release
      const releaseInfo = await this.createRelease(version, buildFile, releaseNotes);
      
      return {
        type: 'github_release',
        downloadUrl: releaseInfo.downloadUrl,
        fileName: releaseInfo.fileName,
        version: releaseInfo.version || version,
        tagName: releaseInfo.tagName,
        instructions: this.formatReleaseMessage(releaseInfo)
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`GitHub release upload failed: ${errorMessage}`);
    }
  }
  
  private async getExistingRelease(version: string, targetFileName: string | null = null): Promise<ReleaseInfo | null> {
    try {
      const tagName = `v${version}`;
      const releaseJson = execSync(`gh release view "${tagName}" --json assets,publishedAt`, { encoding: 'utf8' });
      const release = JSON.parse(releaseJson);
      
      let asset: GitHubAsset | undefined = undefined;
      
      if (targetFileName) {
        // Try to find exact match first
        const targetSanitized = this.sanitizeFilenameForGitHub(targetFileName);
        asset = release.assets.find((a: GitHubAsset) => 
          this.sanitizeFilenameForGitHub(a.name) === targetSanitized
        );
        
        // If no exact match, try platform-specific matching
        if (!asset) {
          if (targetFileName.includes('arm64')) {
            asset = release.assets.find((a: GitHubAsset) => 
              a.name.includes('arm64') && 
              (a.name.endsWith('.exe') || a.name.endsWith('.AppImage'))
            );
          } else if (targetFileName.includes('x64') || targetFileName.includes('Setup')) {
            asset = release.assets.find((a: GitHubAsset) => 
              (a.name.includes('x64') || (a.name.includes('Setup') && !a.name.includes('arm64'))) && 
              a.name.endsWith('.exe')
            );
          } else if (targetFileName.endsWith('.AppImage')) {
            asset = release.assets.find((a: GitHubAsset) => 
              a.name.endsWith('.AppImage')
            );
          }
        }
      } else {
        // Fallback: Find the appropriate asset (prefer x64, then general Setup files)
        asset = release.assets.find((a: GitHubAsset) => 
          (a.name.includes('x64') || a.name.includes('Setup')) && 
          a.name.endsWith('.exe') && 
          !a.name.includes('arm64')
        );
      }
      
      if (asset && this.repoOwner && this.repoName) {
        const sanitizedFileName = this.sanitizeFilenameForGitHub(asset.name);
        const downloadUrl = `https://github.com/${this.repoOwner}/${this.repoName}/releases/download/${tagName}/${sanitizedFileName}`;
        
        return {
          tagName,
          downloadUrl,
          fileName: sanitizedFileName,
          size: asset.size,
          publishedAt: release.publishedAt
        };
      }
      
      return null;
    } catch {
      // Release doesn't exist
      return null;
    }
  }
}