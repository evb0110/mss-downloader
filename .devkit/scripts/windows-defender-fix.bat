@echo off
REM Windows Defender Fix for MSS-Downloader v1.4.133
REM Run this script as Administrator

echo ===============================================
echo MSS-Downloader Windows Defender Fix v1.4.133
echo ===============================================
echo.
echo This script will add MSS-Downloader to Windows Defender exclusions
echo to prevent it from being quarantined.
echo.
echo IMPORTANT: You MUST run this as Administrator!
echo.
pause

REM Check for admin rights
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Running with Administrator privileges...
    powershell.exe -ExecutionPolicy Bypass -File "%~dp0windows-defender-fix.ps1"
) else (
    echo.
    echo ERROR: Administrator privileges required!
    echo.
    echo Please right-click this file and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

pause