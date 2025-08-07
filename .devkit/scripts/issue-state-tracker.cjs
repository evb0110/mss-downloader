#!/usr/bin/env node

/**
 * Issue State Tracker
 * Tracks validation state for GitHub issues to prevent premature closure
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const STATE_FILE = path.join(__dirname, '../data/issue-validation-state.json');
const REPO = 'evb0110/mss-downloader';

// Ensure data directory exists
const dataDir = path.dirname(STATE_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load existing state
let state = {
  issues: {},
  metadata: {
    created: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    version: '2.0.0' // v2 with proper validation tracking
  }
};

if (fs.existsSync(STATE_FILE)) {
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) {
    console.log('⚠️  Could not load existing state, starting fresh');
  }
}

class IssueStateTracker {
  constructor() {
    this.state = state;
  }

  /**
   * Record a fix attempt for an issue
   */
  recordFixAttempt(issueNumber, version, description) {
    if (!this.state.issues[issueNumber]) {
      this.state.issues[issueNumber] = {
        number: issueNumber,
        firstSeen: new Date().toISOString(),
        fixAttempts: [],
        validationState: 'pending',
        userValidated: null,
        lastUserResponse: null
      };
    }

    const issue = this.state.issues[issueNumber];
    issue.fixAttempts.push({
      version,
      date: new Date().toISOString(),
      description,
      userValidated: null
    });

    this.save();
    console.log(`📝 Recorded fix attempt for Issue #${issueNumber} in v${version}`);
  }

  /**
   * Update validation state based on user response
   */
  updateValidation(issueNumber, validated, userComment = null) {
    const issue = this.state.issues[issueNumber];
    if (!issue) {
      console.log(`⚠️  No record of Issue #${issueNumber}`);
      return;
    }

    issue.userValidated = validated;
    issue.validationState = validated ? 'validated' : 'failed';
    issue.lastUserResponse = {
      date: new Date().toISOString(),
      validated,
      comment: userComment
    };

    // Update the latest fix attempt
    if (issue.fixAttempts.length > 0) {
      issue.fixAttempts[issue.fixAttempts.length - 1].userValidated = validated;
    }

    this.save();
    console.log(`✅ Updated validation state for Issue #${issueNumber}: ${validated ? 'VALIDATED' : 'FAILED'}`);
  }

  /**
   * Check if an issue can be closed
   */
  canClose(issueNumber) {
    const issue = this.state.issues[issueNumber];
    if (!issue) return false;

    // Only close if explicitly validated by user
    return issue.userValidated === true;
  }

  /**
   * Check for duplicate fix attempts
   */
  checkDuplicateFixes(issueNumber) {
    const issue = this.state.issues[issueNumber];
    if (!issue) return { isDuplicate: false, attempts: 0 };

    const attempts = issue.fixAttempts.length;
    const unvalidated = issue.fixAttempts.filter(f => f.userValidated !== true).length;

    return {
      isDuplicate: attempts >= 2,
      attempts,
      unvalidated,
      lastValidation: issue.userValidated,
      requiresNewApproach: attempts >= 3 && !issue.userValidated
    };
  }

  /**
   * Generate report
   */
  generateReport() {
    const report = {
      totalIssues: Object.keys(this.state.issues).length,
      validated: 0,
      failed: 0,
      pending: 0,
      duplicateFixes: [],
      requiresAttention: []
    };

    for (const [num, issue] of Object.entries(this.state.issues)) {
      if (issue.userValidated === true) report.validated++;
      else if (issue.userValidated === false) report.failed++;
      else report.pending++;

      if (issue.fixAttempts.length >= 2) {
        report.duplicateFixes.push({
          number: num,
          attempts: issue.fixAttempts.length,
          validated: issue.userValidated
        });
      }

      if (issue.fixAttempts.length >= 3 && !issue.userValidated) {
        report.requiresAttention.push({
          number: num,
          attempts: issue.fixAttempts.length,
          reason: 'Multiple failed fix attempts'
        });
      }
    }

    return report;
  }

  /**
   * Save state to file
   */
  save() {
    this.state.metadata.lastUpdated = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
  }

  /**
   * Sync with GitHub to update validation states
   */
  async syncWithGitHub() {
    console.log('🔄 Syncing with GitHub...');
    
    try {
      const issuesJson = execSync(
        `gh issue list --repo ${REPO} --state all --json number,state,comments --limit 1000`,
        { encoding: 'utf8' }
      );
      
      const issues = JSON.parse(issuesJson);
      
      for (const ghIssue of issues) {
        if (!this.state.issues[ghIssue.number]) continue;
        
        const issue = this.state.issues[ghIssue.number];
        
        // Check latest comments for validation
        const recentComments = ghIssue.comments.slice(-5); // Last 5 comments
        
        for (const comment of recentComments) {
          const text = comment.body.toLowerCase();
          
          // Check for explicit validation
          if (text.includes('всё работает') || text.includes('problem solved') || 
              text.includes('it works') || text.includes('проблема решена')) {
            if (!issue.userValidated) {
              this.updateValidation(ghIssue.number, true, comment.body);
            }
          } else if (text.includes('не работает') || text.includes('still broken') ||
                     text.includes('not working') || text.includes('проблема остаётся')) {
            if (issue.userValidated !== false) {
              this.updateValidation(ghIssue.number, false, comment.body);
            }
          }
        }
        
        // Update issue state
        if (ghIssue.state === 'closed' && !issue.closedDate) {
          issue.closedDate = new Date().toISOString();
          issue.closedWithValidation = issue.userValidated === true;
        }
      }
      
      this.save();
      console.log('✅ Sync complete');
      
    } catch (e) {
      console.error('❌ Sync failed:', e.message);
    }
  }
}

