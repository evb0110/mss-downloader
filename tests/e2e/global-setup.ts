import { FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function globalSetup(config: FullConfig) {
  console.log('🧹 Cleaning up any orphaned Electron processes...');
  
  try {
    // Kill any existing Electron processes related to our app
    await execAsync('pkill -f "mss-downloader.*electron.*dist/main/main.js" || true');
    
    // Also kill any leftover node processes that might be from our app
    await execAsync('pkill -f "mss-downloader.*node_modules/.bin/electron" || true');
    
    console.log('✅ Pre-test cleanup completed');
  } catch (error) {
    console.warn('⚠️  Pre-test cleanup failed (this is usually fine):', error);
  }
}

export default globalSetup;