/**
 * Startup Diagnostics for MSS-Downloader
 * v1.4.152 - Shows visible errors instead of silent failures
 */

const { app, dialog, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

class StartupDiagnostics {
  constructor() {
    this.logFile = path.join(app.getPath('userData'), 'startup.log');
    this.errors = [];
    this.startTime = Date.now();
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    
    // Write to file
    try {
      fs.appendFileSync(this.logFile, logMessage);
    } catch (e) {
      // Can't write to log
    }
    
    // Also console
    console.log(logMessage);
    
    // Collect errors
    if (level === 'error') {
      this.errors.push(message);
    }
  }

  async checkRequirements() {
    const checks = [];
    
    // Check if running
    checks.push({
      name: 'Process ID',
      value: process.pid,
      ok: true
    });
    
    // Check Electron version
    checks.push({
      name: 'Electron Version',
      value: process.versions.electron,
      ok: !!process.versions.electron
    });
    
    // Check if userData is accessible
    try {
      const userDataPath = app.getPath('userData');
      fs.accessSync(userDataPath, fs.constants.W_OK);
      checks.push({
        name: 'UserData Access',
        value: userDataPath,
        ok: true
      });
    } catch (e) {
      checks.push({
        name: 'UserData Access',
        value: `FAILED: ${e.message}`,
        ok: false
      });
    }
    
    // Check display
    try {
      const { screen } = require('electron');
      const display = screen.getPrimaryDisplay();
      checks.push({
        name: 'Display',
        value: `${display.size.width}x${display.size.height}`,
        ok: true
      });
    } catch (e) {
      checks.push({
        name: 'Display',
        value: `FAILED: ${e.message}`,
        ok: false
      });
    }
    
    // Check GPU
    const gpuInfo = app.getGPUFeatureStatus();
    checks.push({
      name: 'GPU Status',
      value: gpuInfo.gpu_compositing || 'unknown',
      ok: gpuInfo.gpu_compositing !== 'disabled'
    });
    
    return checks;
  }

  async showDiagnosticWindow() {
    // Create a simple diagnostic window
    const win = new BrowserWindow({
      width: 600,
      height: 500,
      title: 'MSS-Downloader Startup Diagnostics',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    
    const checks = await this.checkRequirements();
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Startup Diagnostics</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      background: #f0f0f0;
    }
    h1 {
      color: #333;
      border-bottom: 2px solid #4CAF50;
      padding-bottom: 10px;
    }
    .check {
      background: white;
      padding: 10px;
      margin: 10px 0;
      border-radius: 5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .check.ok {
      border-left: 5px solid #4CAF50;
    }
    .check.fail {
      border-left: 5px solid #f44336;
    }
    .status {
      font-weight: bold;
    }
    .status.ok {
      color: #4CAF50;
    }
    .status.fail {
      color: #f44336;
    }
    .errors {
      background: #ffebee;
      border: 1px solid #f44336;
      border-radius: 5px;
      padding: 15px;
      margin-top: 20px;
    }
    .errors h2 {
      color: #f44336;
      margin-top: 0;
    }
    button {
      background: #4CAF50;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
      margin-top: 20px;
    }
    button:hover {
      background: #45a049;
    }
  </style>
</head>
<body>
  <h1>MSS-Downloader v1.4.152 - Startup Diagnostics</h1>
  
  <div id="checks">
    ${checks.map(check => `
      <div class="check ${check.ok ? 'ok' : 'fail'}">
        <div>
          <strong>${check.name}:</strong>
          <span>${check.value}</span>
        </div>
        <span class="status ${check.ok ? 'ok' : 'fail'}">
          ${check.ok ? '✓ OK' : '✗ FAIL'}
        </span>
      </div>
    `).join('')}
  </div>
  
  ${this.errors.length > 0 ? `
    <div class="errors">
      <h2>Errors Detected:</h2>
      <ul>
        ${this.errors.map(err => `<li>${err}</li>`).join('')}
      </ul>
    </div>
  ` : ''}
  
  <button onclick="window.close()">Close Diagnostics</button>
  
  <p style="margin-top: 30px; color: #666;">
    Log file: ${this.logFile}<br>
    Startup time: ${Date.now() - this.startTime}ms
  </p>
</body>
</html>`;
    
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    
    return win;
  }

  async showStartupError(error) {
    this.log(`FATAL ERROR: ${error.message || error}`, 'error');
    
    // Show error dialog
    dialog.showErrorBox(
      'MSS-Downloader Startup Failed',
      `The application failed to start properly.

Error: ${error.message || error}

Troubleshooting steps:
1. Run EMERGENCY-FIX-RUN-THIS.bat
2. Disable antivirus temporarily
3. Run as Administrator
4. Check Windows Event Viewer for details

Log file: ${this.logFile}`
    );
    
    // Also show diagnostic window
    await this.showDiagnosticWindow();
  }

  recordStartupPhase(phase) {
    this.log(`Startup phase: ${phase}`);
  }
}

module.exports = StartupDiagnostics;