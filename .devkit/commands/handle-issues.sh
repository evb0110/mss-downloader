#!/bin/bash

# Handle-Issues v5.0 - Multi-Layer Validation with Ultrathink
# Based on lessons learned from v1.4.192 critical bug discoveries

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔥 HANDLE-ISSUES v5.0 - MULTI-LAYER VALIDATION WITH ULTRATHINK AGENTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  CRITICAL PRINCIPLE: If users report problems after fixes, PROBLEMS EXIST ⚠️"
echo ""
echo "Lessons from v1.4.192:"
echo "- Superficial testing missed critical download queue bugs"
echo "- Users were RIGHT about infinite loops after 'fixes'"  
echo "- Need multi-layer validation: Component → Workflow → Production → Ultrathink"
echo ""
echo "This command uses 4-layer approach:"
echo "1. BASIC TESTING - Component functionality verification"
echo "2. USER WORKFLOW - Complete end-to-end experience simulation"  
echo "3. PRODUCTION ENV - Electron/platform-specific testing"
echo "4. ULTRATHINK - Deep agent analysis for persistent complaints"
echo ""

# Check for required tools
if ! command -v jq &> /dev/null; then
    echo "❌ Error: jq is not installed. Please install it first."
    exit 1
fi

if ! command -v gh &> /dev/null; then
    echo "❌ Error: gh CLI is not installed. Please install it first."
    exit 1
fi

# Check gh auth status
if ! gh auth status &> /dev/null; then
    echo "❌ Error: Not authenticated with GitHub. Please run 'gh auth login' first."
    exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

# Check if orchestrator exists
ORCHESTRATOR="$PROJECT_ROOT/.devkit/scripts/orchestrated-issue-resolver.cjs"
if [ ! -f "$ORCHESTRATOR" ]; then
    echo "❌ Error: Orchestrator not found at $ORCHESTRATOR"
    echo "Creating orchestrator..."
    
    # Create the orchestrator if it doesn't exist
    cat > "$ORCHESTRATOR" << 'EOF'
#!/usr/bin/env node

