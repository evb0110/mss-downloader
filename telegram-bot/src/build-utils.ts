import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Platform, BuildInfo, BuildsData } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SingleBuildResult {
  version: string;
  buildFile: string | null;
  buildFileName: string | null;
  size: string | null;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  version?: string;
  filename?: string;
}

export class BuildUtils {
  static findLatestBuilds(targetVersion?: string): BuildsData {
    try {
      const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const preferredVersion = targetVersion || packageJson.version;
      
      const releasePath = path.join(__dirname, '..', '..', 'release');
      const builds: Partial<Record<Platform, BuildInfo>> = {};
      
      if (!fs.existsSync(releasePath)) {
        return { version: preferredVersion, builds };
      }
      
      const files = fs.readdirSync(releasePath);
      
      // First, try to find builds for the preferred version
      let actualVersion = preferredVersion;
      let foundBuilds = this.findBuildsForVersion(files, releasePath, preferredVersion);
      
      // If no builds found for preferred version, find the latest available version
      if (Object.keys(foundBuilds).length === 0) {
        const availableVersions = this.extractAvailableVersions(files);
        if (availableVersions.length > 0) {
          actualVersion = availableVersions[0]; // Already sorted by latest first
          foundBuilds = this.findBuildsForVersion(files, releasePath, actualVersion);
        }
      }
      
      return { version: actualVersion, builds: foundBuilds };
      
    } catch (error) {
      console.error('Error finding builds:', error);
      return { version: 'unknown', builds: {} };
    }
  }
  
  private static extractAvailableVersions(files: string[]): string[] {
    const versionSet = new Set<string>();
    
    files.forEach(file => {
      const versionMatch = file.match(/(\d+\.\d+\.\d+)/);
      if (versionMatch) {
        versionSet.add(versionMatch[1]);
      }
    });
    
    return Array.from(versionSet).sort((a, b) => {
      const aVersion = a.split('.').map(n => parseInt(n));
      const bVersion = b.split('.').map(n => parseInt(n));
      
      for (let i = 0; i < 3; i++) {
        if (aVersion[i] !== bVersion[i]) {
          return bVersion[i] - aVersion[i]; // Sort descending (latest first)
        }
      }
      return 0;
    });
  }
  
  private static findBuildsForVersion(files: string[], releasePath: string, version: string): Partial<Record<Platform, BuildInfo>> {
    const builds: Partial<Record<Platform, BuildInfo>> = {};
      
    // Find Windows AMD64 build
    const amd64Candidates = files.filter(file => 
      file.includes('Setup') && 
      file.includes('x64') && 
      file.endsWith('.exe') && 
      !file.endsWith('.blockmap')
    );
    
    const amd64Build = amd64Candidates.find(file => file.includes(version));
    
    if (amd64Build) {
      const fullPath = path.join(releasePath, amd64Build);
      if (fs.existsSync(fullPath)) {
        builds.amd64 = {
          file: fullPath,
          name: amd64Build,
          size: parseFloat((fs.statSync(fullPath).size / (1024 * 1024)).toFixed(2))
        };
      }
    }
    
    // Find Windows ARM64 build
    const arm64Candidates = files.filter(file => 
      file.includes('Setup') && 
      file.includes('arm64') && 
      file.endsWith('.exe') && 
      !file.endsWith('.blockmap')
    );
    
    const arm64Build = arm64Candidates.find(file => file.includes(version));
    
    if (arm64Build) {
      const fullPath = path.join(releasePath, arm64Build);
      if (fs.existsSync(fullPath)) {
        builds.arm64 = {
          file: fullPath,
          name: arm64Build,
          size: parseFloat((fs.statSync(fullPath).size / (1024 * 1024)).toFixed(2))
        };
      }
    }
    
    // Find Linux build
    const linuxCandidates = files.filter(file => 
      file.endsWith('.AppImage')
    );
    
    const linuxBuild = linuxCandidates.find(file => file.includes(version));
    
    if (linuxBuild) {
      const fullPath = path.join(releasePath, linuxBuild);
      if (fs.existsSync(fullPath)) {
        builds.linux = {
          file: fullPath,
          name: linuxBuild,
          size: parseFloat((fs.statSync(fullPath).size / (1024 * 1024)).toFixed(2))
        };
      }
    }
    
    // Find Mac build
    const macCandidates = files.filter(file => 
      file.endsWith('.dmg') || file.endsWith('.pkg')
    );
    
    const macBuild = macCandidates.find(file => file.includes(version));
    
    if (macBuild) {
      const fullPath = path.join(releasePath, macBuild);
      if (fs.existsSync(fullPath)) {
        builds.mac = {
          file: fullPath,
          name: macBuild,
          size: parseFloat((fs.statSync(fullPath).size / (1024 * 1024)).toFixed(2))
        };
      }
    }
    
    return builds;
  }
  
