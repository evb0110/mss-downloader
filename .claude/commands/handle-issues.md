# Handle All GitHub Issues - AUTONOMOUS WORKFLOW v3.0

**Preliminary**
- if `jq` isn't installed on the computer, install it
- if `gh` isn't installed, install it and ask user to authorize and use it to access issues
- always use `gh` to download issues and attached logs or other files

**⚠️ CRITICAL LESSONS LEARNED ⚠️**
- **v1.4.49 FAILURE**: Never create isolated test scripts - ALWAYS use production code
- **v1.4.54-55 FAILURE**: Never assume issue ranges - ALWAYS fetch ALL open issues
- NEVER test with "known good" URLs - ALWAYS use exact user-reported URLs
- NEVER declare success without reproducing and fixing the actual user errors
- NEVER implement superficial fixes - ALWAYS find and fix root causes

**⚠️ SPECIAL AUTONOMOUS WORKFLOW - EXCEPTION TO NORMAL RULES ⚠️**

This command implements an AUTONOMOUS issue-fixing workflow that:
- MUST fetch and handle ALL open issues comprehensively
- MUST use production code for ALL testing (no isolated scripts)
- MUST test with EXACT URLs from user reports
- MUST reproduce user errors before declaring them fixed
- Does NOT require Claude user approval for version bumps
- Performs all validation programmatically (no Finder, no user validation)
- Seeks approval from ISSUE AUTHORS, not the Claude user
- Overrides normal version bump approval requirements

## CRITICAL EVB0110 FILTERING - PREVENT DUPLICATE WORK

**🚨 ULTRA-CRITICAL**: Before processing ANY issues, implement bulletproof filtering to prevent processing issues already addressed by evb0110 (Claude).

### EVB0110 Filtering Functions
```bash
# Check who was the last commenter on an issue
get_last_commenter() {
    local issue_num=$1
    gh api "repos/evb0110/mss-downloader/issues/$issue_num/comments" --jq '.[-1].user.login' 2>/dev/null || echo "none"
}

# Get timestamp of last comment
get_last_comment_time() {
    local issue_num=$1
    gh api "repos/evb0110/mss-downloader/issues/$issue_num/comments" --jq '.[-1].created_at' 2>/dev/null || echo "none"
}

# Determine if issue should be skipped (evb0110 already responded)
should_skip_issue() {
    local issue_num=$1
    local last_commenter=$(get_last_commenter $issue_num)
    
    if [ "$last_commenter" = "evb0110" ]; then
        echo "true"  # Skip - Claude already responded
    else
        echo "false" # Process - needs Claude's attention
    fi
}

# Check if issue was recently addressed by Claude
is_recently_addressed() {
    local issue_num=$1
    local last_commenter=$(get_last_commenter $issue_num)
    local last_comment_time=$(get_last_comment_time $issue_num)
    
    if [ "$last_commenter" = "evb0110" ]; then
        if [ "$last_comment_time" != "none" ]; then
            local comment_epoch=$(date -d "$last_comment_time" +%s 2>/dev/null || echo "0")
            local current_epoch=$(date +%s)
            local hours_diff=$(( (current_epoch - comment_epoch) / 3600 ))
            
            if [ $hours_diff -le 48 ]; then
                echo "true"  # Recently addressed
            else
                echo "false" # Old response, might need follow-up
            fi
        else
            echo "false"
        fi
    else
        echo "false"
    fi
}

# Filter issues to only those needing Claude's attention
filter_issues_needing_attention() {
    local input_file=$1
    local output_file=$2
    
    echo "🔍 Filtering issues to find those needing Claude's attention..."
    echo "["
    
    local first=true
    local total_issues=0
    local skipped_count=0
    local processable_count=0
    
    while IFS= read -r issue_json; do
        local issue_num=$(echo "$issue_json" | jq -r '.number')
        local issue_title=$(echo "$issue_json" | jq -r '.title')
        local issue_author=$(echo "$issue_json" | jq -r '.author.login')
        
        total_issues=$((total_issues + 1))
        
        local should_skip=$(should_skip_issue $issue_num)
        local last_commenter=$(get_last_commenter $issue_num)
        local recently_addressed=$(is_recently_addressed $issue_num)
        
        if [ "$should_skip" = "true" ]; then
            echo "   ⏭️  Skipping Issue #$issue_num: '$issue_title' (evb0110 last commenter: $last_commenter, recent: $recently_addressed)"
            skipped_count=$((skipped_count + 1))
        else
            echo "   ✅ Issue #$issue_num: '$issue_title' needs attention (last commenter: $last_commenter)"
            
            if [ "$first" = "true" ]; then
                first=false
            else
                echo ","
            fi
            echo "$issue_json"
            processable_count=$((processable_count + 1))
        fi
    done < <(cat "$input_file" | jq -c '.[]')
    
    echo "]"
    
    echo ""
    echo "📊 FILTERING SUMMARY:"
    echo "   Total open issues: $total_issues"
    echo "   Skipped (evb0110 already responded): $skipped_count"
    echo "   Available for processing: $processable_count"
    echo ""
    
    if [ $processable_count -eq 0 ]; then
        echo "🎉 ALL ISSUES ALREADY ADDRESSED!"
        echo ""
        echo "All open issues have evb0110 as the last commenter, meaning:"
        echo "- Claude has already responded to every issue"
        echo "- Issues are waiting for user feedback"
        echo "- No immediate action needed"
        echo ""
        echo "🛑 STOPPING: No issues need processing at this time"
        return 1
    fi
    
    return 0
}

# Debug function to show current issue state
debug_all_issue_filtering() {
    echo "=== COMPREHENSIVE ISSUE FILTERING DEBUG ==="
    
    for issue_num in $(gh issue list --state open --json number --jq '.[].number'); do
        local last_commenter=$(get_last_commenter $issue_num)
        local should_skip=$(should_skip_issue $issue_num)
        local recently_addressed=$(is_recently_addressed $issue_num)
        local comment_time=$(get_last_comment_time $issue_num)
        local issue_title=$(gh issue view $issue_num --json title --jq '.title' 2>/dev/null || echo "unknown")
        
        printf "Issue #%d: %-20s | last: %-12s | skip: %-5s | recent: %-5s | time: %s\n" \
               "$issue_num" "$issue_title" "$last_commenter" "$should_skip" "$recently_addressed" "$comment_time"
    done
    
    echo "=== END DEBUG ==="
    echo ""
}
```

