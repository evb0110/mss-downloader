const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function createMinimalInstaller() {
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Create a simple Node.js script that downloads and runs the installer
    const downloaderScript = `const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

console.log('MSS Downloader Installer');
console.log('========================');
console.log('');

const DOWNLOAD_URL = process.argv[2] || 'PLACEHOLDER_URL';
const tempDir = os.tmpdir();
const installerPath = path.join(tempDir, 'MSS-Downloader-Setup.exe');

console.log('Downloading MSS Downloader installer...');
console.log('This may take a moment (87MB download)');
console.log('');

const file = fs.createWriteStream(installerPath);
let downloadedBytes = 0;
let totalBytes = 0;

https.get(DOWNLOAD_URL, (response) => {
    totalBytes = parseInt(response.headers['content-length'], 10);
    
    response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
        const downloaded = (downloadedBytes / 1024 / 1024).toFixed(1);
        const total = (totalBytes / 1024 / 1024).toFixed(1);
        
        process.stdout.write(\`\\rProgress: \${percent}% (\${downloaded}MB / \${total}MB)\`);
    });
    
    response.pipe(file);
    
    file.on('finish', () => {
        console.log('\\n\\nDownload completed!');
        console.log('Starting installer...');
        
        try {
            execSync(\`"\${installerPath}"\`, { stdio: 'inherit' });
            console.log('\\nInstallation completed!');
            
            // Clean up
            fs.unlinkSync(installerPath);
        } catch (error) {
            console.error('Error running installer:', error.message);
            console.log('\\nInstaller downloaded to:', installerPath);
            console.log('Please run it manually.');
        }
    });
    
}).on('error', (error) => {
    console.error('\\nDownload failed:', error.message);
    console.log('\\nPlease download manually from:');
    console.log(DOWNLOAD_URL);
    process.exit(1);
});`;
    
    const scriptPath = path.join(tempDir, 'installer.js');
    fs.writeFileSync(scriptPath, downloaderScript);
    
    // Create package.json for the installer
    const packageJson = {
        name: "mss-downloader-installer",
        version: "1.0.0",
        description: "MSS Downloader Installer",
        main: "installer.js",
        bin: {
            "mss-installer": "./installer.js"
        },
        engines: {
            node: ">=14.0.0"
        },
        pkg: {
            targets: ["node18-win-x64"],
            outputPath: "../"
        }
    };
    
    const packagePath = path.join(tempDir, 'package.json');
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
    
    // Try to create executable with pkg
    const outputPath = path.join(__dirname, 'MSS-Downloader-Installer.exe');
    
    try {
        console.log('Creating standalone executable...');
        execSync(`npx pkg ${scriptPath} --target node18-win-x64 --output "${outputPath}"`, {
            stdio: 'inherit',
            cwd: tempDir
        });
        
        const stats = fs.statSync(outputPath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        
        console.log(`\\n✅ Minimal installer created: ${sizeMB}MB`);
        console.log(`📁 Location: ${outputPath}`);
        
        return {
            success: true,
            path: outputPath,
            size: stats.size,
            sizeMB: sizeMB
        };
        
    } catch (error) {
        console.error('Failed to create executable:', error.message);
        
        // Fallback: create a batch file that runs Node.js
        const batchContent = `@echo off
echo MSS Downloader Installer
echo ========================
echo.
echo Checking for Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js is required but not installed.
    echo Please install Node.js from https://nodejs.org
    echo Then run this installer again.
    pause
    exit /b 1
)

echo Starting installer...
node "%~dp0installer.js" %1
pause`;
        
        const batchPath = path.join(__dirname, 'MSS-Downloader-Installer.bat');
        fs.writeFileSync(batchPath, batchContent);
        
        // Copy the script to the main directory
        const mainScriptPath = path.join(__dirname, 'installer.js');
        fs.copyFileSync(scriptPath, mainScriptPath);
        
        console.log('\\n⚠️  Created batch file installer instead');
        console.log(`📁 Location: ${batchPath}`);
        
        return {
            success: true,
            path: batchPath,
            size: fs.statSync(batchPath).size,
            sizeMB: '< 0.1',
            type: 'batch'
        };
    }
}

if (require.main === module) {
    createMinimalInstaller().catch(console.error);
}

module.exports = { createMinimalInstaller };