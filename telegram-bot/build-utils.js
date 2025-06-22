const fs = require('fs');
const path = require('path');

class BuildUtils {
    static findLatestBuilds(targetVersion = null) {
        try {
            const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
            const currentVersion = targetVersion || packageJson.version;
            
            const releasePath = path.join(__dirname, '..', 'release');
            const builds = {};
            
            if (!fs.existsSync(releasePath)) {
                return { version: currentVersion, builds: {} };
            }
            
            const files = fs.readdirSync(releasePath);
            
            // Find Windows AMD64 build (prefer exact version match)
            const amd64Candidates = files.filter(file => 
                file.includes('Setup') && 
                file.includes('x64') && 
                file.endsWith('.exe') && 
                !file.endsWith('.blockmap')
            );
            
            // Find exact version match first
            let amd64Build = amd64Candidates.find(file => file.includes(currentVersion));
            
            if (amd64Build) {
                const fullPath = path.join(releasePath, amd64Build);
                if (fs.existsSync(fullPath)) {
                    builds.amd64 = {
                        file: fullPath,
                        name: amd64Build,
                        size: (fs.statSync(fullPath).size / (1024 * 1024)).toFixed(2),
                        version: currentVersion
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
            
            let arm64Build = arm64Candidates.find(file => file.includes(currentVersion));
            
            if (arm64Build) {
                const fullPath = path.join(releasePath, arm64Build);
                if (fs.existsSync(fullPath)) {
                    builds.arm64 = {
                        file: fullPath,
                        name: arm64Build,
                        size: (fs.statSync(fullPath).size / (1024 * 1024)).toFixed(2),
                        version: currentVersion
                    };
                }
            }
            
            // Find Linux build
            const linuxCandidates = files.filter(file => 
                file.endsWith('.AppImage')
            );
            
            let linuxBuild = linuxCandidates.find(file => file.includes(currentVersion));
            
            if (linuxBuild) {
                const fullPath = path.join(releasePath, linuxBuild);
                if (fs.existsSync(fullPath)) {
                    builds.linux = {
                        file: fullPath,
                        name: linuxBuild,
                        size: (fs.statSync(fullPath).size / (1024 * 1024)).toFixed(2),
                        version: currentVersion
                    };
                }
            }
            
            // Find macOS build
            const macCandidates = files.filter(file => 
                file.endsWith('.dmg') && !file.endsWith('.blockmap')
            );
            
            let macBuild = macCandidates.find(file => file.includes(currentVersion));
            
            if (macBuild) {
                const fullPath = path.join(releasePath, macBuild);
                if (fs.existsSync(fullPath)) {
                    builds.mac = {
                        file: fullPath,
                        name: macBuild,
                        size: (fs.statSync(fullPath).size / (1024 * 1024)).toFixed(2),
                        version: currentVersion
                    };
                }
            }
            
            return { version: currentVersion, builds };
            
        } catch (error) {
            console.error('Error finding builds:', error);
            return { version: 'unknown', builds: {} };
        }
    }
    
    static findSinglePlatformBuild(platform = 'amd64', targetVersion = null) {
        const { version, builds } = this.findLatestBuilds(targetVersion);
        
        if (builds[platform]) {
            return {
                version,
                buildFile: builds[platform].file,
                buildFileName: builds[platform].name,
                size: builds[platform].size
            };
        }
        
        // Fallback to old logic only if exact version not found
        console.log(`⚠️ No ${platform} build found for version ${version}, looking for latest available...`);
        
        try {
            const releasePath = path.join(__dirname, '..', 'release');
            if (!fs.existsSync(releasePath)) {
                return { version, buildFile: null, buildFileName: null, size: null };
            }
            
            const files = fs.readdirSync(releasePath);
            let candidates = [];
            
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
                    file.endsWith('.dmg') && !file.endsWith('.blockmap')
                );
            }
            
            if (candidates.length > 0) {
                // Sort by version number (extract version and compare)
                const versionedFiles = candidates
                    .map(f => {
                        const versionMatch = f.match(/(\d+\.\d+\.\d+)/);
                        if (versionMatch) {
                            return { file: f, version: versionMatch[1] };
                        }
                        return null;
                    })
                    .filter(f => f !== null)
                    .sort((a, b) => {
                        const aVersion = a.version.split('.').map(n => parseInt(n));
                        const bVersion = b.version.split('.').map(n => parseInt(n));
                        
                        for (let i = 0; i < 3; i++) {
                            if (aVersion[i] !== bVersion[i]) {
                                return bVersion[i] - aVersion[i]; // Descending order
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
    
    static validateDownloadUrl(url) {
        // Extract version and filename from URL to validate they match
        const urlMatch = url.match(/\/releases\/download\/v(\d+\.\d+\.\d+)\/(.+)$/);
        if (!urlMatch) {
            return { valid: false, reason: 'Invalid GitHub release URL format' };
        }
        
        const urlVersion = urlMatch[1];
        const urlFilename = urlMatch[2];
        
        // Check if filename contains the same version
        if (!urlFilename.includes(urlVersion)) {
            return { 
                valid: false, 
                reason: `Version mismatch: URL version ${urlVersion} not found in filename ${urlFilename}` 
            };
        }
        
        return { valid: true, version: urlVersion, filename: urlFilename };
    }
}

module.exports = BuildUtils;