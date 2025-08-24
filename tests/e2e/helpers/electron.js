// CommonJS wrapper for Playwright Electron helper
// This imports the compiled JS from the TypeScript helper via ts-node/register-like semantics is not needed.
// We re-export the same API by requiring the TS transpiled code through esbuild at runtime is not available here,
// so we replicate the minimal helper in CJS to unblock tests that import './helpers/electron.js'.

const { test: base, expect, _electron: electron } = require('@playwright/test');
const path = require('path');

const launchedApps = new Set();

async function forceCleanupElectronApp(app) {
  try { await app.close(); } catch {}
}

process.on('exit', async () => {
  for (const app of launchedApps) { await forceCleanupElectronApp(app); }
});
process.on('SIGINT', async () => { for (const app of launchedApps) { await forceCleanupElectronApp(app); } process.exit(0); });
process.on('SIGTERM', async () => { for (const app of launchedApps) { await forceCleanupElectronApp(app); } process.exit(0); });

const test = base.extend({
  electronApp: async ({}, use) => {
    const electronArgs = [ path.join(__dirname, '../../../dist/main/main.js'), '--headless', '--no-sandbox' ];
    const env = { NODE_ENV: 'test', ELECTRON_DISABLE_SECURITY_WARNINGS: 'true', DISPLAY: ':99' };
    const app = await electron.launch({ args: electronArgs, env, timeout: 30000, headless: true });
    launchedApps.add(app);
    await use(app);
    try { await forceCleanupElectronApp(app); launchedApps.delete(app); } catch {}
  },
  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await use(page);
  },
});

module.exports = { test, expect };

