# Electron Main Process Window Visibility Analysis

## Executive Summary

The Electron main process contains comprehensive headless mode configurations with robust window visibility controls. However, there are **TWO CRITICAL WINDOW VISIBILITY ISSUES** that can override headless settings:

1. **CAPTCHA Window** - Creates visible modal windows that bypass headless mode
2. **DevTools Auto-Opening** - Forces visible DevTools windows in development mode

## Detailed Findings

### 1. Main Window Configuration (Lines 38-171)

**Headless Detection Logic (Lines 40-43):**
```typescript
const isHeadless = process.argv.includes('--headless') ||
                   process.env.NODE_ENV === 'test' ||
                   process.env.DISPLAY === ':99' || // Playwright test display
                   process.env.CI === 'true';
```

**Window Creation Settings (Lines 45-70):**
- Base configuration: `show: false` (Line 58) - Never shows initially
- Headless-specific overrides (Lines 59-69):
  - `x: -2000, y: -2000` - Moves window off-screen
  - `skipTaskbar: true` - Hides from taskbar
  - `minimizable: false, maximizable: false, resizable: false` - Disables controls
  - `opacity: 0` - Makes completely transparent
  - `focusable: false` - Prevents focus
  - `alwaysOnTop: false` - Keeps in background

**Ready-to-Show Event (Lines 160-166):**
```typescript
mainWindow.once('ready-to-show', () => {
  // CRITICAL: Never show window during tests or headless mode
  if (!isHeadless && process.env.NODE_ENV !== 'test') {
    mainWindow?.show();
  }
});
```

**Assessment:** ✅ **SECURE** - Main window properly respects headless mode.

### 2. **CRITICAL ISSUE #1: CAPTCHA Window (Lines 656-745)**

**Problem:** The `solve-captcha` IPC handler creates a **VISIBLE modal window** that completely bypasses headless mode:

```typescript
ipcMain.handle('solve-captcha', async (_event, url: string) => {
  const captchaWindow = new BrowserWindow({
    width: 900,
    height: 700,
    title: 'Complete Captcha - Close window when done',
    modal: true,
    parent: mainWindow || undefined,
    show: false  // Initially hidden
  });
  
  // ... loading logic ...
  
  captchaWindow.once('ready-to-show', () => {
    captchaWindow.show();  // 🚨 ALWAYS SHOWS - NO HEADLESS CHECK
  });
});
```

**Impact:** This window will appear in headed mode regardless of `--headless` flag or test environment.

**Risk Level:** 🔴 **HIGH** - Directly violates headless security policy.

### 3. **CRITICAL ISSUE #2: DevTools Auto-Opening (Lines 72-79)**

**Problem:** DevTools automatically open in development mode without headless checks:

```typescript
// Force devtools open immediately (but not for tests)
if (isDev && process.env.NODE_ENV !== 'test') {
  mainWindow.webContents.openDevTools({ mode: 'detach' });
}
```

**Impact:** Creates visible detached DevTools window in development mode.

**Additional DevTools Triggers:**
- F12 key handler (Lines 140-148)
- Context menu "Inspect Element" (Lines 102-128)
- Menu item "Open DevTools" (Lines 238-247)

**Risk Level:** 🟡 **MEDIUM** - Only affects development mode, but still creates visible windows.

### 4. Environment Variable Checks

**Triggers for Headless Mode:**
- `--headless` command line argument
- `NODE_ENV === 'test'`
- `DISPLAY === ':99'` (Playwright test display)
- `CI === 'true'`

**Test Configuration Validation:**
The Playwright test helper (`tests/e2e/helpers/electron.ts`) properly sets:
- `--headless` flag (Line 72)
- `NODE_ENV: 'test'` (Line 81)
- `DISPLAY: ':99'` (Line 83)
- `headless: true` (Line 88)

### 5. Additional Window Creation Points

**Menu Actions:**
- "Clear Cache" dialog (Lines 183-191)
- "About" dialog (Lines 262-271)

**Assessment:** ✅ **SECURE** - These use `dialog.showMessageBox()` which respects parent window visibility.

## Security Recommendations

### Immediate Fixes Required

1. **Fix CAPTCHA Window (CRITICAL):**
```typescript
// Add headless check before showing captcha window
captchaWindow.once('ready-to-show', () => {
  if (!isHeadless && process.env.NODE_ENV !== 'test') {
    captchaWindow.show();
  }
});
```

2. **Fix DevTools Auto-Opening (MEDIUM):**
```typescript
// Add headless check to DevTools opening
if (isDev && process.env.NODE_ENV !== 'test' && !isHeadless) {
  mainWindow.webContents.openDevTools({ mode: 'detach' });
}
```

3. **Add Headless Checks to All DevTools Triggers:**
   - F12 key handler
   - Context menu inspect element
   - Debug menu items

### Additional Security Measures

1. **Global Window Creation Guard:**
```typescript
// Add to top of main.ts
const shouldShowWindows = () => !isHeadless && process.env.NODE_ENV !== 'test';
```

2. **Audit All BrowserWindow Creations:**
   - Ensure all new window creation includes headless checks
   - Consider creating a wrapper function for secure window creation

3. **Environment Variable Validation:**
   - Consider adding explicit `HEADLESS=true` environment variable
   - Add logging to confirm headless mode detection

## Current Status

- ✅ Main window properly configured for headless mode
- ✅ Playwright test configuration correct
- ✅ Dialog boxes respect parent window visibility
- 🔴 CAPTCHA window bypasses headless mode
- 🟡 DevTools auto-open in development mode
- 🟡 DevTools keyboard/menu shortcuts lack headless checks

## Files Analyzed

1. `/src/main/main.ts` - Main process entry point
2. `/tests/e2e/helpers/electron.ts` - Playwright Electron test helper
3. `/playwright.config.ts` - Playwright configuration
4. `/tests/e2e/global-setup.ts` - Test setup
5. `/tests/e2e/global-teardown.ts` - Test teardown
6. `/package.json` - Electron build configuration

The analysis confirms that while the main window architecture is secure for headless operation, the CAPTCHA window creation and DevTools auto-opening represent immediate security risks that must be addressed to maintain strict headless compliance.