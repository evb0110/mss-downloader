# Handle All GitHub Issues - AUTONOMOUS WORKFLOW

**⚠️ SPECIAL AUTONOMOUS WORKFLOW - EXCEPTION TO NORMAL RULES ⚠️**

This command implements an AUTONOMOUS issue-fixing workflow that:
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
**AGENT USAGE**: Use up to 3-5 agents in parallel for one issue (not multiple issues)

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

## Validation Script Template:
```javascript
const { SharedManifestLoaders } = require('./src/shared/SharedManifestLoaders.js');
const fs = require('fs').promises;
const { execSync } = require('child_process');

async function validateIssueFix(issueNumber, testUrl, expectedBehavior) {
    console.log(`Validating fix for issue #${issueNumber}...`);
    
    try {
        // Test the specific fix
        const loaders = new SharedManifestLoaders();
        const manifest = await loaders.getManifestForUrl(testUrl);
        
        // Download test pages
        // ... download logic ...
        
        // Verify with poppler
        execSync('pdfinfo test.pdf');
        
        // Check specific issue is resolved
        if (expectedBehavior) {
            console.log('✅ Issue #' + issueNumber + ' fixed!');
            return true;
        }
    } catch (error) {
        console.error('❌ Validation failed:', error.message);
        return false;
    }
}
```

## Important Guidelines:
- **NO MANUAL VALIDATION**: Everything must be verified programmatically
- **NO USER APPROVAL**: Version bump is automatic after validation passes
- **ISSUE AUTHOR APPROVAL**: We seek approval from issue authors, not Claude user
- **QUALITY GATES**: Lint and build must pass before any commit
- **RUSSIAN COMMUNICATION**: All issue comments must be in Russian
- **SPECIFIC EXPLANATIONS**: Each issue gets a unique, specific explanation

## Conflict Resolution:
This autonomous workflow OVERRIDES the following normal rules:
- "WAIT for mandatory user validation of PDF files" → Validation is programmatic
- "NEVER BUMP VERSION WITHOUT EXPLICIT USER APPROVAL" → Bump is automatic
- "MANDATORY validation by user!!!" → Self-validation only
- "ONLY OPEN FINDER WHEN READY" → Never open Finder in this workflow

Remember: This is an EXCEPTION workflow designed for autonomous issue resolution. The goal is to fix issues quickly and get approval from issue authors, not the Claude user.