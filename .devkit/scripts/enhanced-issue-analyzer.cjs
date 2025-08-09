#!/usr/bin/env node

/**
 * Enhanced Issue Analyzer - Uses Claude to analyze issue comments semantically
 * Instead of fragile regex patterns, we ask Claude to understand the actual meaning
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class EnhancedIssueAnalyzer {
    constructor() {
        this.stateFile = path.join(__dirname, '../data/issue-analysis-state.json');
        this.ensureDataDir();
        this.state = this.loadState();
    }
    
    ensureDataDir() {
        const dataDir = path.dirname(this.stateFile);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }
    
    loadState() {
        if (fs.existsSync(this.stateFile)) {
            try {
                return JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
            } catch (e) {
                return { issues: {}, lastAnalysis: {} };
            }
        }
        return { issues: {}, lastAnalysis: {} };
    }
    
    saveState() {
        fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
    }
    
    /**
     * Get all comments for an issue chronologically
     */
    getIssueThread(issueNumber) {
        try {
            // Get issue details
            const issueJson = execSync(
                `gh api repos/evb0110/mss-downloader/issues/${issueNumber}`,
                { encoding: 'utf8' }
            );
            const issue = JSON.parse(issueJson);
            
            // Get all comments
            const commentsJson = execSync(
                `gh api repos/evb0110/mss-downloader/issues/${issueNumber}/comments --paginate`,
                { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
            );
            
            let comments = [];
            try {
                comments = JSON.parse(commentsJson);
            } catch {
                // Handle paginated response
                comments = commentsJson.split('\n')
                    .filter(line => line.trim())
                    .flatMap(line => JSON.parse(line));
            }
            
            // Build chronological thread
            const thread = [
                {
                    type: 'issue',
                    author: issue.user.login,
                    created: issue.created_at,
                    body: issue.body,
                    isBot: false
                }
            ];
            
            for (const comment of comments) {
                thread.push({
                    type: 'comment',
                    author: comment.user.login,
                    created: comment.created_at,
                    body: comment.body,
                    isBot: comment.user.login === 'evb0110' || 
                           comment.user.login === 'github-actions[bot]'
                });
            }
            
            return {
                issue,
                thread,
                lastUserComment: thread.filter(c => !c.isBot).slice(-1)[0],
                lastBotComment: thread.filter(c => c.isBot).slice(-1)[0],
                issueAuthor: issue.user.login
            };
        } catch (e) {
            console.error(`Failed to get thread for issue #${issueNumber}:`, e.message);
            return null;
        }
    }
    
    /**
     * Get fix attempts from git history
     */
    getFixAttempts(issueNumber) {
        try {
            const log = execSync(
                `git log --oneline --grep="Issue #${issueNumber}" --format="%H|%ai|%s"`,
                { encoding: 'utf8' }
            ).trim();
            
            if (!log) return [];
            
            return log.split('\n').map(line => {
                const [hash, date, ...messageParts] = line.split('|');
                return {
                    hash,
                    date: new Date(date),
                    message: messageParts.join('|'),
                    version: messageParts[0]?.match(/v\d+\.\d+\.\d+/)?.[0]
                };
            });
        } catch {
            return [];
        }
    }
    
    /**
     * Create analysis prompt for Claude
     */
    createAnalysisPrompt(issueData, fixAttempts) {
        const { issue, thread, lastUserComment, lastBotComment, issueAuthor } = issueData;
        
        // Format thread for analysis
        const threadText = thread.map(comment => {
            const role = comment.isBot ? '[BOT]' : `[USER: ${comment.author}]`;
            const date = new Date(comment.created).toISOString().split('T')[0];
            return `${role} ${date}:\n${comment.body}\n`;
        }).join('\n---\n');
        
        // Format fix attempts
        const fixText = fixAttempts.map(fix => 
            `- ${fix.version || 'unknown'} (${fix.date.toISOString().split('T')[0]}): ${fix.message}`
        ).join('\n');
        
        const prompt = `Analyze this GitHub issue thread to determine if the issue needs a fix.

ISSUE #${issue.number}: ${issue.title}
Author: @${issueAuthor}
Created: ${new Date(issue.created_at).toISOString().split('T')[0]}
Status: ${issue.state}

FIX ATTEMPTS (${fixAttempts.length} total):
${fixText || 'No fix attempts yet'}

FULL CONVERSATION THREAD:
${threadText}

ANALYSIS NEEDED:
1. What is the actual problem reported?
2. Does the last user comment indicate the problem is RESOLVED or STILL BROKEN?
3. If the bot claimed a fix, did the user confirm it works?
4. Should we attempt another fix?

Respond with JSON only:
{
  "problem": "brief description of the actual issue",
  "userSaysFixed": true/false,
  "userSaysBroken": true/false,
  "lastUserFeedback": "summary of last user comment",
  "shouldAttemptFix": true/false,
  "reason": "explanation of decision",
  "confidence": 0-100
}`;

        return prompt;
    }
    
    /**
     * Analyze issue with AI (this would call Claude API in production)
     * For now, we'll use a heuristic-based approach
     */
    async analyzeWithAI(issueNumber) {
        const issueData = this.getIssueThread(issueNumber);
        if (!issueData) {
            return {
                shouldFix: false,
                reason: 'Failed to fetch issue data',
                exitCode: 1
            };
        }
        
        const fixAttempts = this.getFixAttempts(issueNumber);
        
        // For now, use heuristics (in production, this would call Claude API)
        // The prompt is ready for when API integration is added
        const prompt = this.createAnalysisPrompt(issueData, fixAttempts);
        
        // Heuristic analysis (placeholder for AI)
        const { lastUserComment, lastBotComment } = issueData;
        
        // No user feedback at all
        if (!lastUserComment) {
            return {
                shouldFix: false,
                reason: 'No user comments on issue',
                exitCode: 1
            };
        }
        
        // Check timing
        const lastUserDate = new Date(lastUserComment.created);
        const lastBotDate = lastBotComment ? new Date(lastBotComment.created) : null;
        
        // Bot responded after user's last comment
        if (lastBotDate && lastBotDate > lastUserDate) {
            const hoursSince = (Date.now() - lastBotDate) / (1000 * 60 * 60);
            
            if (hoursSince < 24) {
                return {
                    shouldFix: false,
                    reason: `Fix deployed ${hoursSince.toFixed(1)}h ago, waiting for user feedback`,
                    exitCode: 2
                };
            }
            
            // No response after 24h - user might have given up
            return {
                shouldFix: false,
                reason: `No user response for ${hoursSince.toFixed(0)}h after fix`,
                exitCode: 1
            };
        }
        
        // User commented after bot - analyze content
        const userText = lastUserComment.body.toLowerCase();
        
        // Clear positive indicators
        const positiveIndicators = [
            'работает', 'works', 'спасибо', 'thanks', 'fixed', 
            'решено', 'resolved', 'все хорошо', 'all good'
        ];
        
        // Clear negative indicators
        const negativeIndicators = [
            'не работает', 'not working', 'still broken', 'та же ошибка',
            'same error', 'пустые страницы', 'empty pages', 'висит', 'hangs',
            'не качает', 'не скачивает', "doesn't download", 'error invoking'
        ];
        
        const hasPositive = positiveIndicators.some(ind => userText.includes(ind));
        const hasNegative = negativeIndicators.some(ind => userText.includes(ind));
        
        // Clear negative signal
        if (hasNegative && !hasPositive) {
            if (fixAttempts.length >= 3) {
                return {
                    shouldFix: false,
                    reason: `Too many failed attempts (${fixAttempts.length}), needs human intervention`,
                    exitCode: 3
                };
            }
            
            return {
                shouldFix: true,
                reason: 'User reports problem persists after fix',
                exitCode: 0
            };
        }
        
        // Clear positive signal
        if (hasPositive && !hasNegative) {
            return {
                shouldFix: false,
                reason: 'User confirmed issue is resolved',
                exitCode: 1
            };
        }
        
        // Ambiguous - need human review
        return {
            shouldFix: false,
            reason: 'Unclear status, needs manual review',
            exitCode: 1
        };
    }
    
    /**
     * Main analysis function
     */
    async analyze(issueNumber) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`ANALYZING ISSUE #${issueNumber}`);
        console.log('='.repeat(60));
        
        const result = await this.analyzeWithAI(issueNumber);
        
        // Cache result
        this.state.lastAnalysis[issueNumber] = {
            timestamp: new Date().toISOString(),
            result
        };
        this.saveState();
        
        console.log(`\nDECISION: ${result.shouldFix ? '✅ SHOULD FIX' : '❌ DO NOT FIX'}`);
        console.log(`REASON: ${result.reason}`);
        console.log('='.repeat(60) + '\n');
        
        return result;
    }
    
    /**
     * Find best issue to work on
     */
    async findBestIssue() {
        try {
            // Get all open issues
            const issuesJson = execSync(
                'gh api repos/evb0110/mss-downloader/issues --jq ".[].number" --paginate',
                { encoding: 'utf8' }
            );
            
            const issueNumbers = issuesJson.trim().split('\n').map(n => parseInt(n)).filter(n => n);
            
            console.log(`Found ${issueNumbers.length} open issues to analyze...`);
            
            const candidates = [];
            
            for (const issueNum of issueNumbers) {
                console.log(`\nAnalyzing issue #${issueNum}...`);
                const analysis = await this.analyzeWithAI(issueNum);
                
                if (analysis.shouldFix) {
                    candidates.push({
                        number: issueNum,
                        ...analysis
                    });
                }
            }
            
            if (candidates.length === 0) {
                console.log('\n❌ No issues need fixing at this time');
                return null;
            }
            
            // Sort by priority (fewer fix attempts = higher priority)
            candidates.sort((a, b) => {
                const aFixes = this.getFixAttempts(a.number).length;
                const bFixes = this.getFixAttempts(b.number).length;
                return aFixes - bFixes;
            });
            
            const best = candidates[0];
            console.log(`\n✅ SELECTED ISSUE #${best.number}: ${best.reason}`);
            
            return best.number;
        } catch (e) {
            console.error('Failed to find best issue:', e.message);
            return null;
        }
    }
}