// CLI Interface
const command = process.argv[2];
const tracker = new IssueStateTracker();

switch (command) {
  case 'record':
    const [issueNum, version, ...descParts] = process.argv.slice(3);
    tracker.recordFixAttempt(issueNum, version, descParts.join(' '));
    break;
    
  case 'validate':
    const [issueToValidate, isValid] = process.argv.slice(3);
    tracker.updateValidation(issueToValidate, isValid === 'true');
    break;
    
  case 'check':
    const issueToCheck = process.argv[3];
    const result = tracker.checkDuplicateFixes(issueToCheck);
    console.log(JSON.stringify(result, null, 2));
    if (result.requiresNewApproach) {
      console.log('⚠️  This issue requires a completely new approach!');
      process.exit(1); // Signal to stop
    }
    break;
    
  case 'can-close':
    const issueToClose = process.argv[3];
    const canClose = tracker.canClose(issueToClose);
    console.log(canClose ? 'YES' : 'NO');
    process.exit(canClose ? 0 : 1);
    break;
    
  case 'report':
    const report = tracker.generateReport();
    console.log('📊 Issue Validation Report');
    console.log('='.repeat(40));
    console.log(`Total Issues: ${report.totalIssues}`);
    console.log(`✅ Validated: ${report.validated}`);
    console.log(`❌ Failed: ${report.failed}`);
    console.log(`⏳ Pending: ${report.pending}`);
    
    if (report.duplicateFixes.length > 0) {
      console.log('\n🔄 Issues with Multiple Fix Attempts:');
      for (const dup of report.duplicateFixes) {
        console.log(`  - Issue #${dup.number}: ${dup.attempts} attempts (validated: ${dup.validated})`);
      }
    }
    
    if (report.requiresAttention.length > 0) {
      console.log('\n⚠️  Issues Requiring Attention:');
      for (const issue of report.requiresAttention) {
        console.log(`  - Issue #${issue.number}: ${issue.reason}`);
      }
    }
    break;
    
  case 'sync':
    tracker.syncWithGitHub();
    break;
    
  default:
    console.log('Usage:');
    console.log('  node issue-state-tracker.cjs record <issue> <version> <description>');
    console.log('  node issue-state-tracker.cjs validate <issue> <true|false>');
    console.log('  node issue-state-tracker.cjs check <issue>');
    console.log('  node issue-state-tracker.cjs can-close <issue>');
    console.log('  node issue-state-tracker.cjs report');
    console.log('  node issue-state-tracker.cjs sync');
}