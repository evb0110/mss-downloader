# Electron Headed Mode Investigation Report

## Executive Summary
After comprehensive analysis of all configuration files and source code, I've identified **MULTIPLE CRITICAL SOURCES** of headed mode activation that explain why the Electron application continues to spawn visible windows despite attempts to fix it.

## Critical Findings

### 1. **MAIN CULPRIT: Individual Test Files with Direct Electron Launches**
Several test files launch Electron **DIRECTLY WITHOUT HEADLESS FLAGS**, bypassing the global Playwright configuration:

#### **Problematic Test Files:**
- `/tests/e2e/orleans-screenshot-test.spec.ts` (lines 16-24)
- `/tests/e2e/orleans-progress-test.spec.ts` (lines 16-24) 
- `/tests/e2e/orleans-fresh-test.spec.ts` (lines 16-24)
- `/tests/e2e/cache-corruption-fix.spec.ts` (lines 12-18)

#### **Critical Issue:**
```typescript
// THESE LAUNCHES IGNORE HEADLESS CONFIG
electronApp = await electron.launch({
    args: [path.join(process.cwd(), 'dist/main/main.js')],
    cwd: process.cwd(),
    env: { 
        ...process.env, 
        NODE_ENV: 'test',
        ELECTRON_USER_DATA: userDataPath
    }
    // ❌ NO --headless FLAG OR headless: true OPTION
});
```

### 2. **package.json Script Vulnerabilities**
The npm scripts have multiple avenues for headed mode:

#### **Development Scripts:**
```json
"dev:headless": "npm run dev:renderer && concurrently --names \"MAIN,RENDERER\" --prefix-colors \"yellow,cyan\" \"npm run dev:main:headless\" \"npm run dev:renderer:watch\""
```
- ✅ `dev:main:headless` includes `--headless` flag
- ❌ BUT `dev` script doesn't use headless variant

#### **Test Scripts:**
```json
"test:e2e:headed": "npm run build && npx playwright test --headed",
"test:e2e:debug": "npm run build && npx playwright test --debug"
```
- ❌ Explicit headed mode scripts that can be accidentally triggered

### 3. **main.ts Headless Detection Logic**
The main process has sophisticated headless detection BUT it's not bulletproof:

#### **Current Logic (lines 40-43):**
```typescript
const isHeadless = process.argv.includes('--headless') || 
                   process.env.NODE_ENV === 'test' ||
                   process.env.DISPLAY === ':99' || // Playwright test display
                   process.env.CI === 'true';
```

#### **Window Creation Logic (lines 58-69):**
```typescript
show: false, // Never show initially
...(isHeadless && {
    x: -2000, // Move off-screen
    y: -2000,
    skipTaskbar: true,
    minimizable: false,
    maximizable: false,
    resizable: false,
    opacity: 0, // Make completely transparent
    focusable: false, // Prevent focus
    alwaysOnTop: false, // Ensure it stays in background
}),
```

#### **Show Window Logic (lines 160-166):**
```typescript
mainWindow.once('ready-to-show', () => {
    // CRITICAL: Never show window during tests or headless mode
    if (!isHeadless && process.env.NODE_ENV !== 'test') {
        mainWindow?.show(); // ❌ THIS CAN STILL EXECUTE
    }
});
```

### 4. **Playwright Configuration Conflicts**
While the global Playwright config has `headless: true`, individual test files override this:

#### **Global Config (playwright.config.ts):**
```typescript
use: {
    headless: true, // ✅ CRITICAL: Always headless
}
```

#### **Helper Config (tests/e2e/helpers/electron.ts):**
```typescript
const electronApp = await electron.launch({
    args: [
        path.join(__dirname, '../../../dist/main/main.js'), 
        '--headless', // ✅ Correct
        // ... other args
    ],
    env: {
        NODE_ENV: 'test',
        DISPLAY: ':99' // ✅ Correct
    },
    headless: true, // ✅ Correct
});
```

### 5. **Environment Variable Bypass Scenarios**
The headless detection can be bypassed in several scenarios:

#### **Dangerous Scenarios:**
1. Running tests with `NODE_ENV=development` instead of `test`
2. Setting `DISPLAY` to something other than `:99`
3. Running without `CI=true` in CI environments
4. Direct electron launches without proper environment variables

### 6. **Captcha Window Creation**
The main.ts includes captcha window creation (lines 656-744) that **ALWAYS SHOWS VISIBLY**:

```typescript
const captchaWindow = new BrowserWindow({
    // ... config
    show: false // Initially hidden
});

captchaWindow.once('ready-to-show', () => {
    captchaWindow.show(); // ❌ ALWAYS SHOWS VISIBLY
});
```

## Root Cause Analysis

### **Primary Issue: Test File Inconsistency**
The main problem is **inconsistent electron launching patterns** across test files:

