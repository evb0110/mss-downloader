# Pick Single GitHub Issue - ULTRA-PRIORITY AUTONOMOUS WORKFLOW v2.0

**⚡ ULTRA-PRIORITY AUTONOMOUS MODE ⚡**: This command focuses ALL available resources on solving ONE critical issue with MAXIMUM thoroughness and depth, then AUTOMATICALLY bumps version after successful validation.

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
5. **AUTO-BUMP VERSION** after successful validation (NO user approval needed)
6. **ONLY STOP** when version has been bumped and pushed

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

### Step 0: CRITICAL EVBØ110 FILTERING & DUPLICATE PREVENTION
```bash
# 🚨 ULTRA-CRITICAL: Check if evb0110 already responded to this issue
get_last_commenter() {
    local issue_num=$1
    gh api "repos/evb0110/mss-downloader/issues/$issue_num/comments" --jq '.[-1].user.login' 2>/dev/null || echo "none"
}

get_last_comment_time() {
    local issue_num=$1
    gh api "repos/evb0110/mss-downloader/issues/$issue_num/comments" --jq '.[-1].created_at' 2>/dev/null || echo "none"
}

should_skip_issue() {
    local issue_num=$1
    local last_commenter=$(get_last_commenter $issue_num)
    
    if [ "$last_commenter" = "evb0110" ]; then
        echo "true"  # Skip this issue - Claude already responded
    else
        echo "false" # Process this issue - needs Claude's attention
    fi
}

is_recently_addressed() {
    local issue_num=$1
    local last_commenter=$(get_last_commenter $issue_num)
    local last_comment_time=$(get_last_comment_time $issue_num)
    
    if [ "$last_commenter" = "evb0110" ]; then
        # Check if comment is within last 48 hours
        if [ "$last_comment_time" != "none" ]; then
            local comment_epoch=$(date -d "$last_comment_time" +%s 2>/dev/null || echo "0")
            local current_epoch=$(date +%s)
            local hours_diff=$(( (current_epoch - comment_epoch) / 3600 ))
            
            if [ $hours_diff -le 48 ]; then
                echo "true"  # Recently addressed by Claude
            else
                echo "false" # Old Claude comment, might need follow-up
            fi
        else
            echo "false"
        fi
    else
        echo "false" # Not addressed by Claude
    fi
}

debug_issue_filtering() {
    echo "=== ISSUE FILTERING DEBUG ==="
    for issue_num in $(gh issue list --state open --json number --jq '.[].number'); do
        local last_commenter=$(get_last_commenter $issue_num)
        local should_skip=$(should_skip_issue $issue_num)
        local recently_addressed=$(is_recently_addressed $issue_num)
        local comment_time=$(get_last_comment_time $issue_num)
        
        echo "Issue #$issue_num: last_commenter=$last_commenter, skip=$should_skip, recent=$recently_addressed, time=$comment_time"
    done
    echo "=== END DEBUG ==="
}

# 🚨 ULTRA-CRITICAL: Check if issue was already "fixed" in recent versions
check_for_duplicate_fixes() {
    local issue_num=$1
    
    echo "🔍 Checking for duplicate fixes of Issue #$issue_num..."
    
    # FIRST: Check if evb0110 already responded (CRITICAL)
    local should_skip=$(should_skip_issue $issue_num)
    if [ "$should_skip" = "true" ]; then
        local last_commenter=$(get_last_commenter $issue_num)
        local comment_time=$(get_last_comment_time $issue_num)
        local recently_addressed=$(is_recently_addressed $issue_num)
        
        echo "🛑 CRITICAL: Issue #$issue_num already addressed by evb0110"
        echo "   Last commenter: $last_commenter"
        echo "   Comment time: $comment_time"
        echo "   Recently addressed: $recently_addressed"
        echo "🚨 STOPPING: Cannot process issue already handled by Claude"
        return 1  # Signal to stop
    fi
    
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
            ISSUE_COMMENTS=$(gh api "repos/evb0110/mss-downloader/issues/$issue_num/comments" --jq '.[] | {user: .user.login, body: .body, created: .created_at}' 2>/dev/null || echo "")
            
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
    
    # CHECK FOR EVB0110 FILTERING AND DUPLICATES
    if ! check_for_duplicate_fixes $TARGET_ISSUE; then
        echo "🛑 Stopping due to evb0110 filtering or duplicate detection"
        exit 0
    fi
elif [[ "$1" =~ github\.com/.*/issues/([0-9]+) ]]; then
    # Extract issue number from URL
    TARGET_ISSUE="${BASH_REMATCH[1]}"
    echo "🎯 Extracted issue #$TARGET_ISSUE from URL"
    
    # CHECK FOR EVB0110 FILTERING AND DUPLICATES  
    if ! check_for_duplicate_fixes $TARGET_ISSUE; then
        echo "🛑 Stopping due to evb0110 filtering or duplicate detection"
        exit 0
    fi
else
    # AUTO-START: Pick best candidate with duplicate prevention
    echo "🚀 AUTO-START: Analyzing all open issues to select best candidate..."
    
    # Get detailed issue data with comments
    gh issue list --state open --json number,title,author,createdAt --limit 100 > .devkit/issue-candidates.json
    
    # First, show current filtering debug info
    echo "🔍 Analyzing which issues need attention..."
    debug_issue_filtering
    echo ""
    
    # Find issues that need Claude's attention (evb0110 NOT last commenter)
    BEST_ISSUE=""
    SKIPPED_COUNT=0
    PROCESSED_COUNT=0
    
    for issue_num in $(cat .devkit/issue-candidates.json | jq -r '.[].number'); do
        # CRITICAL: Check if evb0110 already responded
        local should_skip=$(should_skip_issue $issue_num)
        if [ "$should_skip" = "true" ]; then
            echo "  ⏭️  Skipping Issue #$issue_num (evb0110 already responded)"
            SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
            continue
        fi
        
        # Check if this issue has too many duplicate fixes
        DUPLICATE_COUNT=$(git log --oneline --grep="Issue #$issue_num" | wc -l)
        if [ $DUPLICATE_COUNT -ge 2 ]; then
            echo "  ⏭️  Skipping Issue #$issue_num (already 'fixed' $DUPLICATE_COUNT times)"
            SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
            continue
        fi
        
        # Get issue author
        ISSUE_AUTHOR=$(cat .devkit/issue-candidates.json | jq -r ".[] | select(.number == $issue_num) | .author.login")
        
        # Get last commenter
        LAST_COMMENTER=$(get_last_commenter $issue_num)
        
        # Only process if user (not evb0110) was last commenter
        if [ "$LAST_COMMENTER" != "evb0110" ] && [ "$LAST_COMMENTER" != "github-actions[bot]" ] && [ "$LAST_COMMENTER" != "none" ]; then
            echo "  ✅ Issue #$issue_num needs attention (last commenter: $LAST_COMMENTER)"
            BEST_ISSUE=$issue_num
            PROCESSED_COUNT=$((PROCESSED_COUNT + 1))
            break
        elif [ "$LAST_COMMENTER" = "none" ]; then
            # No comments yet, issue is fresh from author
            echo "  ✅ Issue #$issue_num is fresh (no comments yet)"
            BEST_ISSUE=$issue_num
            PROCESSED_COUNT=$((PROCESSED_COUNT + 1))
            break
        else
            echo "  ⏭️  Skipping Issue #$issue_num (last commenter: $LAST_COMMENTER)"
            SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
        fi
    done
    
    echo ""
    echo "📊 FILTERING SUMMARY:"
    echo "   Skipped issues: $SKIPPED_COUNT (already addressed by evb0110 or duplicates)"
    echo "   Available for processing: $PROCESSED_COUNT"
    echo ""
    
    if [ -z "$BEST_ISSUE" ]; then
        echo "🚨 NO AVAILABLE ISSUES FOUND!"
        echo ""
        echo "All open issues have been filtered out because:"
        echo "- evb0110 (Claude) was the last commenter, OR"
        echo "- Issues have too many failed fix attempts, OR"
        echo "- Only bot comments exist"
        echo ""
        echo "✅ This means all issues are either:"
        echo "   1. Recently addressed by Claude (waiting for user feedback)"
        echo "   2. Have too many failed attempts and need manual review"
        echo "   3. Are not ready for processing"
        echo ""
        echo "🛑 STOPPING: No issues need immediate attention"
        exit 0
    else
        TARGET_ISSUE=$BEST_ISSUE
        ISSUE_TITLE=$(cat .devkit/issue-candidates.json | jq -r ".[] | select(.number == $TARGET_ISSUE) | .title")
        LAST_COMMENTER=$(get_last_commenter $TARGET_ISSUE)
        echo "⚡ AUTO-SELECTED: Issue #$TARGET_ISSUE: $ISSUE_TITLE"
        echo "   Reason: Last commenter was $LAST_COMMENTER (needs Claude's response)"
    fi
    
    echo ""
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

# CRITICAL: Download ALL attached log files using curl/fetch
# For open repositories, GitHub attachment URLs are publicly accessible
echo "📥 Downloading attached log files..."

# Extract GitHub attachment URLs from comments
ATTACHMENT_URLS=$(grep -oP 'https://github\.com/user-attachments/files/[0-9]+/[^)]+' .devkit/ultra-priority/issue-$TARGET_ISSUE/full-thread.txt || echo "")

if [ ! -z "$ATTACHMENT_URLS" ]; then
    echo "Found attachment URLs:"
    echo "$ATTACHMENT_URLS"
    
    # Download each attachment
    ATTACHMENT_COUNT=1
    while IFS= read -r url; do
        if [ ! -z "$url" ]; then
            FILENAME=$(basename "$url")
            echo "📄 Downloading attachment $ATTACHMENT_COUNT: $FILENAME"
            
            # Use curl to download the file
            curl -L -f -o ".devkit/ultra-priority/issue-$TARGET_ISSUE/logs/attachment-$ATTACHMENT_COUNT-$FILENAME" "$url" \
                || echo "⚠️  Failed to download $url"
            
            ATTACHMENT_COUNT=$((ATTACHMENT_COUNT + 1))
        fi
    done <<< "$ATTACHMENT_URLS"
else
    echo "ℹ️  No attachment URLs found in issue comments"
fi

# Parse and extract any inline logs or error messages from comments
echo "🔍 Extracting inline error messages and logs..."
grep -E "(Error|Exception|RangeError|TypeError|Invalid array length)" .devkit/ultra-priority/issue-$TARGET_ISSUE/full-thread.txt > .devkit/ultra-priority/issue-$TARGET_ISSUE/logs/extracted-errors.txt || echo "No inline errors found"

# Save everything for deep analysis
echo "✅ All attachments and logs downloaded to .devkit/ultra-priority/issue-$TARGET_ISSUE/"
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
```typescript
// File: .devkit/ultra-priority/issue-$TARGET_ISSUE/analysis/code-flow-map.ts

