# Package.json Scripts Analysis - Headed Mode Detection

## Executive Summary

Analysis of all package.json scripts to identify potential sources of Electron windows launching in headed mode despite headless configurations. **CRITICAL FINDING: The main development scripts `npm run dev` and `npm run dev:main` do NOT include the `--headless` flag.**

## Scripts Analysis

### 🚨 CRITICAL ISSUES FOUND

#### 1. Main Development Scripts Missing Headless Flag

**Problem Scripts:**
- `"dev:main": "npm run build:preload && tsc --project tsconfig.main.json && NODE_ENV=development electron dist/main/main.js"`
- `"dev": "npm run dev:renderer && concurrently --names \"MAIN,RENDERER\" --prefix-colors \"yellow,cyan\" \"npm run dev:main\" \"npm run dev:renderer:watch\""`

**Issue:** These scripts launch Electron **WITHOUT** the `--headless` flag, meaning they will always show the Electron window.

**Contrast with Fixed Scripts:**
- `"dev:main:headless": "npm run build:preload && tsc --project tsconfig.main.json && NODE_ENV=development electron dist/main/main.js --headless"`
- `"dev:headless": "npm run dev:renderer && concurrently --names \"MAIN,RENDERER\" --prefix-colors \"yellow,cyan\" \"npm run dev:main:headless\" \"npm run dev:renderer:watch\""`

#### 2. PID Management Scripts Call Headed Versions

**Problem Scripts:**
- `"dev:start": "(npm run dev & echo $! > .dev-pid) && wait"`

**Issue:** This calls `npm run dev` which internally calls `dev:main` (the headed version), not `dev:main:headless`.

### ✅ CORRECTLY CONFIGURED SCRIPTS

#### Test Scripts (All Properly Headless)
- `"test:e2e": "npm run build && npx playwright test"` ✅ (Playwright config enforces headless)
- `"test:e2e:start": "npm run build && (npx playwright test & echo $! > .test-pid) && wait"` ✅
- `"test:e2e:kill": "..."` ✅ (Cleanup only)

**Note:** Test scripts are safe because:
1. Playwright config has `headless: true`
2. Electron helper in `tests/e2e/helpers/electron.ts` explicitly passes `--headless` flag
3. Test environment sets `NODE_ENV: 'test'` and `DISPLAY: ':99'`

#### Build/Distribution Scripts (No Electron Launch)
- All `build:*`, `dist:*`, `lint:*` scripts ✅ (Don't launch Electron)

#### Telegram Scripts (No Electron Launch)
- All `telegram:*` scripts ✅ (Run Node.js scripts, not Electron)

## Root Cause Analysis

### Main Process Headless Detection Logic

The main Electron process (`src/main/main.ts`) determines headless mode via:

```typescript
const isHeadless = process.argv.includes('--headless') || 
                   process.env.NODE_ENV === 'test' ||
                   process.env.DISPLAY === ':99' || // Playwright test display
                   process.env.CI === 'true';
```

### The Problem

1. **Development Scripts**: `dev:main` launches without `--headless` flag
2. **PID Scripts**: `dev:start` calls `dev` which calls `dev:main` (headed)
3. **No CI Detection**: Development environment doesn't set `NODE_ENV=test` or `CI=true`
4. **Manual Flag Required**: Only way to get headless in dev is explicit `--headless` argument

## macOS-Specific Electron Behavior

### App Activation Handler
```typescript
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
```

**Issue:** On macOS, if all windows are closed but app remains active, clicking the dock icon triggers window creation. This calls `createWindow()` again, potentially bypassing headless detection if the original process arguments are lost.

### Window Show Logic
```typescript
mainWindow.once('ready-to-show', () => {
  if (!isHeadless && process.env.NODE_ENV !== 'test') {
    mainWindow?.show(); // This shows the window!
  }
});
```

## Script Usage Patterns

### Current User Workflow (PROBLEMATIC)
1. User runs `npm run dev:start` → Calls `npm run dev` → Shows Electron window
2. User runs `npm run dev:kill` → Kills headed process

### Recommended Workflow (CORRECT)
1. User should run `npm run dev:headless:start` → Calls `npm run dev:headless` → Hidden window
2. User runs `npm run dev:headless:kill` → Kills headless process

## Immediate Fix Recommendations

### 1. Fix PID Management Scripts
```json
{
  "dev:start": "(npm run dev:headless & echo $! > .dev-pid) && wait",
  "dev:headless:start": "(npm run dev:headless & echo $! > .dev-headless-pid) && wait"
}
```

### 2. Make Headless Default for Development
```json
{
  "dev": "npm run dev:renderer && concurrently --names \"MAIN,RENDERER\" --prefix-colors \"yellow,cyan\" \"npm run dev:main:headless\" \"npm run dev:renderer:watch\"",
  "dev:headed": "npm run dev:renderer && concurrently --names \"MAIN,RENDERER\" --prefix-colors \"yellow,cyan\" \"npm run dev:main:headed\" \"npm run dev:renderer:watch\"",
  "dev:main:headed": "npm run build:preload && tsc --project tsconfig.main.json && NODE_ENV=development electron dist/main/main.js"
}
```

### 3. Environment Variable Override
Add to main.ts:
```typescript
const isHeadless = process.argv.includes('--headless') || 
                   process.env.NODE_ENV === 'test' ||
                   process.env.DISPLAY === ':99' ||
                   process.env.CI === 'true' ||
                   process.env.ELECTRON_HEADLESS === 'true'; // New override
```

## Security Implications

### Screen Share Vulnerability
The CLAUDE.md file specifically mentions:
> "SECURITY CRITICAL: User screen-shares on calls - browser windows expose them"

**Current Risk:** Any call to `npm run dev:start` or `npm run dev` will open visible Electron windows, potentially exposing sensitive information during screen sharing sessions.

## Conclusion

**Primary Culprit:** The `dev:start` script calls the headed version of the development server. This is the most likely source of unexpected Electron windows appearing during development.

**Secondary Issues:** 
- macOS app activation behavior can re-create windows
- No environment variable fallback for headless mode
- Inconsistent naming between PID management scripts

**Immediate Action Required:** Update `dev:start` to call `dev:headless` instead of `dev` to prevent headed window creation during development workflows.