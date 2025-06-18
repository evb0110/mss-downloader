#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function createSmallBuild() {
    console.log('🔧 Creating optimized small build for Telegram delivery...\n');
    
    // Read current package.json
    const packagePath = './package.json';
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const version = packageJson.version;
    
    console.log(`📦 Version: ${version}`);
    
    // Create backup of original config
    const originalBuild = { ...packageJson.build };
    
    // Optimize build configuration for smallest size
    packageJson.build = {
        ...originalBuild,
        compression: "maximum",
        nsis: {
            ...originalBuild.nsis,
            compression: "lzma",
            compressor: "best"
        },
        win: {
            target: {
                target: "nsis",
                arch: ["x64"]
            },
            icon: "assets/icon.png"
        },
        // Exclude more files to reduce size
        files: [
            "dist/**/*",
            "node_modules/**/*",
            "!node_modules/**/test/**",
            "!node_modules/**/tests/**",
            "!node_modules/**/*.map",
            "!node_modules/**/.*",
            "!node_modules/**/README*",
            "!node_modules/**/LICENSE*",
            "!node_modules/**/CHANGELOG*",
            "!node_modules/**/*.d.ts",
            "!node_modules/**/docs/**",
            "!node_modules/**/example/**",
            "!node_modules/**/examples/**",
            "!node_modules/**/demo/**",
            "!node_modules/**/demos/**",
            "!node_modules/**/samples/**",
            "!node_modules/**/*.md",
            "!node_modules/**/coverage/**",
            "!node_modules/**/.nyc_output/**",
            "!node_modules/**/spec/**",
            "!node_modules/**/specs/**"
        ]
    };
    
    // Write optimized config
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
    
    try {
        console.log('🏗️  Building with optimized configuration...');
        
        // Clean previous builds
        if (fs.existsSync('./dist')) {
            execSync('rm -rf ./dist');
        }
        
        // Build with optimization
        execSync('npm run build', { stdio: 'inherit' });
        execSync('electron-builder --win --x64', { stdio: 'inherit' });
        
        // Find the created file
        const releaseDir = './release';
        const files = fs.readdirSync(releaseDir);
        const setupFile = files.find(f => f.includes(`Setup ${version}-x64.exe`));
        
        if (setupFile) {
            const filePath = path.join(releaseDir, setupFile);
            const stats = fs.statSync(filePath);
            const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
            
            console.log(`\n✅ Optimized build created: ${setupFile}`);
            console.log(`📊 Size: ${sizeMB} MB`);
            
            if (stats.size <= 50 * 1024 * 1024) {
                console.log('🎉 File fits in Telegram limit (50MB)!');
            } else {
                console.log('⚠️  File still larger than Telegram limit, but smaller than before');
                
                // Try additional compression
                console.log('\n🗜️  Attempting additional compression...');
                const compressedName = setupFile.replace('.exe', '_compressed.exe');
                const compressedPath = path.join(releaseDir, compressedName);
                
                try {
                    execSync(`7z a -t7z -mx=9 -sfx "${compressedPath}" "${filePath}"`, { stdio: 'pipe' });
                    const compressedStats = fs.statSync(compressedPath);
                    const compressedSizeMB = (compressedStats.size / 1024 / 1024).toFixed(2);
                    
                    console.log(`📦 Compressed version: ${compressedSizeMB} MB`);
                    
                    if (compressedStats.size <= 50 * 1024 * 1024) {
                        console.log('🎉 Compressed version fits in Telegram limit!');
                        console.log(`🚀 Use: ${compressedPath}`);
                    }
                } catch (error) {
                    console.log('❌ Additional compression failed');
                }
            }
        } else {
            console.log('❌ Could not find built setup file');
        }
        
    } finally {
        // Restore original config
        packageJson.build = originalBuild;
        fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
        console.log('\n🔄 Restored original package.json configuration');
    }
}

if (require.main === module) {
    createSmallBuild().catch(console.error);
}

module.exports = { createSmallBuild };