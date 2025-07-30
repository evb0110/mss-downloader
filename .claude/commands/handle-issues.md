# Handle All GitHub Issues - AUTONOMOUS WORKFLOW v2.0

**Preliminary**
- if `jq` isn't installed on the computer, install it
- if `gh` isn't installed, install it and ask user to authorize and use it to access issues
- always use `gh` to download issues and attached logs or other files

**⚠️ CRITICAL LESSONS LEARNED FROM v1.4.49 FAILURE ⚠️**
- NEVER create isolated test scripts - ALWAYS use production code
- NEVER test with "known good" URLs - ALWAYS use exact user-reported URLs
- NEVER declare success without reproducing and fixing the actual user errors
- NEVER implement superficial fixes - ALWAYS find and fix root causes

**⚠️ SPECIAL AUTONOMOUS WORKFLOW - EXCEPTION TO NORMAL RULES ⚠️**

This command implements an AUTONOMOUS issue-fixing workflow that:
- MUST use production code for ALL testing (no isolated scripts)
- MUST test with EXACT URLs from user reports
- MUST reproduce user errors before declaring them fixed
- Does NOT require Claude user approval for version bumps
- Performs all validation programmatically (no Finder, no user validation)
- Seeks approval from ISSUE AUTHORS, not the Claude user
- Overrides normal version bump approval requirements

## FIRST: Check Existing Issues Status
**ALWAYS START BY CHECKING ISSUE RESPONSES:**
```bash
.devkit/tools/check-issue-responses.sh
```

Then for each issue that needs follow-up:
1. If fix was posted but no author response yet AND no follow-up tag exists:
   - Tag the author asking them to test the fix
2. If follow-up tag exists and 3+ days passed with no response:
   - Close the issue with explanation
3. If author responded:
   - Handle based on their feedback

## General Requirements:
**TOP PRIORITY**: Fix all bugs without breaking existing functionality
**BACKWARD COMPATIBILITY**: All fixes must be backward compatible
**AUTONOMOUS VALIDATION**: All validation must be done programmatically
**NO SUBAGENTS**: Work consecutively through all tasks - do NOT use subagents or parallel processing

## Autonomous Process:

### Phase 1: Issue Analysis & Fixing
1. **Fetch all open issues** from GitHub
2. **Analyze each issue** to identify root causes
3. **Implement fixes** systematically (one issue at a time)
4. **Create test scripts** that validate each fix programmatically

### Phase 2: Autonomous Validation (NO USER INTERACTION)
For each fix, you MUST:

1. **Create validation scripts** that:
   - Use the exact URLs from the issue reports
   - Download 5-10 pages programmatically
   - Verify the specific error is resolved
   - Check PDF validity with poppler
   - Return success/failure status

2. **Self-inspect all PDFs** using:
   ```bash
   # Check file sizes
   ls -la validation/*.pdf
   
   # Verify PDF structure
   pdfimages -list validation/*.pdf
   
   # Extract and inspect sample images
   pdfimages -png -f 1 -l 3 validation/*.pdf validation/test
   ```

3. **Validation criteria** (must ALL pass):
   - No zero-byte files
   - PDF contains actual images (not error pages)
   - Multiple different pages when expected
   - No authentication errors
   - Specific issue error is resolved

4. **If ANY validation fails**:
   - Fix the issue
   - Re-run validation
   - Repeat until 100% success

### Phase 3: Autonomous Version Bump (NO USER APPROVAL)
**ONLY after ALL validations pass:**

1. **Pre-bump checks:**
   ```bash
   npm run lint      # Must pass with no errors
   npm run build     # Must complete successfully
   ```

2. **Update package.json:**
   - Bump patch version
   - Update changelog with specific fixes

3. **Commit and push:**
   ```bash
   git add -A
   git commit -m "VERSION-X.X.X: Fix critical GitHub issues - [list libraries]"
   git push origin main
   ```

### Phase 4: Issue Author Notification
1. **Add fix comments** to each issue in Russian:
   ```
   ✅ **Исправлено в версии X.X.X!** 🎉
   
   [Конкретное объяснение того, что было исправлено]
   
   **Что было исправлено:**
   - [Техническое описание на русском]
   - [Улучшения и изменения]
   
   **Результаты проверки:** ✅ [Статус тестирования]
   
   Пожалуйста, обновитесь до версии X.X.X и проверьте, что всё работает корректно.
   
   Новая версия будет доступна через несколько минут после автоматической сборки.
   ```

2. **Monitor responses** using check-issue-responses.sh

3. **Follow up as needed:**
   - Tag non-responsive authors after initial comment
   - Close issues after 3 days of no response
   - Continue fixing if authors report problems

## MANDATORY PRODUCTION CODE TEST FRAMEWORK

### Step 1: Create Production Test Framework FIRST
**CRITICAL**: Before ANY fixes, create a test framework that uses ACTUAL production code:

