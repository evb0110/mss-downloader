#!/usr/bin/env node

/**
 * Issue State Tracker - Prevents duplicate fixes and tracks issue resolution history
 * 
 * This script maintains a state file tracking:
 * - Which issues have been attempted
 * - How many times each issue was "fixed"
 * - Whether users confirmed fixes worked
 * - What the actual root causes were
 * 
 * This prevents the duplicate fix problem where multiple versions claim to fix the same issue
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const STATE_FILE = path.join(__dirname, '../data/issue-state.json');
const STATE_DIR = path.join(__dirname, '../data');

class IssueStateTracker {
    constructor() {
        this.ensureStateFile();
        this.state = this.loadState();
    }

    ensureStateFile() {
        if (!fs.existsSync(STATE_DIR)) {
            fs.mkdirSync(STATE_DIR, { recursive: true });
        }
        
        if (!fs.existsSync(STATE_FILE)) {
            const initialState = {
                issues: {},
                metadata: {
                    created: new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                    version: '1.0.0'
                }
            };
            fs.writeFileSync(STATE_FILE, JSON.stringify(initialState, null, 2));
        }
    }

    loadState() {
        try {
            return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        } catch (error) {
            console.error('❌ Error loading state:', error.message);
            return { issues: {}, metadata: {} };
        }
    }

    saveState() {
        this.state.metadata.lastUpdated = new Date().toISOString();
        fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
    }

    /**
     * Check if an issue has been attempted before
     */
    checkDuplicateRisk(issueNumber) {
        const issue = this.state.issues[issueNumber];
        
        if (!issue) {
            console.log(`✅ Issue #${issueNumber}: No previous fix attempts`);
            return { safe: true, attempts: 0 };
        }

        const attempts = issue.fixAttempts || [];
        console.log(`⚠️  Issue #${issueNumber}: ${attempts.length} previous fix attempts`);
        
        if (attempts.length >= 2) {
            console.log('🚨 HIGH DUPLICATE RISK - Multiple previous fixes!');
            console.log('\nPrevious attempts:');
            attempts.forEach(attempt => {
                console.log(`  - v${attempt.version} (${attempt.date}): ${attempt.description}`);
                if (attempt.userValidated === false) {
                    console.log('    ❌ User reported this fix didn\'t work');
                } else if (attempt.userValidated === true) {
                    console.log('    ✅ User confirmed this fix worked');
                }
            });
            
            // Check if any fix was validated as working
            const hasWorkingFix = attempts.some(a => a.userValidated === true);
            if (hasWorkingFix) {
                console.log('\n🛑 STOP: Issue already has a validated working fix!');
                return { safe: false, attempts: attempts.length, reason: 'already_fixed' };
            }
            
            console.log('\n🔍 Previous fixes failed - need deeper analysis');
            return { safe: 'caution', attempts: attempts.length, reason: 'multiple_failed_attempts' };
        }
        
        return { safe: 'proceed_with_caution', attempts: attempts.length };
    }

    /**
     * Record a new fix attempt
     */
    recordFixAttempt(issueNumber, version, description, rootCause = null) {
        if (!this.state.issues[issueNumber]) {
            this.state.issues[issueNumber] = {
                number: issueNumber,
                firstSeen: new Date().toISOString(),
                fixAttempts: [],
                status: 'in_progress'
            };
        }

        const attempt = {
            version,
            date: new Date().toISOString(),
            description,
            rootCause,
            userValidated: null,  // Unknown until user confirms
            commitHash: this.getCurrentCommitHash()
        };

        this.state.issues[issueNumber].fixAttempts.push(attempt);
        this.state.issues[issueNumber].lastAttempt = new Date().toISOString();
        
        this.saveState();
        
        console.log(`📝 Recorded fix attempt for Issue #${issueNumber} in v${version}`);
    }

    /**
     * Update validation status based on user feedback
     */
    updateValidationStatus(issueNumber, version, validated) {
        const issue = this.state.issues[issueNumber];
        if (!issue) {
            console.error(`❌ Issue #${issueNumber} not found in state`);
            return;
        }

        const attempt = issue.fixAttempts.find(a => a.version === version);
        if (!attempt) {
            console.error(`❌ No fix attempt found for Issue #${issueNumber} v${version}`);
            return;
        }

        attempt.userValidated = validated;
        attempt.validatedDate = new Date().toISOString();
        
        if (validated) {
            issue.status = 'resolved';
            issue.resolvedVersion = version;
            issue.resolvedDate = new Date().toISOString();
            console.log(`✅ Issue #${issueNumber} marked as RESOLVED in v${version}`);
        } else {
            issue.status = 'needs_work';
            console.log(`🔄 Issue #${issueNumber} still needs work after v${version}`);
        }
        
        this.saveState();
    }

    /**
     * Analyze patterns across all issues
     */
    analyzePatterns() {
        const stats = {
            totalIssues: Object.keys(this.state.issues).length,
            resolvedIssues: 0,
            duplicateFixIssues: 0,
            totalFixAttempts: 0,
            averageAttemptsPerIssue: 0,
            worstOffenders: []
        };

        for (const [issueNum, issue] of Object.entries(this.state.issues)) {
            const attempts = issue.fixAttempts.length;
            stats.totalFixAttempts += attempts;
            
            if (issue.status === 'resolved') {
                stats.resolvedIssues++;
            }
            
            if (attempts >= 2) {
                stats.duplicateFixIssues++;
                stats.worstOffenders.push({
                    issue: issueNum,
                    attempts,
                    versions: issue.fixAttempts.map(a => a.version)
                });
            }
        }

        stats.averageAttemptsPerIssue = stats.totalFixAttempts / stats.totalIssues;
        stats.worstOffenders.sort((a, b) => b.attempts - a.attempts);

        console.log('\n📊 ISSUE TRACKING STATISTICS');
        console.log('─'.repeat(50));
        console.log(`Total Issues Tracked: ${stats.totalIssues}`);
        console.log(`Resolved Issues: ${stats.resolvedIssues}`);
        console.log(`Issues with Duplicate Fixes: ${stats.duplicateFixIssues}`);
        console.log(`Average Fix Attempts per Issue: ${stats.averageAttemptsPerIssue.toFixed(2)}`);
        
        if (stats.worstOffenders.length > 0) {
            console.log('\n🚨 Issues with Most Duplicate Fixes:');
            stats.worstOffenders.slice(0, 5).forEach(issue => {
                console.log(`  Issue #${issue.issue}: ${issue.attempts} attempts (v${issue.versions.join(', v')})`);
            });
        }
        
        return stats;
    }

    /**
     * Get current git commit hash
     */
    getCurrentCommitHash() {
        try {
            return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * Clean up old or resolved issues
     */
    cleanup(daysOld = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        
        let cleaned = 0;
        
        for (const [issueNum, issue] of Object.entries(this.state.issues)) {
            if (issue.status === 'resolved' && issue.resolvedDate) {
                const resolvedDate = new Date(issue.resolvedDate);
                if (resolvedDate < cutoffDate) {
                    delete this.state.issues[issueNum];
                    cleaned++;
                }
            }
        }
        
        if (cleaned > 0) {
            this.saveState();
            console.log(`🧹 Cleaned up ${cleaned} old resolved issues`);
        }
    }
}

// CLI Interface
if (require.main === module) {
    const tracker = new IssueStateTracker();
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
        case 'check':
            const issueNum = args[1];
            if (!issueNum) {
                console.error('Usage: issue-state-tracker check <issue-number>');
                process.exit(1);
            }
            const result = tracker.checkDuplicateRisk(issueNum);
            process.exit(result.safe === true ? 0 : 1);
            break;
            
        case 'record':
            const issue = args[1];
            const version = args[2];
            const description = args.slice(3).join(' ');
            if (!issue || !version || !description) {
                console.error('Usage: issue-state-tracker record <issue> <version> <description>');
                process.exit(1);
            }
            tracker.recordFixAttempt(issue, version, description);
            break;
            
        case 'validate':
            const vIssue = args[1];
            const vVersion = args[2];
            const validated = args[3] === 'true';
            if (!vIssue || !vVersion || args[3] === undefined) {
                console.error('Usage: issue-state-tracker validate <issue> <version> <true|false>');
                process.exit(1);
            }
            tracker.updateValidationStatus(vIssue, vVersion, validated);
            break;
            
        case 'analyze':
            tracker.analyzePatterns();
            break;
            
        case 'cleanup':
            const days = parseInt(args[1]) || 90;
            tracker.cleanup(days);
            break;
            
        default:
            console.log('Issue State Tracker - Prevents duplicate fixes\n');
            console.log('Commands:');
            console.log('  check <issue>                    - Check if issue has duplicate fix risk');
            console.log('  record <issue> <version> <desc>  - Record a new fix attempt');
            console.log('  validate <issue> <version> <t/f> - Update validation status');
            console.log('  analyze                          - Show patterns and statistics');
            console.log('  cleanup [days]                   - Remove old resolved issues');
            break;
    }
}

module.exports = IssueStateTracker;