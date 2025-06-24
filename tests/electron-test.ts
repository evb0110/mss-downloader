import { test as base, expect, ElectronApplication, _electron as electron } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extend basic test with Electron app fixture
export const test = base.extend<{ electronApp: ElectronApplication }>({
  electronApp: async ({}, use) => {
    // Launch Electron app
    const electronApp = await electron.launch({
      args: [path.join(__dirname, '../dist/main/main.js'), '--headless'],
      headless: true,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DISPLAY: ':99'
      },
    });

    // Use the app
    await use(electronApp);

    // Clean up
    await electronApp.close();
  },
});

export { expect };