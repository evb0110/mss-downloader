import { FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function globalSetup(config: FullConfig) {
  console.log('🧹 Cleaning up any orphaned Electron processes...');
  
  try {
    // More comprehensive cleanup - kill all Electron processes from this project directory
    const projectName = 'mss-downloader';
    
    // Kill Electron main processes
    await execAsync(`pkill -f "${projectName}.*electron.*dist/main/main.js" || true`);
    await execAsync(`pkill -f "${projectName}.*node_modules/.bin/electron" || true`);
    
    // Kill any Electron.app processes from our project
    await execAsync(`pkill -f "Electron.app.*${projectName}" || true`);
    
    // Kill Electron helper processes that may be left behind
    await execAsync(`pkill -f "Electron Helper.*${projectName}" || true`);
    
    // Kill any node processes running electron from our project directory
    await execAsync(`pgrep -f "node.*electron.*${projectName}" | xargs kill -9 2>/dev/null || true`);
    
    // Kill any remaining processes with our project name in electron context
    await execAsync(`pgrep -f "electron.*${projectName}|${projectName}.*electron" | xargs kill -9 2>/dev/null || true`);
    
    // Clean up temporary user data directories
    await execAsync('rm -rf /tmp/electron-test-* || true');
    
    // Wait a moment for processes to actually terminate
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ Pre-test cleanup completed');
  } catch (error) {
    console.warn('⚠️  Pre-test cleanup failed (this is usually fine):', error);
  }
}

export default globalSetup;