# Playwright Test Configuration Analysis: Headed Mode Issue

## Executive Summary

**CRITICAL FINDING**: Multiple test files are directly launching Electron with `electron.launch()` and bypassing the global headless configuration in `playwright.config.ts`. This is the root cause of persistent headed window spawning despite global headless settings.

## Configuration Analysis

### Global Configuration (`playwright.config.ts`)
- **Status**: ✅ Properly configured for headless mode
- **Settings**: 
  - `headless: true` (line 19)
  - `workers: 1` to prevent multiple instances
  - Reporter configured to avoid HTML browser opening
  - Global setup/teardown for process cleanup

### Proper Test Helper (`tests/e2e/helpers/electron.ts`)
- **Status**: ✅ Correctly implements headless mode
- **Configuration**:
  - `headless: true` (line 88)
  - `--headless` flag in args (line 72)
  - `DISPLAY: ':99'` for virtual display (line 83)
  - Comprehensive cleanup mechanisms

## PROBLEM FILES IDENTIFIED

### 1. `tests/e2e/orleans-screenshot-test.spec.ts`
**VIOLATION**: Direct `electron.launch()` call (line 16)
```typescript
electronApp = await electron.launch({
    args: [path.join(process.cwd(), 'dist/main/main.js')],
    // NO headless configuration - defaults to headed mode
});
```
**Impact**: Spawns headed Electron window for Orleans testing

### 2. `tests/e2e/orleans-progress-test.spec.ts`
**VIOLATION**: Direct `electron.launch()` call (line 16)
```typescript
electronApp = await electron.launch({
    args: [path.join(process.cwd(), 'dist/main/main.js')],
    // NO headless configuration - defaults to headed mode
});
```
**Impact**: Spawns headed Electron window for progress testing

### 3. `tests/e2e/orleans-fresh-test.spec.ts`
**VIOLATION**: Direct `electron.launch()` call (line 16)
```typescript
electronApp = await electron.launch({
    args: [path.join(process.cwd(), 'dist/main/main.js')],
    // NO headless configuration - defaults to headed mode
});
```
**Impact**: Spawns headed Electron window for fresh manifest testing

### 4. `tests/e2e/cache-corruption-fix.spec.ts`
**VIOLATION**: Direct `electron.launch()` call (line 12)
```typescript
electronApp = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/main.js')],
    timeout: 30000,
    // NO headless configuration - defaults to headed mode
});
```
**Impact**: Spawns headed Electron window for cache testing

### 5. `tests/electron-test.ts`
**PARTIALLY COMPLIANT**: Has `--headless` flag but missing full configuration
```typescript
electronApp = await electron.launch({
    args: [path.join(__dirname, '../dist/main/main.js'), '--headless'],
    // Missing headless: true property and DISPLAY configuration
});
```

## Root Cause Analysis

The issue occurs because:

1. **Bypassing Global Config**: Direct `electron.launch()` calls ignore `playwright.config.ts` settings
2. **Missing Headless Property**: Files lack `headless: true` in launch options
3. **Missing Environment Variables**: No `DISPLAY: ':99'` for virtual display
4. **Inconsistent Testing Pattern**: Some tests use proper helpers, others use direct launches

## Impact Assessment

- **Security Risk**: ✅ CRITICAL - Browser windows expose user during screen sharing
- **Development Impact**: ✅ HIGH - Dock bloating and window management issues
- **Test Reliability**: ✅ MEDIUM - Different execution environments between tests

## Fix Requirements

For each problematic file, either:

### Option A: Use Proper Test Helper
Replace direct `electron.launch()` with:
```typescript
import { test, expect } from './helpers/electron';
// Uses global headless configuration automatically
```

### Option B: Add Headless Configuration
If direct launch needed, add full headless config:
```typescript
electronApp = await electron.launch({
    args: [path.join(process.cwd(), 'dist/main/main.js'), '--headless'],
    headless: true,
    env: {
        ...process.env,
        NODE_ENV: 'test',
        DISPLAY: ':99'
    }
});
```

## Package.json Script Analysis

The npm scripts are properly configured:
- `test:e2e`: Uses headless mode by default
- `test:e2e:headed`: Explicitly headed (should only be used when requested)
- `test:e2e:debug`: Debug mode (should only be used when requested)

## Recommendations

1. **IMMEDIATE**: Fix the 4 problematic test files by adding proper headless configuration
2. **POLICY**: Establish coding standard requiring all tests to use the common helper
3. **VALIDATION**: Add linting rule to prevent direct `electron.launch()` without headless config
4. **DOCUMENTATION**: Update test guidelines to mandate headless-first development

## Files Requiring Updates

1. `tests/e2e/orleans-screenshot-test.spec.ts` - Add headless config
2. `tests/e2e/orleans-progress-test.spec.ts` - Add headless config  
3. `tests/e2e/orleans-fresh-test.spec.ts` - Add headless config
4. `tests/e2e/cache-corruption-fix.spec.ts` - Add headless config
5. `tests/electron-test.ts` - Complete headless config (add `headless: true` property)

## Verification Steps

After fixes:
1. Run each problematic test individually
2. Verify no Electron windows appear in dock
3. Confirm tests still pass with headless execution
4. Test on user's screen sharing setup to validate privacy protection

This analysis definitively identifies why headed windows persist despite global configuration - direct electron launches bypass the global settings entirely.