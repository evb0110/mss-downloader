#!/usr/bin/env node

// Minimal autonomous Electron controller using Playwright
// - Builds app if needed
// - Launches Electron headless
// - Executes a simple declarative action plan (fill/click/wait/screenshot)
// - Captures console logs and can wait for log patterns

const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const { _electron: electron } = require('playwright');

// In-memory automation state
const automationState = {
  consoleLines: [],
  consoleFile: null,
  consoleCapture: false,
};

function parseArgs(argv) {
  const args = { params: {}, keepOpen: false, headless: true, screenshotOnError: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--plan') {
      args.plan = argv[++i];
    } else if (a === '--steps') {
      args.steps = argv[++i];
    } else if (a === '--keep-open') {
      args.keepOpen = true;
    } else if (a === '--headed') {
      args.headless = false;
    } else if (a === '--headless') {
      args.headless = true;
    } else if (a === '--no-screenshot-on-error') {
      args.screenshotOnError = false;
    } else if (a === '--param') {
      const kv = argv[++i];
      const [k, ...rest] = kv.split('=');
      args.params[k] = rest.join('=');
    }
  }
  return args;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function preCleanup() {
  // Best-effort cleanup of orphan electron processes for this project
  const projectHint = 'mss-downloader';
  const cmds = [
    `pkill -f "${projectHint}.*electron.*dist/main/main.js" || true`,
    `pkill -f "${projectHint}.*node_modules/.bin/electron" || true`,
    `pkill -f "Electron.app.*${projectHint}" || true`,
    `pkill -f "Electron Helper.*${projectHint}" || true`,
  ];
  await Promise.all(
    cmds.map(
      (cmd) =>
        new Promise((resolve) =>
          exec(cmd, () => resolve())
        )
    )
  );
}

function ensureBuilt(mainEntry) {
  const rendererIndex = path.resolve(__dirname, '../../dist/renderer/index.html');
  const needsBuild = !fs.existsSync(mainEntry) || !fs.existsSync(rendererIndex);
  if (needsBuild) {
    console.log('📦 Running build: npm run build');
    execSync('npm run build', { stdio: 'inherit' });
  }
}

function loadPlan(args) {
  if (args.plan) {
    const planPath = path.resolve(process.cwd(), args.plan);
    const raw = fs.readFileSync(planPath, 'utf8');
    return JSON.parse(raw);
  }
  if (args.steps) {
    return JSON.parse(args.steps);
  }
  return null;
}

function interpolate(text, params) {
  if (text === null || text === undefined) return text;
  if (typeof text === 'object') {
    // Recursively interpolate in objects
    const clone = Array.isArray(text) ? [] : {};
    for (const k in text) clone[k] = interpolate(text[k], params);
    return clone;
  }
  if (typeof text !== 'string') return text;
  return text.replace(/\{\{(.*?)\}\}/g, (_, key) => params[key.trim()] ?? '');
}

async function invokeIpc(page, call, args) {
  return await page.evaluate(({ call, args }) => {
    const api = window.electronAPI;
    if (!api || typeof api[call] !== 'function') {
      throw new Error(`electronAPI.${call} is not available`);
    }
    return api[call](...(args || []));
  }, { call, args });
}

async function waitForQueueIdle(page, { timeout = 15 * 60 * 1000, intervalMs = 2000 } = {}) {
  const start = Date.now();
  // statuses considered active
  const active = new Set(['loading', 'pending', 'downloading']);
  while (Date.now() - start < timeout) {
    const state = await invokeIpc(page, 'getQueueState', []);
    const items = Array.isArray(state?.items) ? state.items : [];
    const stillActive = items.some(it => active.has(it.status));
    if (!stillActive) return state;
    await page.waitForTimeout(intervalMs);
  }
  throw new Error('waitForQueueIdle timeout');
}

async function monitorQueue(page, { timeout = 25 * 60 * 1000, intervalMs = 5000, logPath = '.devkit/validation/READY-FOR-USER/queue-monitor.ndjson', screenshotEveryMs = 30000 } = {}) {
  const start = Date.now();
  ensureDir(require('path').dirname(logPath));
  let lastShot = Date.now();
  const active = new Set(['loading', 'pending', 'downloading']);
  while (Date.now() - start < timeout) {
    const state = await invokeIpc(page, 'getQueueState', []);
    const ts = new Date().toISOString();
    try { require('fs').appendFileSync(logPath, JSON.stringify({ ts, state }) + '\n'); } catch {}
    const items = Array.isArray(state?.items) ? state.items : [];
    const stillActive = items.some(it => active.has(it.status));
    if (Date.now() - lastShot >= screenshotEveryMs) {
      lastShot = Date.now();
      try {
        await page.screenshot({ path: `.devkit/validation/READY-FOR-USER/monitor-${ts.replace(/[:.]/g,'-')}.png`, fullPage: true });
      } catch {}
    }
    if (!stillActive) return state;
    await page.waitForTimeout(intervalMs);
  }
  throw new Error('monitorQueue timeout');
}

