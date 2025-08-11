/**
 * Windows Defender Auto-Exclusion Module
 * v1.4.133 - Critical fix for aggressive Defender behavior
 * 
 * Automatically adds Windows Defender exclusions for MSS-Downloader
 * Fixes the issue where Defender quarantines the app instead of just warning
 */

const { exec } = require('child_process');
const { app, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

class WindowsDefenderFix {
  constructor() {
    this.isWindows = process.platform === 'win32';
    this.configPath = path.join(app.getPath('userData'), 'defender-fix-applied.json');
  }

  /**
   * Check if fix was already applied
   */
  async wasFixApplied() {
    try {
      if (fs.existsSync(this.configPath)) {
        const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        // Re-apply if older than 30 days (in case Defender updated)
        const daysSinceApplied = (Date.now() - config.appliedAt) / (1000 * 60 * 60 * 24);
        return daysSinceApplied < 30;
      }
    } catch (e) {
      console.error('Error checking defender fix status:', e);
    }
    return false;
  }

  /**
   * Mark fix as applied
   */
  markFixApplied() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify({
        appliedAt: Date.now(),
        version: app.getVersion(),
        paths: this.getExclusionPaths(),
        processes: this.getExclusionProcesses()
      }, null, 2));
    } catch (e) {
      console.error('Error saving defender fix status:', e);
    }
  }

  /**
   * Get paths to exclude
   */
  getExclusionPaths() {
    const paths = [
      app.getPath('exe'),
      app.getPath('userData'),
      path.dirname(app.getPath('exe')),
      process.resourcesPath
    ];
    
    // Add development paths if in dev mode
    if (!app.isPackaged) {
      paths.push(process.cwd());
      paths.push(path.join(process.cwd(), 'dist'));
      paths.push(path.join(process.cwd(), 'node_modules'));
    }
    
    return [...new Set(paths)]; // Remove duplicates
  }

  /**
   * Get processes to exclude
   */
  getExclusionProcesses() {
    return [
      'electron.exe',
      'mss-downloader.exe',
      'MSS-Downloader.exe',
      path.basename(app.getPath('exe'))
    ];
  }

  /**
   * Execute PowerShell command with elevation
   */
  async executePowerShell(command) {
    return new Promise((resolve, reject) => {
      // Escape the command for PowerShell
      const escapedCommand = command.replace(/"/g, '`"');
      
      // Use Start-Process to request elevation
      const fullCommand = `powershell.exe -Command "Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command \\"${escapedCommand}\\"' -Verb RunAs -Wait"`;
      
      exec(fullCommand, { windowsHide: true }, (error, stdout, stderr) => {
        if (error) {
          console.error('PowerShell execution error:', error);
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
  }

  /**
   * Build PowerShell commands for exclusions
   */
  buildPowerShellCommands() {
    const commands = [];
    
    // Add path exclusions
    this.getExclusionPaths().forEach(path => {
      commands.push(`Add-MpPreference -ExclusionPath '${path}' -ErrorAction SilentlyContinue`);
    });
    
    // Add process exclusions - ONE AT A TIME (critical fix!)
    this.getExclusionProcesses().forEach(process => {
      commands.push(`Add-MpPreference -ExclusionProcess '${process}' -ErrorAction SilentlyContinue`);
    });
    
    // Add file extensions
    commands.push(`Add-MpPreference -ExclusionExtension '.asar' -ErrorAction SilentlyContinue`);
    commands.push(`Add-MpPreference -ExclusionExtension '.node' -ErrorAction SilentlyContinue`);
    
    return commands.join('; ');
  }

  /**
   * Apply Windows Defender exclusions
   */
  async applyExclusions(silent = false) {
    if (!this.isWindows) {
      console.log('Not Windows, skipping Defender fix');
      return true;
    }

    try {
      // Check if already applied
      if (await this.wasFixApplied()) {
        console.log('Windows Defender fix already applied recently');
        return true;
      }

      // Ask user for permission if not silent
      if (!silent) {
        const result = await dialog.showMessageBox({
          type: 'warning',
          title: 'Windows Defender Configuration',
          message: 'Windows Defender may interfere with MSS-Downloader',
          detail: 'Would you like to add MSS-Downloader to Windows Defender exclusions? This requires administrator privileges and will prevent Defender from quarantining the application.',
          buttons: ['Yes, Add Exclusions', 'No, Skip'],
          defaultId: 0,
          cancelId: 1
        });

        if (result.response !== 0) {
          console.log('User declined Defender exclusions');
          return false;
        }
      }

      console.log('Applying Windows Defender exclusions...');
      
      // Build and execute PowerShell commands
      const commands = this.buildPowerShellCommands();
      await this.executePowerShell(commands);
      
      // Mark as applied
      this.markFixApplied();
      
      console.log('Windows Defender exclusions applied successfully');
      
      if (!silent) {
        dialog.showMessageBox({
          type: 'info',
          title: 'Success',
          message: 'Windows Defender exclusions added',
          detail: 'MSS-Downloader has been added to Windows Defender exclusions. The application should now run without interference.',
          buttons: ['OK']
        });
      }
      
      return true;
    } catch (error) {
      console.error('Failed to apply Windows Defender exclusions:', error);
      
      if (!silent) {
        dialog.showMessageBox({
          type: 'error',
          title: 'Exclusion Failed',
          message: 'Could not add Windows Defender exclusions',
          detail: `The exclusions could not be added automatically. Please run the manual fix script as Administrator.\n\nError: ${error.message}`,
          buttons: ['OK']
        });
      }
      
      return false;
    }
  }

  /**
   * Check if running from quarantine recovery
   */
  isRecoveringFromQuarantine() {
    // Check for signs that app was restored from quarantine
    const markers = [
      !fs.existsSync(path.join(app.getPath('userData'), 'config.json')),
      process.argv.includes('--restored'),
      process.env.DEFENDER_RESTORED === '1'
    ];
    
    return markers.some(m => m);
  }

  /**
   * Initialize the defender fix
   */
  async initialize() {
    if (!this.isWindows) return;

    try {
      // Check if recovering from quarantine
      if (this.isRecoveringFromQuarantine()) {
        console.log('Detected recovery from quarantine, applying fix immediately');
        await this.applyExclusions(true);
        return;
      }

      // On first run or if not applied recently
      if (!await this.wasFixApplied()) {
        // Delay to not interfere with app startup
        setTimeout(() => {
          this.applyExclusions(false);
        }, 5000);
      }
    } catch (error) {
      console.error('Defender fix initialization error:', error);
    }
  }
}

module.exports = WindowsDefenderFix;