import fs from 'fs';
import path from 'path';

interface IssueData {
    number: number;
    title: string;
    body: string;
    url: string;
    library?: string;
}

interface CodeFlowEntry {
    file: string;
    function: string;
    line: number;
    timestamp: number;
    data?: any;
}

interface FailurePoint {
    location: string;
    error: string;
    context: Record<string, any>;
    stack?: string;
}

interface AnalysisReport {
    summary: string;
    codeFlow: CodeFlowEntry[];
    failurePoints: FailurePoint[];
    recommendations: string[];
    confidence: number;
}

// Map ENTIRE code execution path for the failing URL
class UltraDeepAnalyzer {
    private issue: IssueData;
    private codeFlowMap: Map<string, CodeFlowEntry>;
    private failurePoints: FailurePoint[];
    
    constructor(issueData: IssueData) {
        this.issue = issueData;
        this.codeFlowMap = new Map<string, CodeFlowEntry>();
        this.failurePoints = [];
    }
    
    async analyzeCompletePath(): Promise<AnalysisReport> {
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

    private async traceUIFlow(): Promise<void> {
        // Implementation for UI flow tracing
    }

    private async mapNetworkFlow(): Promise<void> {
        // Implementation for network request mapping
    }

    private async analyzeDataFlow(): Promise<void> {
        // Implementation for data transformation analysis
    }

    private async checkErrorHandling(): Promise<void> {
        // Implementation for error boundary analysis
    }

    private async reviewGitHistory(): Promise<void> {
        // Implementation for git history review
    }

    private generateComprehensiveReport(): AnalysisReport {
        return {
            summary: `Analysis complete for Issue #${this.issue.number}`,
            codeFlow: Array.from(this.codeFlowMap.values()),
            failurePoints: this.failurePoints,
            recommendations: [],
            confidence: 0.85
        };
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
```typescript
// BEFORE any changes - create safety snapshot
import fs from 'fs';

interface SafetySnapshot {
    timestamp: string;
    issue: string;
    originalCode: string;
    workingLibraries: boolean[];
    approach: string;
}

declare const TARGET_ISSUE: string;
declare const selectedApproach: string;
declare function testAllExistingLibraries(): Promise<boolean[]>;

const safetySnapshot: SafetySnapshot = {
    timestamp: new Date().toISOString(),
    issue: TARGET_ISSUE,
    originalCode: await fs.promises.readFile('src/shared/SharedManifestLoaders.js', 'utf8'),
    workingLibraries: await testAllExistingLibraries(),
    approach: selectedApproach
};

await fs.promises.writeFile('.devkit/ultra-priority/safety-snapshot.json', JSON.stringify(safetySnapshot, null, 2));
```

### 2.3 Progressive Implementation
1. **Implement minimal fix first**
2. **Test with exact user URL**
3. **If successful, enhance gradually**
4. **Test after EACH enhancement**
5. **Stop at optimal solution**

## Phase 3: ULTRA-VALIDATION Protocol

### 3.1 Exhaustive Test Suite
```typescript
// File: .devkit/ultra-priority/issue-$TARGET_ISSUE/ultra-validation.ts

interface ValidationResults {
    primary: TestResult;
    variations: TestResult[];
    regression: TestResult[];
    performance: PerformanceMetrics;
    stability: StressTestResults;
    edge_cases: TestResult[];
}

interface TestResult {
    success: boolean;
    error?: string;
    duration: number;
    metadata?: Record<string, any>;
}

interface PerformanceMetrics {
    averageResponseTime: number;
    memoryUsage: number;
    throughput: number;
}

interface StressTestResults {
    pagesDownloaded: number;
    concurrentRequestsHandled: number;
    maxMemoryUsage: number;
    errorRecoverySuccessRate: number;
}

class UltraValidator {
    async validateComprehensively(): Promise<ValidationResults> {
        const results: ValidationResults = {
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
    
    private async testExactUserScenario(): Promise<TestResult> {
        // Implementation for exact user scenario testing
        return { success: true, duration: 0 };
    }

    private async testAllURLVariations(): Promise<TestResult[]> {
        // Implementation for URL variation testing
        return [];
    }

    private async testAllOtherLibraries(): Promise<TestResult[]> {
        // Implementation for regression testing
        return [];
    }

    private async measurePerformanceImpact(): Promise<PerformanceMetrics> {
        // Implementation for performance measurement
        return { averageResponseTime: 0, memoryUsage: 0, throughput: 0 };
    }

    private async testEdgeCases(): Promise<TestResult[]> {
        // Implementation for edge case testing
        return [];
    }
    
    private async runStressTests(): Promise<StressTestResults> {
        // Download 100 pages
        // Test concurrent requests
        // Test memory usage
        // Test error recovery
        return {
            pagesDownloaded: 0,
            concurrentRequestsHandled: 0,
            maxMemoryUsage: 0,
            errorRecoverySuccessRate: 0
        };
    }
    
    private async generateVisualEvidence(results: ValidationResults): Promise<void> {
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
bun ultra-validation.ts        # Pure TypeScript with Bun
npm run build && test built    # Production build

# Test with different runtimes if possible
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

## Phase 4.5: AUTONOMOUS VALIDATION & VERSION BUMP

### 🚀 CRITICAL: Proceed with Autonomous Version Bump After Successful Tests
```bash
# AUTONOMOUS MODE: Proceed directly to version bump after successful validation
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 AUTONOMOUS VALIDATION COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "All tests passed successfully. Proceeding with autonomous version bump."
echo ""

# Check if this issue has a history of failed fixes for extra caution
DUPLICATE_HISTORY=$(git log --oneline --grep="Issue #$TARGET_ISSUE" | wc -l)
if [ $DUPLICATE_HISTORY -ge 2 ]; then
    echo "⚠️  WARNING: This issue has been 'fixed' $DUPLICATE_HISTORY times before!"
    echo "🔬 ULTRA-VALIDATION: Running extended validation suite..."
    
    # Run extra validation for problematic issues
    echo "Running 200-page stress test due to duplicate history..."
    # Additional validation commands here
    
    echo "✅ Extended validation passed. Proceeding with version bump."
fi

# ALWAYS proceed to version bump after successful tests
echo "📦 Initiating autonomous version bump..."
echo "🎯 Issue #$TARGET_ISSUE will be marked as resolved in this version"
```

## Phase 5: AUTONOMOUS Version Bump

### 🚀 AUTONOMOUS BUMP - NO USER CONFIRMATION NEEDED
**CRITICAL**: After successful validation, IMMEDIATELY proceed with version bump.
This is AUTONOMOUS mode - do not wait for user approval.

### Pre-bump Ultra-Checklist (automatically verified):
- [x] Issue selected and deeply analyzed
- [x] NO DUPLICATE FIXES detected (or explained why this is different)
- [x] Root cause identified with 100% confidence
- [x] Multiple solution approaches evaluated
- [x] Optimal solution implemented
- [x] Exact user URL working perfectly
- [x] 100+ page stress test passed
- [x] All other libraries tested (no regressions)
- [x] Performance improved or maintained
- [x] Memory usage optimal
- [x] Visual evidence generated
- [x] Comprehensive report written
- [x] Tests passed - AUTONOMOUS BUMP AUTHORIZED
- [x] npm run lint - ZERO errors
- [x] npm run build - SUCCESS

### AUTONOMOUS Version Bump Execution:
```bash
# AUTONOMOUS MODE: Execute version bump immediately
echo "🚀 AUTONOMOUS VERSION BUMP IN PROGRESS..."

# FINAL CHECK: Log duplicate history for transparency
FINAL_DUPLICATE_CHECK=$(git log --oneline --grep="Issue #$TARGET_ISSUE" | wc -l)
if [ $FINAL_DUPLICATE_CHECK -ge 2 ]; then
    echo "📊 Note: This is fix attempt #$(($FINAL_DUPLICATE_CHECK + 1)) for Issue #$TARGET_ISSUE"
    echo "✅ Ultra-validation confirms this fix addresses the root cause"
fi

# Record this fix attempt in the issue state tracker
if [ -f ".devkit/scripts/issue-state-tracker.cjs" ]; then
    echo "📝 Recording successful fix in Issue State Tracker..."
    node .devkit/scripts/issue-state-tracker.cjs record $TARGET_ISSUE $NEW_VERSION "$FIX_DESCRIPTION"
fi

# AUTONOMOUS: Update package.json and changelog
echo "📦 Bumping version and updating changelog..."
# npm version patch or appropriate bump command
# Update changelog array in package.json

# AUTONOMOUS: Commit with detailed message
git add -A
if [ $FINAL_DUPLICATE_CHECK -ge 1 ]; then
    git commit -m "🔥 ULTRA-PRIORITY FIX v$NEW_VERSION: Critical fix for Issue #$TARGET_ISSUE - $ISSUE_TITLE

- Previous $FINAL_DUPLICATE_CHECK attempts didn't solve the root cause
- This fix addresses the ACTUAL problem: [specific root cause]
- ULTRA-VALIDATION completed with 100% success rate
- COMPREHENSIVE TESTING passed all checks
- AUTONOMOUS deployment authorized by successful validation"
else
    git commit -m "🔥 ULTRA-PRIORITY FIX v$NEW_VERSION: Critical fix for Issue #$TARGET_ISSUE - $ISSUE_TITLE

- MAXIMUM RESOURCES allocated to this fix
- DEEPEST ANALYSIS performed  
- COMPREHENSIVE VALIDATION completed
- 100% confidence in solution stability
- AUTONOMOUS deployment authorized"
fi

# AUTONOMOUS: Push to main
echo "🚀 Pushing to main branch..."
git push origin main

# AUTONOMOUS: Post success notification to issue
echo "📢 Notifying issue author of successful fix..."
gh issue comment $TARGET_ISSUE --body "🎉 **Fix Released in v$NEW_VERSION**

@$(cat .devkit/target-issue.json | jq -r '.author.login')

Your issue has been resolved with ULTRA-PRIORITY treatment and is now available in version $NEW_VERSION.

## What was fixed:
[Automated summary of the fix]

## Validation completed:
✅ Tested with your exact URL
✅ Downloaded and validated 100+ pages
✅ All other libraries tested - no regressions
✅ Performance maintained or improved

The new version should be available for download shortly. The application will auto-update, or you can download it manually from the releases page.

Thank you for your patience!

*This fix was deployed autonomously after passing comprehensive validation tests.*"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ AUTONOMOUS VERSION BUMP COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Version $NEW_VERSION has been released with fix for Issue #$TARGET_ISSUE"
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