async function runSteps(page, steps, params) {
  for (const [idx, step] of steps.entries()) {
    const action = step.action;
    const optional = !!step.optional;
    console.log(`➡️  [${idx + 1}/${steps.length}] ${action}${optional ? ' (optional)' : ''}`);
    const sel = interpolate(step.selector, params);

    const execStep = async () => { switch (action) {
      case 'ipc': {
        const call = interpolate(step.call, params);
        const args = interpolate(step.args || [], params);
        const res = await invokeIpc(page, call, args);
        if (step.saveAs) {
          // Save JSON result to file
          const out = interpolate(step.saveAs, params);
          ensureDir(require('path').dirname(out));
          require('fs').writeFileSync(out, JSON.stringify(res, null, 2));
        }
        break;
      }
      case 'waitForQueueIdle': {
        const opts = { timeout: step.timeout ?? 15 * 60 * 1000, intervalMs: step.intervalMs ?? 2000 };
        const res = await waitForQueueIdle(page, opts);
        if (step.saveAs) {
          const out = interpolate(step.saveAs, params);
          ensureDir(require('path').dirname(out));
          require('fs').writeFileSync(out, JSON.stringify(res, null, 2));
        }
        break;
      }
      case 'monitorQueue': {
        const opts = {
          timeout: step.timeout ?? 25 * 60 * 1000,
          intervalMs: step.intervalMs ?? 5000,
          logPath: interpolate(step.logPath || '.devkit/validation/READY-FOR-USER/queue-monitor.ndjson', params),
          screenshotEveryMs: step.screenshotEveryMs ?? 30000,
        };
        await monitorQueue(page, opts);
        break;
      }
      case 'addManuscriptIPC': {
        const url = interpolate(step.url || params.URL, params);
        if (!url) throw new Error('addManuscriptIPC requires url or --param URL=...');
        // Get current concurrency default from queue state
        const state = await invokeIpc(page, 'getQueueState', []);
        const concurrent = Number(state?.globalSettings?.concurrentDownloads || step.concurrentDownloads || 3);
        // Add temp item
        const tempId = await invokeIpc(page, 'addToQueue', [{
          url,
          displayName: `Loading manifest for ${url.substring(0, 50)}...`,
          library: 'loading',
          totalPages: 0,
          downloadOptions: {
            concurrentDownloads: concurrent,
            startPage: 1,
            endPage: 1,
          },
        }]);
        // Parse manifest
        let manifest;
        try {
          manifest = await invokeIpc(page, 'parseManuscriptUrl', [url]);
        } catch (e) {
          // Mark failed and rethrow
          await invokeIpc(page, 'updateQueueItem', [tempId, {
            displayName: `Failed to load: ${url.substring(0, 50)}...`,
            status: 'failed',
            error: e && e.message ? e.message : String(e),
          }]);
          throw e;
        }
        // Update item to pending with manifest
        await invokeIpc(page, 'updateQueueItem', [tempId, {
          displayName: manifest.displayName || 'Manuscript',
          library: manifest.library || 'unknown',
          totalPages: manifest.totalPages || (Array.isArray(manifest.pageLinks) ? manifest.pageLinks.length : 0) || 0,
          status: 'pending',
          downloadOptions: {
            concurrentDownloads: concurrent,
            startPage: 1,
            endPage: (manifest.totalPages || (Array.isArray(manifest.pageLinks) ? manifest.pageLinks.length : 0) || 1),
          },
        }]);
        if (step.saveIdAs) {
          const out = interpolate(step.saveIdAs, params);
          ensureDir(require('path').dirname(out));
          require('fs').writeFileSync(out, JSON.stringify({ id: tempId }, null, 2));
        }
        break;
      }
      case 'startConsoleCapture': {
        automationState.consoleCapture = true;
        automationState.consoleFile = interpolate(step.logPath || '.devkit/validation/READY-FOR-USER/console.log', params);
        ensureDir(require('path').dirname(automationState.consoleFile));
        break;
      }
      case 'saveConsole': {
        const out = interpolate(step.logPath || automationState.consoleFile || '.devkit/validation/READY-FOR-USER/console.log', params);
        ensureDir(require('path').dirname(out));
        try { require('fs').writeFileSync(out, automationState.consoleLines.join('\n')); } catch {}
        break;
      }
      case 'waitForLoad': {
        const state = step.state || 'domcontentloaded';
        await page.waitForLoadState(state, { timeout: step.timeout ?? 30000 });
        break;
      }
      case 'waitForSelector': {
        await page.waitForSelector(sel, { timeout: step.timeout ?? 30000 });
        break;
      }
      case 'fill': {
        const locator = page.locator(sel).first();
        await locator.fill(interpolate(step.text, params));
        break;
      }
      case 'click': {
        const locator = page.locator(sel).first();
        await locator.click();
        break;
      }
      case 'press': {
        await page.keyboard.press(step.key);
        break;
      }
      case 'waitForText': {
        if (sel) {
          await page.locator(sel).getByText(interpolate(step.text, params)).first().waitFor({ timeout: step.timeout ?? 60000 });
        } else {
          // Page-wide check loop
          const text = interpolate(step.text, params);
          const timeout = step.timeout ?? 60000;
          const start = Date.now();
          while (Date.now() - start < timeout) {
            const content = await page.content();
            if (content.includes(text)) break;
            await page.waitForTimeout(500);
          }
        }
        break;
      }
      case 'waitForConsole': {
        const includes = step.includes ? interpolate(step.includes, params) : null;
        const regex = step.regex ? new RegExp(step.regex) : null;
        const timeout = step.timeout ?? 60000;
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            page.off('console', onConsole);
            reject(new Error('waitForConsole timeout'));
          }, timeout);
          function onConsole(msg) {
            const text = msg.text();
            if ((includes && text.includes(includes)) || (regex && regex.test(text))) {
              clearTimeout(timer);
              page.off('console', onConsole);
              resolve();
            }
          }
          page.on('console', onConsole);
        });
        break;
      }
      case 'sleep': {
        await page.waitForTimeout(step.ms ?? 1000);
        break;
      }
      case 'screenshot': {
        const out = interpolate(step.path || '.devkit/validation/auto.png', params);
        ensureDir(path.dirname(out));
        await page.screenshot({ path: out, fullPage: !!step.fullPage });
        break;
      }
      case 'log': {
        console.log(interpolate(step.message || '', params));
        break;
      }
      default:
        console.warn(`⚠️  Unknown action: ${action}`);
    }};

    try {
      await execStep();
    } catch (e) {
      if (optional) {
        console.log(`⏭️  Optional step '${action}' failed, continuing: ${e && e.message ? e.message : e}`);
      } else {
        throw e;
      }
    }
  }
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const mainEntry = path.resolve(__dirname, '../../dist/main/main.js');

  try {
    await preCleanup();
    ensureBuilt(mainEntry);

    console.log('🚀 Launching Electron via Playwright...');
    const electronArgs = [
      mainEntry,
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ];
    if (args.headless) electronArgs.unshift('--headless');

    const env = {
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      NODE_ENV: 'test', // ensure dist build is loaded
      FORCE_HEADED: args.headless ? '0' : '1'
    };

    const app = await electron.launch({
      args: electronArgs,
      env,
      timeout: 60000,
      headless: !('headless' in args) ? false : args.headless,
    });

    const page = await app.firstWindow();

    // Always capture console messages for visibility
    page.on('console', (msg) => {
      const text = msg.text();
      const timestamp = new Date().toLocaleTimeString();
      const line = `[${timestamp}] ${text}`;
      if (automationState.consoleCapture) {
        automationState.consoleLines.push(line);
        if (automationState.consoleFile) {
          try { require('fs').appendFileSync(automationState.consoleFile, line + '\n'); } catch {}
        }
      }
      console.log(line);
    });

    // Initial load wait
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
    await page.waitForTimeout(2000);

    const plan = loadPlan(args);

    if (Array.isArray(plan) && plan.length > 0) {
      console.log(`📋 Executing plan with ${plan.length} steps...`);
      await runSteps(page, plan, args.params);
    } else if (args.steps) {
      console.log('ℹ️  Steps provided but empty. Opening app only.');
    } else {
      console.log('ℹ️  No plan provided. Opening app only.');
    }

    if (plan && plan.some(s => s.action === 'screenshot')) {
      // already took screenshots if requested
    } else {
      // Take a quick UI snapshot for debugging
      ensureDir('.devkit/validation/READY-FOR-USER');
      await page.screenshot({ path: '.devkit/validation/READY-FOR-USER/auto-initial.png' });
    }

    if (args.keepOpen || !plan) {
      console.log('🟢 App is running. Press Ctrl+C to exit.');
      // Keep alive until SIGINT
      await new Promise(() => {});
    } else {
      console.log('🧹 Closing Electron app...');
      await app.close();
    }
  } catch (err) {
    console.error('❌ Automation error:', err && err.message ? err.message : err);
    try {
      ensureDir('.devkit/validation/READY-FOR-USER');
      if (typeof page !== 'undefined') {
        await page.screenshot({ path: '.devkit/validation/READY-FOR-USER/auto-error.png', fullPage: true });
      }
    } catch {}
    process.exit(1);
  }
})();