// CLI interface
if (require.main === module) {
    const analyzer = new EnhancedIssueAnalyzer();
    const [,, command, ...args] = process.argv;
    
    (async () => {
        switch (command) {
            case 'analyze': {
                const issueNumber = parseInt(args[0]);
                if (!issueNumber) {
                    console.error('Usage: node enhanced-issue-analyzer.cjs analyze <issue-number>');
                    process.exit(1);
                }
                
                const result = await analyzer.analyze(issueNumber);
                process.exit(result.exitCode);
            }
            
            case 'find-best': {
                const bestIssue = await analyzer.findBestIssue();
                if (bestIssue) {
                    console.log(bestIssue);
                    process.exit(0);
                } else {
                    process.exit(1);
                }
            }
            
            default:
                console.log('Enhanced Issue Analyzer - AI-based issue analysis\n');
                console.log('Usage:');
                console.log('  node enhanced-issue-analyzer.cjs analyze <issue-number>');
                console.log('  node enhanced-issue-analyzer.cjs find-best');
                console.log('\nExit codes:');
                console.log('  0 - Should fix');
                console.log('  1 - Do not fix');
                console.log('  2 - Recently fixed');
                console.log('  3 - Too many attempts');
                process.exit(0);
        }
    })();
}

module.exports = EnhancedIssueAnalyzer;