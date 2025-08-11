/**
 * Process Manager for MSS-Downloader
 * v1.4.151 - Handles zombie processes and ensures clean startup
 */

const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class ProcessManager {
  constructor() {
    this.lockFile = path.join(app.getPath('userData'), 'app.lock');
    this.pidFile = path.join(app.getPath('userData'), 'app.pid');
    this.isWindows = process.platform === 'win32';
  }

  /**
   * Check if previous instance is actually running
   */
  isPreviousInstanceRunning() {
    try {
      if (!fs.existsSync(this.pidFile)) {
        return false;
      }

      const previousPid = parseInt(fs.readFileSync(this.pidFile, 'utf8'));
      
      if (this.isWindows) {
        // Windows: Check if process exists
        try {
          // This will throw if process doesn't exist
          process.kill(previousPid, 0);
          return true;
        } catch (e) {
          // Process doesn't exist
          return false;
        }
      } else {
        // Unix: Check if process exists
        try {
          process.kill(previousPid, 0);
          return true;
        } catch (e) {
          return false;
        }
      }
    } catch (error) {
      console.error('Error checking previous instance:', error);
      return false;
    }
  }

  /**
   * Clean up stale lock files
   */
  cleanupStaleLocks() {
    try {
      // Check if previous instance is actually running
      if (!this.isPreviousInstanceRunning()) {
        // Clean up stale lock file
        if (fs.existsSync(this.lockFile)) {
          fs.unlinkSync(this.lockFile);
          console.log('Cleaned up stale lock file');
        }
        
        // Clean up stale PID file
        if (fs.existsSync(this.pidFile)) {
          fs.unlinkSync(this.pidFile);
          console.log('Cleaned up stale PID file');
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error cleaning up locks:', error);
      return false;
    }
  }

  /**
   * Force kill ALL previous instances (Windows only)
   * v1.4.151 - More aggressive cleanup
   */
  async forceKillPreviousInstance() {
    if (!this.isWindows) return false;

    console.log('Forcefully killing all MSS-Downloader processes...');
    
    const killCommands = [
      'taskkill /F /IM "Abba Ababus (MSS Downloader).exe" /T',
      'taskkill /F /IM "MSS-Downloader.exe" /T', 
      'taskkill /F /IM "mss-downloader.exe" /T',
      'taskkill /F /IM electron.exe /FI "WINDOWTITLE eq Abba Ababus*"',
      // Kill by window title pattern
      'wmic process where "name like \'%MSS%Downloader%\'" delete',
      'wmic process where "name like \'%Abba%Ababus%\'" delete'
    ];

    let killed = false;
    
    for (const cmd of killCommands) {
      await new Promise((resolve) => {
        exec(cmd, (error) => {
          if (!error) {
            killed = true;
            console.log(`Successfully executed: ${cmd}`);
          }
          resolve();
        });
      });
    }
    
    // Wait for processes to die
    if (killed) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return killed;
  }

  /**
   * Save current process PID
   */
  saveCurrentPid() {
    try {
      fs.writeFileSync(this.pidFile, process.pid.toString());
    } catch (error) {
      console.error('Error saving PID:', error);
    }
  }

  /**
   * Initialize process management
   */
  async initialize() {
    console.log('ProcessManager: Initializing...');
    
    // Clean up stale locks first
    const cleaned = this.cleanupStaleLocks();
    
    if (cleaned) {
      console.log('ProcessManager: Cleaned stale locks, app can start');
    }
    
    // Save current PID for future reference
    this.saveCurrentPid();
    
    // Clean up on exit
    app.on('before-quit', () => {
      try {
        if (fs.existsSync(this.pidFile)) {
          fs.unlinkSync(this.pidFile);
        }
        if (fs.existsSync(this.lockFile)) {
          fs.unlinkSync(this.lockFile);
        }
      } catch (error) {
        console.error('Error cleaning up on exit:', error);
      }
    });
    
    return true;
  }

  /**
   * Handle installer scenario - kill old instances
   */
  async handleInstallerMode() {
    if (!this.isWindows) return;
    
    // Check if we're running from installer
    const isInstaller = process.argv.some(arg => 
      arg.includes('--squirrel-install') || 
      arg.includes('--squirrel-updated') ||
      arg.includes('--installer')
    );
    
    if (isInstaller) {
      console.log('ProcessManager: Installer mode detected, killing old instances');
      await this.forceKillPreviousInstance();
      
      // Wait a bit for processes to die
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Clean up all locks
      this.cleanupStaleLocks();
    }
  }
}

module.exports = ProcessManager;