# Pick Single GitHub Issue - ULTRA-PRIORITY AUTONOMOUS WORKFLOW v1.0

**⚡ ULTRA-PRIORITY MODE ⚡**: This command focuses ALL available resources on solving ONE critical issue with MAXIMUM thoroughness and depth.

**Preliminary**
- if `jq` isn't installed on the computer, install it
- if `gh` isn't installed, install it and ask user to authorize and use it to access issues
- always use `gh` to download issues and attached logs or other files

**🔥 CRITICAL FOCUS: ONE ISSUE, MAXIMUM RESOURCES 🔥**

This command adapts the handle-issues workflow but with ULTRA-FOCUS on a SINGLE issue:
- Accepts: Issue number, GitHub issue URL, or automatically selects best candidate
- Allocates MAXIMUM computational resources to solve ONE issue perfectly
- Uses DEEP analysis, extensive testing, and comprehensive validation
- Implements the AUTONOMOUS workflow for rapid resolution
- ULTRATHINK: Apply deepest possible analysis to understand and fix root causes
- **AUTO-START**: Immediately begins work on best available issue if none specified

## 🚀 AUTONOMOUS EXECUTION DIRECTIVE 🚀
**CRITICAL**: This is a FULLY AUTONOMOUS command. When executed:
1. **DO NOT WAIT** for user confirmation at any step
2. **IMMEDIATELY PROCEED** through all phases
3. **AUTO-SELECT** best issue if none specified
4. **CONTINUE WORKING** until issue is completely resolved
5. **ONLY STOP** when ready for version bump or if blocked

## Usage Patterns:
```bash
# Pick specific issue by number
/claude pick-issue 15

# Pick specific issue by URL
/claude pick-issue https://github.com/user/repo/issues/15

# Auto-select and start working immediately (default)
/claude pick-issue
```

## MANDATORY FIRST STEP: Duplicate Detection & Issue Selection

### Step 0: CRITICAL DUPLICATE PREVENTION CHECK
```bash
# 🚨 ULTRA-CRITICAL: Check if issue was already "fixed" in recent versions
check_for_duplicate_fixes() {
    local issue_num=$1
    
    echo "🔍 Checking for duplicate fixes of Issue #$issue_num..."
    
    # Use the issue state tracker if available
    if [ -f ".devkit/scripts/issue-state-tracker.cjs" ]; then
        echo "📊 Using Issue State Tracker for comprehensive analysis..."
        node .devkit/scripts/issue-state-tracker.cjs check $issue_num
        TRACKER_EXIT_CODE=$?
        
        if [ $TRACKER_EXIT_CODE -ne 0 ]; then
            echo "⚠️  Issue State Tracker detected duplicate risk"
        fi
    fi
    
    # Also check recent commits for this issue
    RECENT_FIXES=$(git log --oneline -30 --grep="Issue #$issue_num" 2>/dev/null || echo "")
    
    if [ ! -z "$RECENT_FIXES" ]; then
        echo "⚠️  WARNING: Issue #$issue_num mentioned in recent commits:"
        echo "$RECENT_FIXES"
        
        # Count how many times this issue was "fixed"
        FIX_COUNT=$(echo "$RECENT_FIXES" | wc -l)
        
        if [ $FIX_COUNT -ge 2 ]; then
            echo "🚨 DUPLICATE ALERT: Issue #$issue_num has been 'fixed' $FIX_COUNT times!"
            echo "📊 This indicates previous fixes didn't solve the actual problem."
            
            # Check if user confirmed any fix worked
            echo "Checking user responses..."
            ISSUE_COMMENTS=$(gh api "repos/{owner}/{repo}/issues/$issue_num/comments" --jq '.[] | {user: .user.login, body: .body, created: .created_at}' 2>/dev/null || echo "")
            
            # Look for user confirmation or rejection
            LAST_USER_COMMENT=$(echo "$ISSUE_COMMENTS" | grep -v '"user": "evb0110"' | tail -1)
            
            if echo "$LAST_USER_COMMENT" | grep -qE "(работает|works|fixed|спасибо|thanks|закрыт|closed)"; then
                echo "✅ Issue appears resolved - user confirmed fix works"
                echo "🛑 STOPPING: No need to fix again"
                return 1  # Signal to stop
            elif echo "$LAST_USER_COMMENT" | grep -qE "(не работает|not working|still|всё ещё|broken|библиотеки нет)"; then
                echo "🔄 Previous fixes didn't work - user reported ongoing problems"
                echo "📝 IMPORTANT: Must identify why $FIX_COUNT previous fixes failed"
                echo "⚡ Proceeding with ULTRA-DEEP analysis to find real root cause"
            else
                echo "❓ User hasn't confirmed if fixes worked"
                echo "📨 Should request user feedback before attempting another fix"
            fi
        fi
        
        # Analyze what was claimed to be fixed
        echo "\n📋 Previous fix claims:"
        git log --format="%h %s" --grep="Issue #$issue_num" -5
    else
        echo "✅ No recent fixes found for Issue #$issue_num - safe to proceed"
    fi
    
    return 0  # Continue with fix
}
```

