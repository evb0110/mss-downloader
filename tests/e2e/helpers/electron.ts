import { test as base, expect, ElectronApplication, Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Track all launched electron apps for cleanup
const launchedApps = new Set<ElectronApplication>();

// Global cleanup on process exit
process.on('exit', async () => {
  for (const app of launchedApps) {
    try {
      await app.close();
    } catch (error) {
      console.warn('Failed to close Electron app during cleanup:', error);
    }
  }
});

process.on('SIGINT', async () => {
  for (const app of launchedApps) {
    try {
      await app.close();
    } catch (error) {
      console.warn('Failed to close Electron app during SIGINT cleanup:', error);
    }
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
        `--user-data-dir=${userDataDir}`
      ],
      env: {
        NODE_ENV: 'test',
      },
      executablePath: undefined, // Let Playwright find Electron
      timeout: 30000,
    });
    
    // Track this app for cleanup
    launchedApps.add(electronApp);
    
    await use(electronApp);
    
    // Clean up
    try {
      await electronApp.close();
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