  static findSinglePlatformBuild(platform: Platform = 'amd64', targetVersion?: string): SingleBuildResult {
    const { version, builds } = this.findLatestBuilds(targetVersion);
    
    if (builds[platform]) {
      return {
        version,
        buildFile: builds[platform].file,
        buildFileName: builds[platform].name,
        size: builds[platform].size.toString()
      };
    }
    
    console.log(`⚠️ No ${platform} build found for version ${version}, looking for latest available...`);
    
    try {
      const releasePath = path.join(__dirname, '..', '..', 'release');
      if (!fs.existsSync(releasePath)) {
        return { version, buildFile: null, buildFileName: null, size: null };
      }
      
      const files = fs.readdirSync(releasePath);
      let candidates: string[] = [];
      
      if (platform === 'amd64') {
        candidates = files.filter(file => 
          file.includes('Setup') && 
          file.includes('x64') && 
          file.endsWith('.exe') && 
          !file.endsWith('.blockmap')
        );
      } else if (platform === 'arm64') {
        candidates = files.filter(file => 
          file.includes('Setup') && 
          file.includes('arm64') && 
          file.endsWith('.exe') && 
          !file.endsWith('.blockmap')
        );
      } else if (platform === 'linux') {
        candidates = files.filter(file => 
          file.endsWith('.AppImage')
        );
      } else if (platform === 'mac') {
        candidates = files.filter(file => 
          file.endsWith('.dmg') || file.endsWith('.pkg')
        );
      }
      
      if (candidates.length > 0) {
        const versionedFiles = candidates
          .map(f => {
            const versionMatch = f.match(/(\d+\.\d+\.\d+)/);
            if (versionMatch) {
              return { file: f, version: versionMatch[1] };
            }
            return null;
          })
          .filter((f): f is { file: string; version: string } => f !== null)
          .sort((a, b) => {
            const aVersion = a.version.split('.').map(n => parseInt(n));
            const bVersion = b.version.split('.').map(n => parseInt(n));
            
            for (let i = 0; i < 3; i++) {
              if (aVersion[i] !== bVersion[i]) {
                return bVersion[i] - aVersion[i];
              }
            }
            return 0;
          });
        
        if (versionedFiles.length > 0) {
          const latestFile = versionedFiles[0].file;
          const latestVersion = versionedFiles[0].version;
          const fullPath = path.join(releasePath, latestFile);
          
          console.log(`📦 Found latest ${platform} build: ${latestFile} (v${latestVersion})`);
          
          return {
            version: latestVersion,
            buildFile: fullPath,
            buildFileName: latestFile,
            size: (fs.statSync(fullPath).size / (1024 * 1024)).toFixed(2)
          };
        }
      }
      
      return { version, buildFile: null, buildFileName: null, size: null };
      
    } catch (error) {
      console.error('Error in fallback build search:', error);
      return { version, buildFile: null, buildFileName: null, size: null };
    }
  }
  
  static validateDownloadUrl(url: string): ValidationResult {
    const urlMatch = url.match(/\/releases\/download\/v(\d+\.\d+\.\d+)\/(.+)$/);
    if (!urlMatch) {
      return { valid: false, reason: 'Invalid GitHub release URL format' };
    }
    
    const urlVersion = urlMatch[1];
    const urlFilename = urlMatch[2];
    
    if (!urlFilename.includes(urlVersion)) {
      return { 
        valid: false, 
        reason: `Version mismatch: URL version ${urlVersion} not found in filename ${urlFilename}` 
      };
    }
    
    return { valid: true, version: urlVersion, filename: urlFilename };
  }
}