### Step 1: Identify Target Issue with Duplicate Prevention
```bash
# Create workspace
mkdir -p .devkit/ultra-priority

# Fetch ALL issues to find the target
gh issue list --state open --json number,title,body,author,comments,createdAt --limit 100 > .devkit/all-open-issues.json

# Determine which issue to handle
if [[ "$1" =~ ^[0-9]+$ ]]; then
    # Issue number provided
    TARGET_ISSUE="$1"
    echo "🎯 Using specified issue #$TARGET_ISSUE"
    
    # CHECK FOR DUPLICATES
    if ! check_for_duplicate_fixes $TARGET_ISSUE; then
        echo "🛑 Stopping due to duplicate detection"
        exit 0
    fi
elif [[ "$1" =~ github\.com/.*/issues/([0-9]+) ]]; then
    # Extract issue number from URL
    TARGET_ISSUE="${BASH_REMATCH[1]}"
    echo "🎯 Extracted issue #$TARGET_ISSUE from URL"
    
    # CHECK FOR DUPLICATES
    if ! check_for_duplicate_fixes $TARGET_ISSUE; then
        echo "🛑 Stopping due to duplicate detection"
        exit 0
    fi
else
    # AUTO-START: Pick best candidate with duplicate prevention
    echo "🚀 AUTO-START: Analyzing all open issues to select best candidate..."
    
    # Get detailed issue data with comments
    gh issue list --state open --json number,title,author,createdAt --limit 100 > .devkit/issue-candidates.json
    
    # Find issues that haven't been repeatedly "fixed"
    BEST_ISSUE=""
    for issue_num in $(cat .devkit/issue-candidates.json | jq -r '.[].number'); do
        # First check if this issue has duplicate fixes
        DUPLICATE_COUNT=$(git log --oneline --grep="Issue #$issue_num" | wc -l)
        if [ $DUPLICATE_COUNT -ge 2 ]; then
            echo "  Skipping Issue #$issue_num (already 'fixed' $DUPLICATE_COUNT times)"
            continue
        fi
        # Get issue comments
        gh api "repos/{owner}/{repo}/issues/$issue_num/comments" --jq '.[].user.login' > .devkit/comment-authors-$issue_num.txt 2>/dev/null || continue
        
        # Get issue author
        ISSUE_AUTHOR=$(cat .devkit/issue-candidates.json | jq -r ".[] | select(.number == $issue_num) | .author.login")
        
        # Check if last comment is from author (not from bot or MSS team)
        if [ -s .devkit/comment-authors-$issue_num.txt ]; then
            LAST_COMMENTER=$(tail -1 .devkit/comment-authors-$issue_num.txt)
            if [ "$LAST_COMMENTER" = "$ISSUE_AUTHOR" ] && [ "$LAST_COMMENTER" != "github-actions[bot]" ]; then
                BEST_ISSUE=$issue_num
                break
            fi
        else
            # No comments yet, issue is fresh from author
            BEST_ISSUE=$issue_num
            break
        fi
    done
    
    # Clean up temporary files
    rm -f .devkit/comment-authors-*.txt
    
    if [ -z "$BEST_ISSUE" ]; then
        # Fallback: pick most recent issue
        TARGET_ISSUE=$(cat .devkit/issue-candidates.json | jq -r 'sort_by(.createdAt) | reverse | .[0].number')
        echo "⚡ AUTO-SELECTED: Most recent issue #$TARGET_ISSUE"
    else
        TARGET_ISSUE=$BEST_ISSUE
        ISSUE_TITLE=$(cat .devkit/issue-candidates.json | jq -r ".[] | select(.number == $TARGET_ISSUE) | .title")
        echo "⚡ AUTO-SELECTED: Issue #$TARGET_ISSUE: $ISSUE_TITLE (author's last comment pending)"
    fi
    
    echo "🔥 STARTING ULTRA-PRIORITY WORK IMMEDIATELY ON ISSUE #$TARGET_ISSUE"
fi

# Extract COMPLETE issue data
cat .devkit/all-open-issues.json | jq ".[] | select(.number == $TARGET_ISSUE)" > .devkit/target-issue.json

# IMMEDIATE PROCEED TO ANALYSIS - NO USER CONFIRMATION NEEDED
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔥 ULTRA-PRIORITY AUTONOMOUS MODE ACTIVATED 🔥"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

### Step 2: ULTRA-DEEP Issue Analysis - PROCEED IMMEDIATELY
**DO NOT WAIT FOR USER - CONTINUE AUTONOMOUSLY**

After selecting the issue, IMMEDIATELY proceed with the analysis. Do not ask for confirmation or wait for user input. The autonomous mode means you start working right away.

**MANDATORY OUTPUT:**
```
=== 🔥 ULTRA-PRIORITY ISSUE ANALYSIS 🔥 ===
Target Issue: #15 - Biblioteca Nacional de España
Author: @username
Created: 2024-01-15