1. **Global Helper**: Uses proper headless configuration
2. **Individual Tests**: Launch electron directly without headless flags
3. **Mixed Approaches**: Some tests use helper, others don't

### **Secondary Issue: Environment Variable Dependency**
The headless detection relies on environment variables that can be:
- Overridden by user settings
- Missing in certain execution contexts
- Incorrectly set by development tools

### **Tertiary Issue: Conditional Logic Gaps**
The `isHeadless` detection doesn't account for:
- Partial environment variable presence
- Development vs. test mode confusion
- Third-party tool interference

## Recommended Solutions

### **IMMEDIATE FIXES (Critical Priority)**

#### **1. Fix Individual Test Files**
Add headless configuration to ALL direct electron launches:

```typescript
// FOR EACH PROBLEMATIC TEST FILE
electronApp = await electron.launch({
    args: [
        path.join(process.cwd(), 'dist/main/main.js'),
        '--headless', // ✅ ADD THIS
        '--no-sandbox',
        '--disable-dev-shm-usage'
    ],
    env: { 
        ...process.env, 
        NODE_ENV: 'test',
        DISPLAY: ':99' // ✅ ADD THIS
    },
    headless: true // ✅ ADD THIS
});
```

#### **2. Enforce Consistent Test Helper Usage**
Modify all test files to use the centralized electron helper instead of direct launches.

#### **3. Strengthen Headless Detection**
Enhance the `isHeadless` logic in main.ts:

```typescript
const isHeadless = process.argv.includes('--headless') || 
                   process.env.NODE_ENV === 'test' ||
                   process.env.DISPLAY === ':99' ||
                   process.env.CI === 'true' ||
                   process.argv.includes('--no-sandbox') || // Additional detection
                   !!process.env.PLAYWRIGHT_TEST_ID; // Playwright-specific
```

#### **4. Remove Dangerous Scripts**
Either remove or rename the headed test scripts:

```json
// REMOVE THESE ENTIRELY OR RENAME THEM
"test:e2e:headed": "npm run build && npx playwright test --headed",
"test:e2e:debug": "npm run build && npx playwright test --debug"
```

### **SECONDARY FIXES (High Priority)**

#### **5. Add Failsafe Window Creation**
Modify the window creation to be more defensive:

```typescript
// NEVER SHOW WINDOW IF ANY TEST INDICATORS PRESENT
const isDefinitelyTest = process.env.NODE_ENV === 'test' ||
                        process.argv.some(arg => arg.includes('test')) ||
                        process.env.DISPLAY === ':99' ||
                        process.env.CI === 'true';

mainWindow.once('ready-to-show', () => {
    if (!isHeadless && !isDefinitelyTest) {
        mainWindow?.show();
    }
});
```

#### **6. Add Process Detection**
Implement process-based detection for test runners:

```typescript
const isRunByTestRunner = process.argv[0].includes('node') && 
                         (process.argv[1].includes('playwright') || 
                          process.argv[1].includes('test'));
```

### **PREVENTIVE MEASURES (Medium Priority)**

#### **7. Lint Rules**
Add ESLint rules to prevent headed mode in tests:

```json
"rules": {
    "no-headed-electron-in-tests": "error"
}
```

#### **8. CI/CD Validation**
Add CI checks that fail if headed mode is detected:

```bash
# Add to GitHub Actions
grep -r "headed.*true\|show.*true" tests/ && exit 1 || echo "Headless validation passed"
```

## Impact Assessment

### **Current Risk Level: CRITICAL**
- ✅ Playwright global config correctly set to headless
- ❌ Individual test files bypass global configuration
- ❌ Multiple test files launch electron in headed mode
- ❌ Environment variable detection has gaps
- ❌ Captcha windows always show visibly

### **Security/Privacy Concerns**
- User screen-sharing sessions are compromised by unexpected browser windows
- Test automation can be disrupted by visible windows
- Development workflow is interrupted by popup windows

### **Affected Components**
- Orleans screenshot tests
- Orleans progress tests  
- Orleans fresh tests
- Cache corruption fix tests
- Any future tests using direct electron launches

## Conclusion

The stubborn headed mode issue is caused by **multiple independent test files launching Electron directly** without proper headless configuration, effectively bypassing the global Playwright settings. While the main application logic has sophisticated headless detection, individual test files circumvent this entirely.

The fix requires **systematic correction of ALL test files** that launch Electron directly, plus strengthening the headless detection logic to be more defensive against edge cases.

## Files Requiring Immediate Attention

1. `/tests/e2e/orleans-screenshot-test.spec.ts`
2. `/tests/e2e/orleans-progress-test.spec.ts` 
3. `/tests/e2e/orleans-fresh-test.spec.ts`
4. `/tests/e2e/cache-corruption-fix.spec.ts`
5. `/src/main/main.ts` (headless detection logic)
6. `/package.json` (remove headed scripts)

**Status: Ready for implementation of permanent fixes**