## MANDATORY FIRST STEP: Comprehensive Issue Discovery WITH FILTERING

### Step 1: Fetch ALL Open Issues AND Filter Out Already-Addressed Issues
```bash
# MANDATORY: Get ALL open issues, save to file for reference
gh issue list --state open --json number,title,body,author,comments --limit 100 > .devkit/all-open-issues.json

echo "📋 All open issues found:"
cat .devkit/all-open-issues.json | jq -r '.[] | "Issue #\(.number): \(.title)"' | sort -t'#' -k2 -n
echo ""

# CRITICAL: Apply evb0110 filtering to prevent duplicate work
echo "🚨 APPLYING CRITICAL EVB0110 FILTERING..."
debug_all_issue_filtering

# Filter to only issues needing Claude's attention
if ! filter_issues_needing_attention .devkit/all-open-issues.json .devkit/filtered-issues.json; then
    echo "✅ All issues already addressed - no work needed!"
    exit 0
fi

# Update the working file to only include filtered issues
mv .devkit/filtered-issues.json .devkit/all-open-issues.json

echo "📋 Issues needing attention after filtering:"
cat .devkit/all-open-issues.json | jq -r '.[] | "Issue #\(.number): \(.title)"' | sort -t'#' -k2 -n
```

### Step 2: Explicitly List FILTERED Issues That Need Processing
**REQUIRED OUTPUT FORMAT (after filtering):**
```
Found 9 total open issues.
After evb0110 filtering: 2 issues need processing:
- Issue #4: морган (last commenter: textorhub)
- Issue #6: Бордо (last commenter: textorhub)

Skipped 7 issues already addressed by evb0110:
- Issue #2: грац (evb0110 responded 2025-08-01)
- Issue #37: Линц (evb0110 responded 2025-08-21)
- Issue #38: Digital Walters (evb0110 responded 2025-08-21)
- Issue #39: флоренция (evb0110 responded 2025-08-21)
- Issue #43: гренобль (evb0110 responded 2025-08-21)
- Issue #54: амброзиана (evb0110 responded 2025-08-21)
- Issue #57: Codices (evb0110 responded 2025-08-21)

Will now process ONLY the 2 issues needing attention...
```