COMPREHENSIVE ISSUE BREAKDOWN:
1. Primary Error: [Exact error message]
2. Affected URL: [Exact URL from issue]
3. Library System: [Detected library type]
4. Root Cause Hypothesis: [Initial analysis]
5. Related Components: [All affected code paths]
6. Historical Context: [Previous similar issues]

RESOURCE ALLOCATION:
- Analysis Depth: MAXIMUM
- Test Coverage: EXHAUSTIVE
- Validation Cycles: UNLIMITED
- Time Investment: AS NEEDED
```

**AUTONOMOUS ACTION**: After displaying this analysis, IMMEDIATELY continue to Phase 1 without waiting.

### Step 3: Download ALL Attachments & Logs
```bash
# Create dedicated workspace for this issue
mkdir -p .devkit/ultra-priority/issue-$TARGET_ISSUE/{logs,attachments,analysis}

# Download all comments and attachments
gh issue view $TARGET_ISSUE --comments > .devkit/ultra-priority/issue-$TARGET_ISSUE/full-thread.txt

# Parse and download any attached files
# Extract logs from comments
# Save everything for deep analysis
```

## 🎯 AUTONOMOUS WORKFLOW EXECUTION 🎯

**IMPORTANT**: From this point forward, execute ALL phases sequentially without stopping:
- Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
- Do NOT pause between phases
- Do NOT ask for user confirmation
- Do NOT wait for feedback
- ONLY communicate results and progress

## Phase 1: ULTRA-DEEP Root Cause Analysis

### 1.1 Production Code Mapping
Create comprehensive code flow analysis:
```javascript
// File: .devkit/ultra-priority/issue-$TARGET_ISSUE/analysis/code-flow-map.js

const fs = require('fs');
const path = require('path');

// Map ENTIRE code execution path for the failing URL
class UltraDeepAnalyzer {
    constructor(issueData) {
        this.issue = issueData;
        this.codeFlowMap = new Map();
        this.failurePoints = [];
    }
    
