const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DownloadStubCreator {
    constructor() {
        this.tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }
    
    async createDownloadStub(installerFilePath, cloudUrl) {
        const fileName = path.basename(installerFilePath);
        const version = this.extractVersion(fileName);
        const stubPath = path.join(this.tempDir, `MSS-Downloader-${version}-Installer.exe`);
        
        // Create a PowerShell script that downloads and runs the installer
        const powershellScript = this.createDownloadScript(cloudUrl, fileName);
        const scriptPath = path.join(this.tempDir, 'download_and_install.ps1');
        fs.writeFileSync(scriptPath, powershellScript);
        
        // Create a batch file that runs the PowerShell script
        const batchContent = `@echo off
title MSS Downloader Installer
echo MSS Downloader Installer v${version}
echo =======================================
echo.
echo Downloading installer from secure cloud storage...
echo This may take a moment depending on your internet connection.
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0download_and_install.ps1"
pause`;
        
        const batchPath = path.join(this.tempDir, 'installer.bat');
        fs.writeFileSync(batchPath, batchContent);
        
        // Convert batch to EXE using a simple method
        const exeStub = await this.createExeFromBatch(batchPath, scriptPath, stubPath, version);
        
        return {
            stubPath: exeStub,
            stubName: path.basename(exeStub),
            stubSize: fs.statSync(exeStub).size,
            version: version
        };
    }
    
    createDownloadScript(cloudUrl, fileName) {
        return `# MSS Downloader Installation Script
Write-Host "MSS Downloader Installer" -ForegroundColor Green
Write-Host "=========================" -ForegroundColor Green
Write-Host ""

$url = "${cloudUrl}"
$outputPath = "$env:TEMP\\${fileName}"

try {
    Write-Host "Downloading installer..." -ForegroundColor Yellow
    
    # Download with progress bar
    $progressPreference = 'Continue'
    Invoke-WebRequest -Uri $url -OutFile $outputPath -UseBasicParsing
    
    Write-Host "Download completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Starting installer..." -ForegroundColor Yellow
    
    # Run the installer
    Start-Process -FilePath $outputPath -Wait
    
    Write-Host ""
    Write-Host "Installation completed!" -ForegroundColor Green
    
    # Clean up
    Remove-Item $outputPath -Force -ErrorAction SilentlyContinue
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please try downloading manually from:" -ForegroundColor Yellow
    Write-Host $url
    Write-Host ""
    Write-Host "Press any key to open the download link in your browser..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    Start-Process $url
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")`;
    }
    
    async createExeFromBatch(batchPath, scriptPath, outputPath, version) {
        // Create a simple SFX that extracts and runs the batch file
        const archivePath = path.join(this.tempDir, 'stub_archive.7z');
        
        // Create archive with both files
        execSync(`7z a "${archivePath}" "${batchPath}" "${scriptPath}"`);
        
        // Create SFX configuration
        const sfxConfig = `;!@Install@!UTF-8!
Title="MSS Downloader v${version} Installer"
BeginPrompt="Download and install MSS Downloader v${version}?"
Progress="yes"
ExtractDialogText="Preparing installer..."
ExtractTitle="MSS Downloader Setup"
GUIMode="1"
InstallPath="%%T\\\\MSS-Setup-${version}"
OverwriteMode="0"
ExecuteFile="%%T\\\\MSS-Setup-${version}\\\\installer.bat"
ExecuteParameters=""
;!@InstallEnd@!`;
        
        const configPath = path.join(this.tempDir, 'sfx_config.txt');
        fs.writeFileSync(configPath, sfxConfig);
        
        try {
            // Create SFX with config
            execSync(`7z a -t7z -sfx"${configPath}" "${outputPath}" "${batchPath}" "${scriptPath}"`);
        } catch (error) {
            // Fallback: create simple SFX without config
            execSync(`7z a -t7z -sfx "${outputPath}" "${batchPath}" "${scriptPath}"`);
        }
        
        // Cleanup
        [archivePath, configPath].forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
        
        return outputPath;
    }
    
    extractVersion(fileName) {
        const match = fileName.match(/(\d+\.\d+\.\d+)/);
        return match ? match[1] : '1.0.0';
    }
    
    cleanup() {
        if (fs.existsSync(this.tempDir)) {
            const files = fs.readdirSync(this.tempDir);
            files.forEach(file => {
                const filePath = path.join(this.tempDir, file);
                try {
                    fs.unlinkSync(filePath);
                } catch (error) {
                    console.error(`Error deleting temp file ${file}:`, error);
                }
            });
        }
    }
}

module.exports = DownloadStubCreator;