import { FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Post-test cleanup: removing orphaned Electron processes...');
  
  try {
    // Kill any remaining Electron processes related to our app
    await execAsync('pkill -f "mss-downloader.*electron.*dist/main/main.js" || true');
    
    // Also kill any leftover node processes that might be from our app
    await execAsync('pkill -f "mss-downloader.*node_modules/.bin/electron" || true');
    
    // Clean up temporary user data directories
    await execAsync('rm -rf /tmp/electron-test-* || true');
    
    console.log('✅ Post-test cleanup completed');
  } catch (error) {
    console.warn('⚠️  Post-test cleanup failed (this is usually fine):', error);
  }
}

export default globalTeardown;