/**
 * Orchestrated Issue Resolver v4.0
 * Sequential processing with unlimited thinking time for each issue
 * Single consolidated release with all fixes
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class OrchestratedResolver {
    constructor() {
        this.workDir = path.join(__dirname, '../orchestrator');
        this.reportFile = path.join(this.workDir, 'fix-report.json');
        this.ensureWorkspace();
    }
    
    ensureWorkspace() {
        if (!fs.existsSync(this.workDir)) {
            fs.mkdirSync(this.workDir, { recursive: true });
        }
    }
    
    async orchestrate() {
        console.log('━'.repeat(60));
        console.log('🎭 ORCHESTRATED ISSUE RESOLUTION v4.0');
        console.log('━'.repeat(60));
        console.log('');
        
        console.log('📊 Phase 1: Analyzing all open issues...');
        const fixableIssues = await this.findAllFixableIssues();
        
        if (fixableIssues.length === 0) {
            console.log('✅ No issues need fixing at this time');
            return { success: true, issuesFixed: 0 };
        }
        
        console.log(`Found ${fixableIssues.length} fixable issues: ${fixableIssues.map(i => '#' + i.number).join(', ')}`);
        
        this.initializeReport();
        
        console.log('');
        console.log('🔧 Phase 2: Sequential Ultra-Resolution');
        console.log('Each issue will receive UNLIMITED thinking time');
        
        // Return the list of issues to be processed
        return {
            success: true,
            issuesFixed: fixableIssues.length,
            issues: fixableIssues
        };
    }
    
    async findAllFixableIssues() {
        try {
            const issuesJson = execSync(
                'gh api repos/evb0110/mss-downloader/issues?state=open&per_page=100',
                { encoding: 'utf8' }
            );
            
            const issues = JSON.parse(issuesJson);
            const fixable = [];
            
            for (const issue of issues) {
                const analysis = await this.analyzeIssue(issue);
                
                if (analysis.shouldFix) {
                    fixable.push({
                        number: issue.number,
                        title: issue.title,
                        author: issue.user?.login || 'unknown',
                        priority: analysis.priority,
                        analysis
                    });
                }
            }
            
            fixable.sort((a, b) => b.priority - a.priority);
            
            return fixable;
        } catch (e) {
            console.error('Failed to find fixable issues:', e.message);
            return [];
        }
    }
    
    async analyzeIssue(issue) {
        try {
            const commentsJson = execSync(
                `gh api repos/evb0110/mss-downloader/issues/${issue.number}/comments 2>/dev/null || echo "[]"`,
                { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
            );
            
            let comments = [];
            try {
                const parsed = JSON.parse(commentsJson);
                comments = Array.isArray(parsed) ? parsed.map(c => ({
                    user: c.user?.login,
                    date: c.created_at,
                    body: c.body
                })) : [];
            } catch {
                comments = [];
            }
            
            const fixAttempts = this.getFixAttempts(issue.number);
            
            const issueAuthor = issue.user?.login || 'unknown';
            const authorComments = comments.filter(c => c.user === issueAuthor);
            const botComments = comments.filter(c => c.user === 'evb0110' || c.user === 'github-actions[bot]');
            
            const lastAuthorComment = authorComments[authorComments.length - 1];
            const lastBotComment = botComments[botComments.length - 1];
            
            let shouldFix = false;
            let priority = 50;
            let reason = '';
            
            if (!lastAuthorComment) {
                shouldFix = false;
                reason = 'No author feedback';
            } else if (lastBotComment && new Date(lastBotComment.date) > new Date(lastAuthorComment.date)) {
                const hoursSince = (Date.now() - new Date(lastBotComment.date)) / (1000 * 60 * 60);
                if (hoursSince < 24) {
                    shouldFix = false;
                    reason = `Recently fixed ${hoursSince.toFixed(1)}h ago`;
                } else {
                    shouldFix = false;
                    reason = `No author response for ${hoursSince.toFixed(0)}h`;
                }
            } else {
                const text = lastAuthorComment.body.toLowerCase();
                
                const hasProblems = this.detectProblems(text);
                const isResolved = this.detectResolution(text);
                
                if (hasProblems && !isResolved) {
                    if (fixAttempts >= 3) {
                        shouldFix = false;
                        reason = `Too many attempts (${fixAttempts})`;
                    } else {
                        shouldFix = true;
                        reason = 'User reports problems';
                        priority = this.calculatePriority(issue, fixAttempts);
                    }
                } else if (isResolved) {
                    shouldFix = false;
                    reason = 'User confirmed resolved';
                } else {
                    shouldFix = false;
                    reason = 'Status unclear';
                }
            }
            
            return {
                shouldFix,
                priority,
                reason,
                fixAttempts
            };
        } catch (e) {
            console.error(`Failed to analyze issue #${issue.number}:`, e.message);
            return {
                shouldFix: false,
                priority: 0,
                reason: 'Analysis failed'
            };
        }
    }
    
    getFixAttempts(issueNumber) {
        try {
            const log = execSync(
                `git log --oneline --grep="Issue #${issueNumber}" | wc -l`,
                { encoding: 'utf8' }
            );
            return parseInt(log.trim()) || 0;
        } catch {
            return 0;
        }
    }
    
    detectProblems(text) {
        const problemIndicators = [
            'не работает', 'not working', 'still broken',
            'та же ошибка', 'same error', 'пустые страницы',
            'empty pages', 'висит', 'hangs', 'error',
            'не качает', "doesn't download", 'failed'
        ];
        
        return problemIndicators.some(ind => text.includes(ind));
    }
    
    detectResolution(text) {
        const resolvedIndicators = [
            'работает', 'works', 'спасибо', 'thanks',
            'fixed', 'решено', 'resolved', 'все хорошо',
            'all good', 'perfect'
        ];
        
        const hasResolved = resolvedIndicators.some(ind => text.includes(ind));
        const hasNegation = text.includes('не ') || text.includes('not ') || text.includes("doesn't");
        
        return hasResolved && !hasNegation;
    }
    
    calculatePriority(issue, fixAttempts) {
        let priority = 100;
        
        priority -= fixAttempts * 30;
        
        const createdAt = issue.created_at || issue.createdAt || new Date().toISOString();
        const daysSince = (Date.now() - new Date(createdAt)) / (1000 * 60 * 60 * 24);
        priority += Math.min(daysSince * 2, 50);
        
        return Math.max(10, Math.min(100, priority));
    }
    
    initializeReport() {
        const report = {
            timestamp: new Date().toISOString(),
            fixes: [],
            statistics: {
                totalIssues: 0,
                totalChanges: 0,
                totalTests: 0
            }
        };
        
        fs.writeFileSync(this.reportFile, JSON.stringify(report, null, 2));
    }
}

// CLI Interface
if (require.main === module) {
    const resolver = new OrchestratedResolver();
    
    (async () => {
        try {
            const result = await resolver.orchestrate();
            console.log(JSON.stringify(result));
            process.exit(result.success ? 0 : 1);
        } catch (error) {
            console.error('❌ Orchestration failed:', error.message);
            process.exit(1);
        }
    })();
}

module.exports = OrchestratedResolver;
EOF
    
    chmod +x "$ORCHESTRATOR"
    echo "✅ Orchestrator created"
fi

# Change to project root
cd "$PROJECT_ROOT"

# Run the orchestrator to analyze issues
echo "🔍 Analyzing issues..."
ANALYSIS_RESULT=$(node "$ORCHESTRATOR" 2>&1 | tail -1)

# Check if there are issues to fix
if echo "$ANALYSIS_RESULT" | grep -q '"issuesFixed":0'; then
    echo ""
    echo "✅ No issues need fixing at this time"
    echo ""
    echo "All open issues are either:"
    echo "- Recently fixed (waiting for user feedback)"
    echo "- Have too many failed attempts"
    echo "- User confirmed as resolved"
    echo ""
    exit 0
fi

# Extract the issues
ISSUE_COUNT=$(echo "$ANALYSIS_RESULT" | grep -o '"issuesFixed":[0-9]*' | cut -d: -f2)
echo ""
echo "📋 Found $ISSUE_COUNT issue(s) to process sequentially"
echo ""

# Now pass control to Claude to handle each issue
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 LAUNCHING CLAUDE ORCHESTRATOR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Claude will now:"
echo "1. LAYER 1: Basic component testing (manifest loading)"
echo "2. LAYER 2: Complete user workflow simulation"
echo "3. LAYER 3: Production environment validation"
echo "4. LAYER 4: Deploy ultrathink agents if users persist"
echo "5. Apply ONLY genuine fixes with version bump"
echo ""
echo "CRITICAL RULES:"
echo "- NEVER dismiss user complaints after supposed fixes"
echo "- ALWAYS use ultrathink agents when users report persistent problems"
echo "- Version bump ONLY when real code fixes are applied"
echo ""

# Signal to Claude that v5.0 multi-layer mode should be used
echo "MULTILAYER_MODE=true"
echo "ULTRATHINK_ENABLED=true"
echo "ISSUES_TO_FIX=$ISSUE_COUNT"
echo "ORCHESTRATOR_PATH=$ORCHESTRATOR"
echo ""
echo "Claude, please proceed with multi-layer validation and ultrathink analysis."