    async analyzeCompletePath() {
        console.log('🔬 ULTRA-DEEP ANALYSIS INITIATED');
        
        // 1. Trace from UI click to manifest load
        await this.traceUIFlow();
        
        // 2. Map all network requests
        await this.mapNetworkFlow();
        
        // 3. Analyze all data transformations
        await this.analyzeDataFlow();
        
        // 4. Check all error boundaries
        await this.checkErrorHandling();
        
        // 5. Review historical changes
        await this.reviewGitHistory();
        
        return this.generateComprehensiveReport();
    }
}
```

### 1.2 Multi-Dimensional Testing
**MANDATORY: Test from EVERY angle:**

1. **URL Variations Testing:**
   - Original exact URL
   - URL with different parameters
   - URL at different depths
   - URL with special characters
   - URL encoding variations

2. **Network Condition Testing:**
   - Normal connection
   - Slow connection simulation
   - Intermittent failures
   - Proxy configurations
   - SSL variations

3. **Data Format Testing:**
   - Expected format
   - Malformed responses
   - Empty responses
   - Partial data
   - Encoding issues

### 1.3 Historical Pattern Analysis
```bash
# Search for similar issues in closed issues
gh issue list --state closed --search "$LIBRARY_NAME" --json number,title,body > .devkit/historical-similar.json

# Analyze git history for related files
git log --grep="$LIBRARY_NAME" --oneline > .devkit/related-commits.txt

# Check for regression patterns
git diff HEAD~20..HEAD -- src/shared/SharedManifestLoaders.js > .devkit/recent-changes.diff
```

## Phase 2: EXHAUSTIVE Solution Development

### 2.1 Solution Strategy Matrix
**Create MULTIPLE solution approaches:**
```
SOLUTION MATRIX for Issue #15:
┌─────────────────────────────────────────┐
│ Approach A: Direct Fix                  │
│ - Modify URL parsing logic              │
│ - Risk: May affect other libraries      │
│ - Confidence: 70%                       │
├─────────────────────────────────────────┤
│ Approach B: New Handler                 │
│ - Create dedicated BNE handler          │
│ - Risk: Code duplication                │
│ - Confidence: 90%                       │
├─────────────────────────────────────────┤
│ Approach C: Pattern Enhancement         │
│ - Enhance regex patterns                │
│ - Risk: Complexity increase             │
│ - Confidence: 85%                       │
└─────────────────────────────────────────┘
```

### 2.2 Implementation with MAXIMUM Safety
```javascript
// BEFORE any changes - create safety snapshot
const safetySnapshot = {
    timestamp: new Date().toISOString(),
    issue: TARGET_ISSUE,
    originalCode: fs.readFileSync('src/shared/SharedManifestLoaders.js', 'utf8'),
    workingLibraries: await testAllExistingLibraries(),
    approach: selectedApproach
};

fs.writeFileSync('.devkit/ultra-priority/safety-snapshot.json', JSON.stringify(safetySnapshot));
```

### 2.3 Progressive Implementation
1. **Implement minimal fix first**
2. **Test with exact user URL**
3. **If successful, enhance gradually**
4. **Test after EACH enhancement**
5. **Stop at optimal solution**

## Phase 3: ULTRA-VALIDATION Protocol

### 3.1 Exhaustive Test Suite
```javascript
// File: .devkit/ultra-priority/issue-$TARGET_ISSUE/ultra-validation.js

class UltraValidator {
    async validateComprehensively() {
        const results = {
            primary: await this.testExactUserScenario(),
            variations: await this.testAllURLVariations(),
            regression: await this.testAllOtherLibraries(),
            performance: await this.measurePerformanceImpact(),
            stability: await this.runStressTests(),
            edge_cases: await this.testEdgeCases()
        };
        
        // Generate visual proof
        await this.generateVisualEvidence(results);
        
        return results;
    }
    
    async runStressTests() {
        // Download 100 pages
        // Test concurrent requests
        // Test memory usage
        // Test error recovery
    }
    
    async generateVisualEvidence(results) {
        // Create comparison PDFs
        // Generate performance graphs
        // Create error/success matrix
        // Build comprehensive report
    }
}
```

### 3.2 Multi-Environment Validation
```bash
# Test in different environments
npm run test:e2e               # Electron environment
node validation-script.js      # Pure Node.js
npm run build && test built    # Production build

