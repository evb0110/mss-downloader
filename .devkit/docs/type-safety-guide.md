# 🛡️ TypeScript Type Safety Guide

## Overview

This project now has comprehensive type checking to prevent runtime errors like the `loadVatlibManifest is not a function` issue. All builds automatically run type checks, and Claude has special workflows to catch issues before they reach production.

## 🚨 Critical: The loadVatlibManifest Issue

The error `this.loadVatlibManifest is not a function` occurred because:
1. The method didn't exist on the class
2. TypeScript didn't catch it because builds used esbuild (fast but no type checking)
3. The error only appeared at runtime when users tried to download Vatican manuscripts

**This is now prevented by:**
- Automatic type checking before every build
- Pre-commit hooks that verify all method references
- Stricter TypeScript configuration

## 📋 Available Commands

### Basic Type Checking
```bash
# Run type check (fails on errors)
npm run typecheck

# Run type check (continues on errors)
npm run typecheck:silent

# Watch mode (real-time checking)
npm run typecheck:watch

# Generate detailed report
npm run typecheck:report
```

### Automatic Fixing
```bash
# Auto-fix common type errors
npm run typefix

# Pre-commit check (Claude should run this)
npm run precommit
```

### Building
```bash
# Safe build (with type checking)
npm run build

# Unsafe build (skip type checking - NEVER USE IN PRODUCTION)
npm run build:unsafe
```

## 🤖 Claude Workflows

### Before Every Commit

Claude MUST run this before committing:
```bash
npm run precommit
```

This checks for:
- Type errors
- Missing method references
- Null/undefined issues
- Invalid imports
- Explicit 'any' usage

### When Type Errors Occur

1. **Generate Report:**
   ```bash
   npm run typecheck:report
   cat .devkit/reports/typecheck-summary.md
   ```

2. **Try Auto-Fix:**
   ```bash
   npm run typefix
   ```

3. **Manual Fix (if needed):**
   ```bash
   npm run typecheck:watch
   # Fix errors as they appear
   ```

## 🔍 Type Error Categories

### 1. Method Reference Errors (CRITICAL)
**Example:** `this.loadVatlibManifest is not a function`

**Prevention:**
- All methods must exist on the class
- Use `this.sharedManifestAdapter.getManifestForLibrary()` for loaders
- Type checker now catches these at compile time

### 2. Implicit Any
**Example:** `Parameter 'url' implicitly has an 'any' type`

**Fix:**
```typescript
// Before
function fetch(url) { }

// After
function fetch(url: string) { }
```

### 3. Possibly Null/Undefined
**Example:** `Object is possibly 'null'`

**Fix:**
```typescript
// Before
const value = obj.property;

// After
const value = obj?.property;
```

### 4. Missing Properties
**Example:** `Property 'loadVatlibManifest' does not exist`

**Fix:**
- Add the property to the class/interface
- Or use the correct property name

## 📊 Type Check Report

The report shows:
- Total errors by category
- Most problematic files
- Specific examples
- Suggested fixes

Generated at: `.devkit/reports/typecheck-summary.md`

## 🔧 Auto-Fix Capabilities

The `npm run typefix` command can automatically fix:
- Implicit any parameters (infers types from usage)
- Missing imports (adds common imports)
- Optional chaining for null/undefined
- Method reference replacements
- Adding missing properties to interfaces

## ⚙️ Configuration

### Standard Config (`tsconfig.json`)
- Basic strict mode
- Used for development

### Strict Config (`tsconfig.strict.json`)
- All strict checks enabled
- Catches more potential issues
- Use for thorough checking:
  ```bash
  npx tsc --project tsconfig.strict.json --noEmit
  ```

## 🚀 Best Practices

1. **Always run pre-commit check:**
   ```bash
   npm run precommit
   ```

2. **Never use `any` type:**
   ```typescript
   // Bad
   let data: any = {};
   
   // Good
   let data: Record<string, unknown> = {};
   ```

3. **Use optional chaining:**
   ```typescript
   // Bad
   if (obj && obj.prop && obj.prop.value) { }
   
   // Good
   if (obj?.prop?.value) { }
   ```

4. **Type all parameters:**
   ```typescript
   // Bad
   function process(data, options) { }
   
   // Good
   function process(data: string, options: ProcessOptions) { }
   ```

5. **Check method existence:**
   ```typescript
   // Bad
   this.someMethod(); // Method might not exist
   
   // Good
   if ('someMethod' in this && typeof this.someMethod === 'function') {
       this.someMethod();
   }
   ```

## 🔴 Common Issues & Solutions

### Issue: Build fails with type errors
**Solution:**
```bash
npm run typefix       # Try auto-fix
npm run typecheck     # See remaining errors
# Fix manually, then rebuild
```

### Issue: Method not found at runtime
**Solution:**
This should never happen now! Type checking prevents it.
If it does occur:
1. Check if method exists on class
2. Verify correct import
3. Run `npm run typecheck`

### Issue: Too many type errors to fix
**Solution:**
```bash
npm run build:unsafe  # Emergency build (TEMPORARY ONLY)
npm run typefix       # Fix what you can
npm run typecheck:report  # Prioritize critical errors
```

## 📈 Monitoring Type Safety

### Check Current Status
```bash
npm run typecheck:report
```

### View Trends
Reports are saved with timestamps in `.devkit/reports/`

### CI/CD Integration
GitHub Actions automatically runs type checks on every push.

## 🎯 Goal: Zero Type Errors

The project should maintain:
- ✅ No type errors in production builds
- ✅ All methods properly typed
- ✅ No implicit 'any' types
- ✅ Proper null/undefined handling
- ✅ All imports resolved

## 💡 Tips for Claude

1. **Before any commit:** Run `npm run precommit`
2. **After refactoring:** Run `npm run typecheck`
3. **When adding methods:** Ensure they're properly typed
4. **When calling methods:** Verify they exist on the class
5. **Use the auto-fixer:** It handles common issues automatically

## 🔗 Related Documentation

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Strict Mode](https://www.typescriptlang.org/tsconfig#strict)
- [ESLint TypeScript Plugin](https://typescript-eslint.io/)

---

**Remember:** Type safety prevents runtime errors. The `loadVatlibManifest` issue is now impossible with proper type checking!