```javascript
// File: .devkit/test-scripts/production-code-test-framework.js
// #!/usr/bin/env node

/**
 * MANDATORY: This framework tests the ACTUAL production code directly
 * NO isolated test scripts allowed - just the real code
 */

const path = require('path');
const fs = require('fs');

// Import the ACTUAL production SharedManifestLoaders
const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

// Test configuration with EXACT user URLs from GitHub issues
const USER_REPORTED_URLS = {
    // COPY EXACT URLs FROM GITHUB ISSUES - NO MODIFICATIONS
    libraryName: {
        issue: '#X',
        userUrl: 'EXACT URL FROM ISSUE',
        userError: 'EXACT ERROR MESSAGE FROM USER',
        expectedBehavior: 'What should happen'
    }
};

class ProductionCodeTester {
    constructor() {
        this.manifestLoaders = new SharedManifestLoaders();
        this.results = {};
    }

    async testLibrary(libraryId, config) {
        console.log(`Testing ${libraryId} with EXACT user URL: ${config.userUrl}`);
        
        try {
            // Use ACTUAL production code to detect library
            const detectedLibrary = this.detectLibrary(config.userUrl);
            
            // Call ACTUAL production manifest loader
            const manifest = await this.manifestLoaders.getManifestForLibrary(
                detectedLibrary, 
                config.userUrl
            );
            
            console.log('✅ SUCCESS: Production code loaded manifest');
            return { success: true, manifest };
            
        } catch (error) {
            console.log(`❌ FAILED: ${error.message}`);
            
            // CRITICAL: Check if this matches user-reported error
            if (error.message.includes(config.userError)) {
                console.log('⚠️ REPRODUCED USER ERROR - This needs fixing!');
            }
            
            return { success: false, error: error.message };
        }
    }
    
    detectLibrary(url) {
        // MUST match production detection logic EXACTLY
        // Copy from actual production code, don't reinvent
    }
}
```

### Step 2: REPRODUCE User Errors First
**MANDATORY**: Before fixing ANYTHING, you MUST:
1. Run the test framework with EXACT user URLs
2. REPRODUCE the exact errors users report
3. Identify the SPECIFIC line of production code failing
4. Document the root cause

### Step 3: Fix Root Causes in Production Code
**ONLY fix issues in the actual source files**:
- `src/shared/SharedManifestLoaders.js`
- `src/main/services/*.ts`
- Other production files

**NEVER create workaround scripts or test-only fixes**

### Step 4: Validate with Production Test Framework
Run the SAME test framework after fixes to ensure:
1. All user URLs now work
2. No regressions in other libraries
3. Production code actually changed

## MANDATORY SAFEGUARDS (LESSONS FROM v1.4.49 FAILURE)

### 1. URL Testing Requirements
- **EXACT URLS ONLY**: Copy URLs character-by-character from GitHub issues
- **NO URL MODIFICATIONS**: Don't "fix" or "clean up" user URLs
- **REPRODUCE FIRST**: Must reproduce exact user error before fixing
- **TEST AFTER FIX**: Must verify error is gone with same URL

### 2. Code Testing Requirements  
- **PRODUCTION CODE ONLY**: Import and use actual src/ files
- **NO ISOLATED SCRIPTS**: Never create standalone test implementations
- **NO MOCK DATA**: Use real manifest loaders, real fetch logic
- **MATCH PRODUCTION**: Test environment must match Electron exactly

### 3. Root Cause Analysis
- **DEBUG FIRST**: Add console.log to production code to find failure point
- **UNDERSTAND WHY**: Document why the error occurs
- **FIX SOURCE**: Only fix in production source files
- **NO WORKAROUNDS**: Fix the actual problem, not symptoms

### 4. Evidence Requirements
- **BEFORE**: Show exact error with user URL
- **AFTER**: Show success with same URL
- **LOGS**: Include detailed console output
- **MANIFEST DATA**: Show actual loaded manifest structure

## Important Guidelines:
- **NO MANUAL VALIDATION**: Everything must be verified programmatically
- **NO USER APPROVAL**: Version bump is automatic after validation passes
- **ISSUE AUTHOR APPROVAL**: We seek approval from issue authors, not Claude user
- **QUALITY GATES**: Lint and build must pass before any commit
- **RUSSIAN COMMUNICATION**: All issue comments must be in Russian
- **SPECIFIC EXPLANATIONS**: Each issue gets a unique, specific explanation
- **PRODUCTION CODE TESTING**: All validation MUST use actual production code

## Conflict Resolution:
This autonomous workflow OVERRIDES the following normal rules:
- "WAIT for mandatory user validation of PDF files" → Validation is programmatic
- "NEVER BUMP VERSION WITHOUT EXPLICIT USER APPROVAL" → Bump is automatic
- "MANDATORY validation by user!!!" → Self-validation only
- "ONLY OPEN FINDER WHEN READY FOR FINAL USER VALIDATION" → **NEVER OPEN FINDER** in this workflow

BUT ENFORCES these critical rules:
- **ALWAYS use production code for testing** (no exceptions)
- **ALWAYS test exact user URLs** (no "better" URLs)
- **ALWAYS reproduce errors first** (no assuming)
- **ALWAYS fix root causes** (no bandaids)

## CRITICAL: NO FINDER/FILE MANAGER OPENING
- **NEVER use shell.openItem, shell.openPath, shell.showItemInFolder**
- **NEVER open file manager or Finder windows**
- **NEVER use commands like `open` (macOS) or `explorer` (Windows)**
- All validation results are saved to files only
- Users do NOT inspect PDFs manually in this autonomous workflow

Remember: This is an EXCEPTION workflow designed for autonomous issue resolution. The goal is to fix issues quickly and get approval from issue authors, not the Claude user.

## FINAL CHECKLIST BEFORE VERSION BUMP

- [ ] Created production code test framework (not isolated scripts)
- [ ] Used EXACT URLs from user reports (character-for-character)
- [ ] Reproduced ALL user errors before fixing
- [ ] Fixed root causes in production source files
- [ ] Validated ALL user URLs work after fixes
- [ ] No workarounds or test-only code
- [ ] Lint and build pass
- [ ] Test results show 100% success with user URLs

If ANY checkbox is not complete, DO NOT bump version.