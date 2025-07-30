# Mandatory Development Workflow - Enforced After v1.4.49 Failure

## 🚨 THIS WORKFLOW IS MANDATORY - NO EXCEPTIONS 🚨

### Background
In v1.4.49, a catastrophic failure occurred where we claimed to fix all user issues but actually fixed NONE. This happened because test scripts didn't use production code and didn't test actual failing URLs. This document enforces a workflow to prevent this from EVER happening again.

## Phase 1: Problem Understanding (BEFORE ANY CODE CHANGES)

### 1.1 Collect Exact User Information
```bash
# For GitHub issues
gh issue view <number> --comments

# Download any attachments
gh api repos/<owner>/<repo>/issues/<number>/comments --jq '.[] | .body' | \
  grep -o 'https://github.com/user-attachments/files/[^)]*' | \
  xargs -I {} curl -L {} -o user-log.json
```

**MANDATORY**: Copy these EXACTLY:
- User URL (character-by-character, including trailing slashes)
- User error message (exact text)
- Any log files or screenshots

### 1.2 Create Production Test Framework FIRST
```javascript
// File: .devkit/test-scripts/issue-reproduction.js
const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

const USER_URLS = {
    libraryName: {
        issue: '#123',
        userUrl: 'EXACT_URL_FROM_USER',  // Copy EXACTLY
        userError: 'EXACT_ERROR_FROM_USER' // Copy EXACTLY
    }
};

async function reproduceIssue() {
    const loaders = new SharedManifestLoaders();
    
    for (const [library, config] of Object.entries(USER_URLS)) {
        console.log(`\nTesting ${library} with user URL: ${config.userUrl}`);
        
        try {
            // Detect library using production code
            const detectedLib = detectLibrary(config.userUrl); // Use production detection
            
            // Call production loader
            const manifest = await loaders.getManifestForLibrary(detectedLib, config.userUrl);
            
            console.log('❌ UNEXPECTED SUCCESS - User reported this fails!');
            
        } catch (error) {
            console.log('✅ REPRODUCED USER ERROR:', error.message);
            
            if (error.message.includes(config.userError)) {
                console.log('✅ EXACT ERROR MATCH');
            } else {
                console.log('⚠️ Different error than user reported');
            }
        }
    }
}
```

### 1.3 Reproduce ALL Errors
**MANDATORY CHECKLIST**:
- [ ] Test framework uses ACTUAL production code (no mocks)
- [ ] URLs are EXACTLY as users provided
- [ ] Can reproduce EVERY reported error
- [ ] Documented which line of production code fails

## Phase 2: Root Cause Analysis

### 2.1 Debug Production Code
Add console.log to production files to trace execution:

```javascript
// In src/shared/SharedManifestLoaders.js
async getVeronaManifest(url) {
    console.log('[DEBUG] Verona URL:', url);
    console.log('[DEBUG] Extracting codice...');
    // ... existing code
}
```

### 2.2 Identify Root Causes
**DOCUMENT THESE**:
- WHAT fails (exact error)
- WHERE it fails (file and line number)
- WHY it fails (root cause)
- HOW to fix (specific change needed)

Example:
```
WHAT: "Verona NBM server connection failed (TIMEOUT)"
WHERE: SharedManifestLoaders.js:304 - manifestUrl uses old server
WHY: Server moved from nbm.regione.veneto.it to www.nuovabibliotecamanoscritta.it
HOW: Update all references to use new server URL
```

## Phase 3: Implement Fixes (IN PRODUCTION CODE ONLY)

### 3.1 Fix Location Rules
**ALLOWED**:
- `src/shared/SharedManifestLoaders.js`
- `src/main/services/*.ts`
- Other production source files

**FORBIDDEN**:
- Test scripts with workarounds
- Isolated implementations
- Mock loaders or adapters

### 3.2 Fix Verification
After EACH fix:
1. Run reproduction test
2. Confirm error is gone
3. Test doesn't break other libraries

## Phase 4: Comprehensive Validation

### 4.1 Test ALL User URLs
```javascript
// Run the SAME test framework
node .devkit/test-scripts/issue-reproduction.js

// Expected output:
// Testing graz with user URL: https://exact-user-url
// ✅ SUCCESS: Loaded manifest with 405 pages
```

### 4.2 Create Evidence
**REQUIRED EVIDENCE**:
1. Console output showing all user URLs work
2. Manifest data proving successful load
3. No errors or warnings
4. 100% success rate

### 4.3 No Regressions
Test other libraries to ensure no breaks:
```javascript
const OTHER_LIBRARIES = {
    vatican: 'https://digi.vatlib.it/view/MSS_Vat.lat.1',
    yale: 'https://collections.library.yale.edu/catalog/2002219',
    // ... more working URLs
};
```

## Phase 5: Pre-Release Checklist

**MANDATORY - ALL MUST BE ✅**:
- [ ] Production test framework created (not isolated scripts)
- [ ] Used EXACT user URLs (no modifications)
- [ ] Reproduced ALL user errors before fixing
- [ ] Fixed root causes in production files
- [ ] All user URLs now work
- [ ] No regression in other libraries
- [ ] npm run lint passes
- [ ] npm run build passes
- [ ] Evidence documented

## 🚫 FORBIDDEN PRACTICES

### NEVER Do These:
1. **Create test-only implementations**
   ```javascript
   // ❌ WRONG
   async function myCustomLoader() { }
   
   // ✅ RIGHT
   const { SharedManifestLoaders } = require('./src/shared/SharedManifestLoaders.js');
   ```

2. **Modify user URLs**
   ```javascript
   // ❌ WRONG
   const testUrl = userUrl.replace('/thumbs', ''); // "fixing" the URL
   
   // ✅ RIGHT
   const testUrl = userUrl; // Use EXACTLY as provided
   ```

3. **Skip reproduction**
   ```javascript
   // ❌ WRONG
   // "I think the problem is X, let me fix it"
   
   // ✅ RIGHT
   // First reproduce the exact error, THEN fix
   ```

4. **Surface-level fixes**
   ```javascript
   // ❌ WRONG
   retries = 15; // Just increase retries
   
   // ✅ RIGHT
   // Found server URL changed, updating to new server
   ```

## 📋 Workflow Summary

1. **REPRODUCE** - See the exact user error with exact user URL
2. **ANALYZE** - Find root cause in production code
3. **FIX** - Change production source files only
4. **VALIDATE** - Confirm all user URLs now work
5. **VERIFY** - Check no regressions
6. **SHIP** - Only after 100% validation

## ⚠️ Final Warning

The v1.4.49 failure damaged user trust. Every claim of "fixed" must be backed by:
- Production code testing
- Exact URL validation
- Root cause fixes
- Comprehensive evidence

If you cannot check ALL boxes, DO NOT claim issues are fixed.

This workflow is MANDATORY for all bug fixes, library additions, and issue resolutions.