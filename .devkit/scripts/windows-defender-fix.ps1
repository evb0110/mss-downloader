# Windows Defender Exclusion Fix for MSS-Downloader
# Run as Administrator in PowerShell
# v1.4.133 Critical Fix

Write-Host "MSS-Downloader Windows Defender Fix v1.4.133" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator"))
{
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Adding Windows Defender exclusions..." -ForegroundColor Green

# Get the current directory where script is run from
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectPath = Split-Path -Parent (Split-Path -Parent $scriptPath)

# Common installation paths
$paths = @(
    $projectPath,
    "$env:LOCALAPPDATA\Programs\mss-downloader",
    "$env:PROGRAMFILES\mss-downloader",
    "${env:PROGRAMFILES(x86)}\mss-downloader",
    "$env:USERPROFILE\Desktop\mss-downloader",
    "$env:USERPROFILE\Downloads\mss-downloader"
)

# Processes to exclude (MUST BE ADDED ONE BY ONE)
$processes = @(
    "electron.exe",
    "mss-downloader.exe",
    "MSS-Downloader.exe",
    "node.exe"
)

$successCount = 0
$errorCount = 0

# Add path exclusions
Write-Host "`nAdding path exclusions:" -ForegroundColor Yellow
foreach ($path in $paths) {
    if (Test-Path $path) {
        try {
            Add-MpPreference -ExclusionPath $path -ErrorAction SilentlyContinue
            Write-Host "  ✓ Added: $path" -ForegroundColor Green
            $successCount++
        } catch {
            Write-Host "  ⚠ Already exists or failed: $path" -ForegroundColor Gray
        }
    }
}

# Add process exclusions - ONE AT A TIME (THIS IS THE FIX!)
Write-Host "`nAdding process exclusions:" -ForegroundColor Yellow
foreach ($process in $processes) {
    try {
        # CRITICAL: Each process MUST be added separately
        Add-MpPreference -ExclusionProcess $process -ErrorAction Stop
        Write-Host "  ✓ Added: $process" -ForegroundColor Green
        $successCount++
    } catch {
        if ($_.Exception.Message -like "*already exists*" -or $_.Exception.Message -like "*ParameterAlreadyBound*") {
            Write-Host "  ⚠ Already excluded: $process" -ForegroundColor Gray
        } else {
            Write-Host "  ✗ Failed: $process - $_" -ForegroundColor Red
            $errorCount++
        }
    }
}

# Add file extensions
Write-Host "`nAdding file extension exclusions:" -ForegroundColor Yellow
$extensions = @(".asar", ".node")
foreach ($ext in $extensions) {
    try {
        Add-MpPreference -ExclusionExtension $ext -ErrorAction SilentlyContinue
        Write-Host "  ✓ Added: $ext files" -ForegroundColor Green
        $successCount++
    } catch {
        Write-Host "  ⚠ Already exists: $ext" -ForegroundColor Gray
    }
}

# Verify exclusions
Write-Host "`n=======================================" -ForegroundColor Cyan
Write-Host "Verification:" -ForegroundColor Yellow
$prefs = Get-MpPreference
$excludedProcesses = $prefs.ExclusionProcess
$excludedPaths = $prefs.ExclusionPath

Write-Host "`nExcluded Processes:" -ForegroundColor Cyan
if ($excludedProcesses) {
    $excludedProcesses | ForEach-Object { Write-Host "  • $_" -ForegroundColor Green }
} else {
    Write-Host "  None" -ForegroundColor Red
}

Write-Host "`nExcluded Paths (showing MSS-related):" -ForegroundColor Cyan
if ($excludedPaths) {
    $excludedPaths | Where-Object { $_ -like "*mss*" -or $_ -like "*electron*" } | ForEach-Object { Write-Host "  • $_" -ForegroundColor Green }
}

# Summary
Write-Host "`n=======================================" -ForegroundColor Cyan
if ($errorCount -eq 0) {
    Write-Host "SUCCESS: All exclusions added successfully!" -ForegroundColor Green
    Write-Host "MSS-Downloader should now run without Windows Defender interference." -ForegroundColor Green
} else {
    Write-Host "PARTIAL SUCCESS: Some exclusions added, but $errorCount failed." -ForegroundColor Yellow
    Write-Host "The application should still work." -ForegroundColor Yellow
}

Write-Host "`nIMPORTANT: If the app was quarantined:" -ForegroundColor Yellow
Write-Host "1. Open Windows Security" -ForegroundColor White
Write-Host "2. Go to 'Protection history'" -ForegroundColor White
Write-Host "3. Find MSS-Downloader entries" -ForegroundColor White
Write-Host "4. Click 'Actions' → 'Restore'" -ForegroundColor White

Write-Host "`nPress Enter to exit..." -ForegroundColor Cyan
Read-Host