### Step 3: Build Comprehensive Test Cases
```javascript
// MANDATORY: Build test cases from ALL fetched issues
const allIssues = JSON.parse(fs.readFileSync('.devkit/all-open-issues.json'));
console.log(`Building test cases for ALL ${allIssues.length} issues...`);

const TEST_CASES = {};
for (const issue of allIssues) {
    // Extract URL and error from issue body
    const urlMatch = issue.body.match(/https?:\/\/[^\s]+/);
    const errorMatch = issue.body.match(/Error[^:]*: (.+?)(?:https|$)/);
    
    TEST_CASES[`issue_${issue.number}`] = {
        issue: `#${issue.number}`,
        title: issue.title,
        url: urlMatch ? urlMatch[0] : null,
        error: errorMatch ? errorMatch[1] : issue.body,
        author: issue.author.login
    };
}

console.log(`Created ${Object.keys(TEST_CASES).length} test cases`);
```

## FIRST: Check Existing Issues Status
**ALWAYS START BY CHECKING ISSUE RESPONSES:**
```bash
# Check if script exists, if not, create it
if [ ! -f .devkit/tools/check-issue-responses.sh ]; then
    echo "Creating check-issue-responses.sh..."
    # Create the script
fi

.devkit/tools/check-issue-responses.sh || echo "Script not found, proceeding without it"
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
**COMPREHENSIVE**: MUST handle ALL open issues, not a subset

## Autonomous Process:

### Phase 1: Issue Analysis & Fixing
1. **Fetch ALL open issues** from GitHub (see MANDATORY FIRST STEP above)
2. **List ALL issues found** - explicitly show every issue number
3. **Analyze each issue** to identify root causes
4. **Implement fixes** systematically (one issue at a time)
5. **Create test scripts** that validate each fix programmatically

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

### Phase 3: Comprehensive Summary BEFORE Version Bump
**MANDATORY: Show status of ALL issues:**
```
=== COMPREHENSIVE ISSUE RESOLUTION SUMMARY ===
Total open issues found: 12

FIXED in this version:
✅ Issue #2 (грац) - Fixed URL pattern recognition
✅ Issue #10 (Цюрих) - Added e-manuscripta support
✅ Issue #12 (каталония) - Fixed library detection

ALREADY WORKING (verified):
✅ Issue #3 (верона) - Working correctly, temporary network issue
✅ Issue #4 (морган) - Working correctly
✅ Issue #5 (Флоренция) - Working correctly
✅ Issue #8 (Бодлеянская) - Fixed in previous version
✅ Issue #9 (BDL) - Working correctly, DNS resolved
✅ Issue #11 (BNE) - Working correctly, no hanging
✅ Issue #13 (гренобль) - SSL bypass already implemented

NEEDS MORE WORK:
⚠️ Issue #6 (Бордо) - Partial support, needs page detection improvement
⚠️ Issue #7 (Бодлеянская) - Duplicate of #8, needs clarification

Issues addressed: 12/12
Ready for version bump: YES/NO
```

### Phase 4: Autonomous Version Bump (NO USER APPROVAL)
**ONLY after ALL issues are addressed:**

1. **Pre-bump checks:**
   ```bash
   npm run lint      # Must pass with no errors
   npm run build     # Must complete successfully
   ```

2. **Update package.json:**
   - Bump patch version
   - Update changelog with ALL fixes

3. **Commit and push:**
   ```bash
   git add -A
   git commit -m "VERSION-X.X.X: Fix critical GitHub issues - [list ALL libraries]"
   git push origin main
   ```