# Test with different Node versions if possible
```

### 3.3 Evidence Collection
**MANDATORY evidence before version bump:**
1. Screenshot of working download
2. PDF validation showing correct content
3. Performance metrics showing no regression
4. Test results from ALL other libraries
5. Memory usage comparison
6. Network request analysis

## Phase 4: ULTRA-DETAILED Documentation

### 4.1 Comprehensive Fix Report
```markdown
# Fix Report for Issue #[NUMBER]

## Executive Summary
[One paragraph explaining the fix]

## Root Cause Analysis
### The Problem
[Detailed explanation with code examples]

### Why It Failed
[Step-by-step failure analysis]

### Historical Context
[Any related issues or previous attempts]

## Solution Implementation
### Approach Chosen
[Why this approach over others]

### Code Changes
[Detailed diff with explanations]

### Safety Measures
[How we ensured no regressions]

## Validation Results
### Primary Test
[Results with exact user URL]

### Comprehensive Testing
[Matrix of all test results]

### Performance Impact
[Before/after metrics]

## Visual Evidence
[Screenshots and PDF samples]
```

### 4.2 Issue Author Communication
**ULTRA-PRIORITY Russian response:**
```markdown
🔥 **РЕШЕНИЕ С МАКСИМАЛЬНЫМ ПРИОРИТЕТОМ** 🔥

Уважаемый @[author],

Ваша проблема была обработана с **МАКСИМАЛЬНЫМ приоритетом** и **ГЛУБОЧАЙШИМ анализом**.

## 📊 Результаты ультра-анализа:
[Подробное объяснение проблемы]

## ✅ Реализованное решение:
[Техническое описание исправления]

## 🔬 Проверка решения:
- Протестировано с вашим точным URL: ✅
- Скачано страниц для проверки: 100 ✅
- Проверка других библиотек: ✅ (регрессий нет)
- Производительность: ✅ (улучшена на 15%)

## 📥 Доказательства:
[Приложены тестовые PDF файлы]

**Версия X.X.X** уже доступна для скачивания.

Это исправление получило наш **МАКСИМАЛЬНЫЙ** уровень тестирования и валидации.

С уважением,
Команда MSS Downloader
```

## Phase 4.5: USER VALIDATION REQUIREMENT

### 🚨 CRITICAL: Verify Fix Before Version Bump
```bash
# DO NOT PROCEED TO VERSION BUMP WITHOUT USER CONFIRMATION
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 USER VALIDATION REQUIRED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "The fix has been implemented and tested."
echo "Before version bump, we need confirmation that it solves the actual problem."
echo ""
echo "Options:"
echo "1. Post validation request to issue author"
echo "2. If user is available, request immediate testing"
echo "3. If confident, proceed with version bump (risky if duplicate pattern exists)"
echo ""

# Check if this issue has a history of failed fixes
DUPLICATE_HISTORY=$(git log --oneline --grep="Issue #$TARGET_ISSUE" | wc -l)
if [ $DUPLICATE_HISTORY -ge 1 ]; then
    echo "⚠️  WARNING: This issue has been 'fixed' $DUPLICATE_HISTORY times before!"
    echo "🚨 MANDATORY: Must get user confirmation before version bump"
    echo ""
    echo "Posting validation request to issue..."
    
    # Post comment requesting validation
    gh issue comment $TARGET_ISSUE --body "@$(cat .devkit/target-issue.json | jq -r '.author.login')

🔧 We've implemented a fix for your issue. Before releasing a new version, could you please test if it works?

You can test with the development build or wait for the next release.

Please confirm if the issue is resolved so we can close it properly.

Thank you!"
    
    echo "⏸️  PAUSING: Waiting for user validation before version bump"
    echo "📋 TODO: Check issue comments for user response before proceeding"
    exit 0
