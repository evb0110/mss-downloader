import { test as base, expect, ElectronApplication, Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Track all launched electron apps for cleanup
const launchedApps = new Set<ElectronApplication>();

// Cleanup function that kills processes more aggressively
async function forceCleanupElectronApp(app: ElectronApplication) {
  try {
    // First try graceful close
    await app.close();
  } catch (error) {
    console.warn('Graceful close failed, attempting force kill:', error);
    
    try {
      // Force kill electron processes
      const execAsync = promisify(exec);
      
      const projectName = 'mss-downloader';
      
      // Kill any remaining electron processes from this project
      await execAsync(`pkill -f "${projectName}.*electron" || true`);
      await execAsync(`pkill -f "Electron.*${projectName}" || true`);
      
    } catch (killError) {
      console.warn('Force kill also failed:', killError);
    }
  }
}

// Global cleanup on process exit
process.on('exit', async () => {
  for (const app of launchedApps) {
    await forceCleanupElectronApp(app);
  }
});

process.on('SIGINT', async () => {
  for (const app of launchedApps) {
    await forceCleanupElectronApp(app);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  for (const app of launchedApps) {
    await forceCleanupElectronApp(app);
  }
  process.exit(0);
});

export const test = base.extend<{
  electronApp: ElectronApplication;
  page: Page;
}>({
  electronApp: async ({}, use) => {
    // Create unique user data directory for each test
    const userDataDir = path.join(tmpdir(), `electron-test-${randomBytes(8).toString('hex')}`);
    
    const electronApp = await electron.launch({
      args: [
        path.join(__dirname, '../../../dist/main/main.js'), 
        '--headless',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        `--user-data-dir=${userDataDir}`
      ],
      env: {
        NODE_ENV: 'test',
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
        DISPLAY: ':99' // Ensure headless display
      },
      executablePath: undefined, // Let Playwright find Electron
      timeout: 30000,
      // Explicitly disable headed mode
      headless: true,
    });
    
    // Track this app for cleanup
    launchedApps.add(electronApp);
    
    await use(electronApp);
    
    // Clean up
    try {
      await forceCleanupElectronApp(electronApp);
      launchedApps.delete(electronApp);
    } catch (error) {
      console.warn('Failed to close Electron app:', error);
    }
  },
  
  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await use(page);
  },
});

export { expect };