### Phase 5: Issue Author Notification
1. **Add fix comments** to ALL issues (not just fixed ones):
   
   For FIXED issues:
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
   
   For ALREADY WORKING issues:
   ```
   ✅ **Проверено в версии X.X.X!** 📋
   
   **Статус библиотеки:** Работает корректно ✅
   
   [Объяснение почему уже работает]
   
   Пожалуйста, обновитесь до версии X.X.X и попробуйте снова.
   ```
   
   For NEEDS MORE WORK issues:
   ```
   ⚠️ **Частично исправлено в версии X.X.X** 
   
   [Объяснение что работает и что требует доработки]
   
   Полная поддержка будет добавлена в следующих версиях.
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

// Load ALL issues from our comprehensive fetch
const allIssues = JSON.parse(fs.readFileSync('.devkit/all-open-issues.json'));

// Build test configuration with EXACT user URLs from ALL GitHub issues
const USER_REPORTED_URLS = {};

for (const issue of allIssues) {
    const urlMatch = issue.body.match(/https?:\/\/[^\s]+/);
    const errorMatch = issue.body.match(/Error[^:]*: (.+?)(?:https|$)/);
    
    USER_REPORTED_URLS[`issue_${issue.number}`] = {
        issue: `#${issue.number}`,
        userUrl: urlMatch ? urlMatch[0].trim() : 'NO_URL_PROVIDED',
        userError: errorMatch ? errorMatch[1].trim() : issue.body.substring(0, 100),
        expectedBehavior: `Should handle ${issue.title} library correctly`
    };
}

console.log(`Created test cases for ${Object.keys(USER_REPORTED_URLS).length} issues`);

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
    
    async runAllTests() {
        console.log(`Testing ALL ${Object.keys(USER_REPORTED_URLS).length} reported issues...\n`);
        
        for (const [id, config] of Object.entries(USER_REPORTED_URLS)) {
            this.results[id] = await this.testLibrary(id, config);
        }
        
        return this.results;
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

## MANDATORY SAFEGUARDS

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

### 5. Comprehensiveness Requirements
- **ALL ISSUES**: Must address every single open issue
- **NO SUBSETS**: Never say "handling issues #X-#Y"
- **EXPLICIT LISTING**: Always list all issue numbers found
- **COMPLETE SUMMARY**: Show status of every issue before version bump

## Important Guidelines:
- **NO MANUAL VALIDATION**: Everything must be verified programmatically
- **NO USER APPROVAL**: Version bump is automatic after validation passes
- **ISSUE AUTHOR APPROVAL**: We seek approval from issue authors, not Claude user
- **QUALITY GATES**: Lint and build must pass before any commit
- **RUSSIAN COMMUNICATION**: All issue comments must be in Russian
- **SPECIFIC EXPLANATIONS**: Each issue gets a unique, specific explanation
- **PRODUCTION CODE TESTING**: All validation MUST use actual production code
- **COMPREHENSIVE HANDLING**: MUST handle ALL open issues, not a subset

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
- **ALWAYS handle ALL issues** (no subsets)

## CRITICAL: NO FINDER/FILE MANAGER OPENING
- **NEVER use shell.openItem, shell.openPath, shell.showItemInFolder**
- **NEVER open file manager or Finder windows**
- **NEVER use commands like `open` (macOS) or `explorer` (Windows)**
- All validation results are saved to files only
- Users do NOT inspect PDFs manually in this autonomous workflow

Remember: This is an EXCEPTION workflow designed for autonomous issue resolution. The goal is to fix issues quickly and get approval from issue authors, not the Claude user.

## FINAL CHECKLIST BEFORE VERSION BUMP

- [ ] Fetched ALL open issues from GitHub
- [ ] Listed ALL issue numbers explicitly  
- [ ] Created production code test framework (not isolated scripts)
- [ ] Used EXACT URLs from user reports (character-for-character)
- [ ] Reproduced ALL user errors before fixing
- [ ] Fixed root causes in production source files
- [ ] Validated ALL user URLs work after fixes
- [ ] No workarounds or test-only code
- [ ] Lint and build pass
- [ ] Test results show 100% success with user URLs
- [ ] Comprehensive summary shows ALL issues addressed

If ANY checkbox is not complete, DO NOT bump version.