fi
```

## Phase 5: AUTONOMOUS Version Bump

### Pre-bump Ultra-Checklist:
- [ ] Issue selected and deeply analyzed
- [ ] NO DUPLICATE FIXES detected (or explained why this is different)
- [ ] Root cause identified with 100% confidence
- [ ] Multiple solution approaches evaluated
- [ ] Optimal solution implemented
- [ ] Exact user URL working perfectly
- [ ] 100+ page stress test passed
- [ ] All other libraries tested (no regressions)
- [ ] Performance improved or maintained
- [ ] Memory usage optimal
- [ ] Visual evidence generated
- [ ] Comprehensive report written
- [ ] USER VALIDATION obtained (if duplicate history exists)
- [ ] npm run lint - ZERO errors
- [ ] npm run build - SUCCESS

### Version Bump with DUPLICATE PREVENTION:
```bash
# FINAL CHECK: Ensure we're not creating a duplicate fix
FINAL_DUPLICATE_CHECK=$(git log --oneline --grep="Issue #$TARGET_ISSUE" | wc -l)
if [ $FINAL_DUPLICATE_CHECK -ge 2 ]; then
    echo "🚨 CRITICAL: This would be fix attempt #$(($FINAL_DUPLICATE_CHECK + 1)) for Issue #$TARGET_ISSUE"
    echo "📊 Previous attempts:"
    git log --oneline --grep="Issue #$TARGET_ISSUE"
    echo ""
    echo "❓ Are you SURE this fix is different and will work? (requires user validation)"
    # Add extra context about why this fix is different
fi

# Record this fix attempt in the issue state tracker
if [ -f ".devkit/scripts/issue-state-tracker.cjs" ]; then
    echo "📝 Recording fix attempt in Issue State Tracker..."
    node .devkit/scripts/issue-state-tracker.cjs record $TARGET_ISSUE $NEW_VERSION "$FIX_DESCRIPTION"
fi

# Update package.json with ULTRA-PRIORITY marker
# In commit message, emphasize the critical nature AND mention if this resolves previous failed attempts

git add -A
if [ $FINAL_DUPLICATE_CHECK -ge 1 ]; then
    git commit -m "🔥 ULTRA-PRIORITY FIX v.X.X.X: FINAL fix for Issue #$TARGET_ISSUE - $ISSUE_TITLE

- Previous $FINAL_DUPLICATE_CHECK attempts didn't solve the root cause
- This fix addresses the ACTUAL problem: [specific root cause]
- User validated that this solution works
- COMPREHENSIVE VALIDATION completed
- 100% confidence this resolves the issue permanently"
else
    git commit -m "🔥 ULTRA-PRIORITY FIX v.X.X.X: Critical fix for Issue #$TARGET_ISSUE - $ISSUE_TITLE

- MAXIMUM RESOURCES allocated to this fix
- DEEPEST ANALYSIS performed  
- COMPREHENSIVE VALIDATION completed
- 100% confidence in solution stability"
fi

git push origin main
```

## CRITICAL SUCCESS FACTORS

### 1. Resource Allocation
- **NO TIME LIMITS** - Take as long as needed
- **MAXIMUM COMPUTING** - Use all available resources
- **DEEP THINKING** - Analyze from every angle
- **EXHAUSTIVE TESTING** - Test beyond normal limits

### 2. Quality Standards
- **100% Confidence** - No doubts about the fix
- **Zero Regressions** - Nothing else can break
- **Performance Gain** - Should work better than before
- **Future Proof** - Handle edge cases proactively

### 3. Communication Excellence
- **Author Engagement** - Treat author as VIP
- **Detailed Updates** - Provide progress reports
- **Visual Proof** - Show, don't just tell
- **Personal Touch** - Make them feel heard

## Conflict Resolution
This ULTRA-PRIORITY workflow:
- **OVERRIDES** time constraints
- **MAXIMIZES** resource usage
- **REQUIRES** deepest analysis
- **DEMANDS** perfect solution

But MAINTAINS:
- Production code testing requirements
- No isolated script creation
- Exact URL testing
- Root cause fixing (not symptoms)

## FINAL ULTRA-CHECKLIST
- [ ] Spent MAXIMUM effort on analysis
- [ ] Explored ALL solution paths
- [ ] Tested EXHAUSTIVELY
- [ ] Created COMPREHENSIVE documentation
- [ ] Achieved 100% confidence
- [ ] Delivered EXCEPTIONAL fix

**Remember: This is ULTRA-PRIORITY mode. One issue, maximum resources, perfect solution.**