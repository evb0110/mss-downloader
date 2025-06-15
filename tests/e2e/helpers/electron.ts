import { test as base, expect, ElectronApplication, Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const test = base.extend<{
  electronApp: ElectronApplication;
  page: Page;
}>({
  electronApp: async ({}, use) => {
    const electronApp = await electron.launch({
      args: [path.join(__dirname, '../../../dist/main/main.js'), '--headless'],
      env: {
        NODE_ENV: 'test',
      },
      executablePath: undefined, // Let Playwright find Electron
      timeout: 30000,
    });
    await use(electronApp);
    await electronApp.close();
  },
  
  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await use(page);
  },
});

export { expect };