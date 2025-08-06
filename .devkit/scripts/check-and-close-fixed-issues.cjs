#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const REPO = 'evb0110/mss-downloader';
const DATA_FILE = path.join(__dirname, '../data/checked-issues.json');
const FOLLOW_UP_DAYS = 3;
const AUTO_CLOSE_DAYS = 7;

// Ensure data directory exists
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load existing data
let checkedIssues = {};
if (fs.existsSync(DATA_FILE)) {
  try {
    checkedIssues = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.log('⚠️  Could not load existing data, starting fresh');
  }
}

// Keywords to detect fix confirmations
const FIX_CONFIRMED_KEYWORDS = [
  // Russian
  'работает', 'исправлено', 'спасибо', 'теперь работает', 
  'всё ок', 'проблема решена', 'успешно', 'отлично',
  // English
  'works', 'fixed', 'thanks', 'now works', 
  'all good', 'problem solved', 'successfully', 'excellent', 'perfect',
  // Emojis
  '✅', '👍'
];

// Keywords to detect problem persistence
const PROBLEM_PERSISTS_KEYWORDS = [
  // Russian
  'не работает', 'всё ещё', 'ошибка', 'проблема', 'не исправлено',
  // English
  'not working', 'still broken', 'still not', 'error', 'problem', 'not fixed',
  // Emojis
  '❌', '👎'
];

console.log('🚀 GitHub Issue Fix Checker');
console.log('');

// Fetch all open issues
console.log('🔍 Fetching all open issues...');
const issuesJson = execSync(
  `gh issue list --repo ${REPO} --state open --json number,title,state,author,comments,createdAt --limit 1000`,
  { encoding: 'utf8' }
);

const issues = JSON.parse(issuesJson);
console.log(`Found ${issues.length} open issues`);
console.log('');

let fixedIssues = [];
let closedCount = 0;

// Process each issue
for (const issue of issues) {
  console.log(`📋 Processing Issue #${issue.number}: ${issue.title}`);
  
  // Check if we've already tracked this issue
  if (!checkedIssues[issue.number]) {
    checkedIssues[issue.number] = {
      firstChecked: new Date().toISOString(),
      lastChecked: new Date().toISOString(),
      fixPosted: null,
      followUpSent: null,
      status: 'open'
    };
  }
  
  const issueData = checkedIssues[issue.number];
  issueData.lastChecked = new Date().toISOString();
  
  // Find fix announcements and author responses
  let fixVersion = null;
  let fixComment = null;
  let authorConfirmedFix = false;
  let authorReportsProblem = false;
  let lastAuthorComment = null;
  
  for (const comment of issue.comments) {
    const commentText = comment.body.toLowerCase();
    const isAuthor = comment.author.login === issue.author.login;
    const isOwner = comment.author.login === 'evb0110';
    
    // Check for fix announcements from owner
    if (isOwner && (commentText.includes('исправлено в версии') || 
                    commentText.includes('fixed in version') ||
                    commentText.includes('решена в версии'))) {
      fixComment = comment;
      // Extract version number
      const versionMatch = comment.body.match(/(\d+\.\d+\.\d+)/);
      if (versionMatch) {
        fixVersion = versionMatch[1];
        issueData.fixPosted = comment.createdAt;
      }
    }
    
    // Check author responses after fix
    if (isAuthor && fixComment && new Date(comment.createdAt) > new Date(fixComment.createdAt)) {
      lastAuthorComment = comment;
      
      // Check if author confirms fix
      for (const keyword of FIX_CONFIRMED_KEYWORDS) {
        if (commentText.includes(keyword)) {
          authorConfirmedFix = true;
          break;
        }
      }
      
      // Check if author reports problem persists
      for (const keyword of PROBLEM_PERSISTS_KEYWORDS) {
        if (commentText.includes(keyword)) {
          authorReportsProblem = true;
          break;
        }
      }
    }
  }
  
  // Decide action based on findings
  if (authorConfirmedFix && !authorReportsProblem) {
    // Author confirmed fix works
    console.log(`✅ Author confirmed fix works!`);
    
    // Close the issue with thank you message
    const closeMessage = `✅ Спасибо за подтверждение! Рад, что проблема решена.

Thank you for confirming! Glad the issue is resolved.

Closing this issue as fixed in version ${fixVersion || 'latest'}.`;
    
    try {
      execSync(`gh issue close ${issue.number} --repo ${REPO} --comment "${closeMessage}"`, 
        { encoding: 'utf8' });
      console.log(`✅ Issue #${issue.number} closed successfully`);
      closedCount++;
      fixedIssues.push({ number: issue.number, title: issue.title, version: fixVersion });
      issueData.status = 'closed';
    } catch (e) {
      console.log(`❌ Failed to close issue #${issue.number}: ${e.message}`);
    }
    
  } else if (authorReportsProblem) {
    // Author says problem persists
    console.log(`⚠️  Author reports problem still exists`);
    issueData.status = 'problem_persists';
    
  } else if (fixComment && !lastAuthorComment) {
    // Fix posted but no author response yet
    const daysSinceFix = Math.floor((new Date() - new Date(fixComment.createdAt)) / (1000 * 60 * 60 * 24));
    console.log(`⏳ Waiting for author response (${daysSinceFix} days)`);
    
    if (daysSinceFix >= AUTO_CLOSE_DAYS) {
      // Auto-close after 7 days
      console.log(`🔒 Auto-closing after ${AUTO_CLOSE_DAYS} days without response`);
      
      const closeMessage = `🔒 Закрываю issue автоматически, так как не было ответа в течение ${AUTO_CLOSE_DAYS} дней после исправления.

Если проблема всё ещё существует, пожалуйста, откройте новый issue.

---

Closing automatically as there has been no response for ${AUTO_CLOSE_DAYS} days after the fix.

If the problem still exists, please open a new issue.`;
      
      try {
        execSync(`gh issue close ${issue.number} --repo ${REPO} --comment "${closeMessage}"`, 
          { encoding: 'utf8' });
        console.log(`✅ Issue #${issue.number} auto-closed`);
        closedCount++;
        fixedIssues.push({ number: issue.number, title: issue.title, version: fixVersion, autoClosed: true });
        issueData.status = 'auto_closed';
      } catch (e) {
        console.log(`❌ Failed to auto-close issue #${issue.number}: ${e.message}`);
      }
      
    } else if (daysSinceFix >= FOLLOW_UP_DAYS && !issueData.followUpSent) {
      // Send follow-up after 3 days
      console.log(`📢 Sending follow-up request`);
      
      const followUpMessage = `👋 Здравствуйте @${issue.author.login}!

Версия ${fixVersion || 'с исправлением'} была выпущена ${daysSinceFix} дня назад.

Пожалуйста, проверьте, решена ли ваша проблема, и дайте знать, работает ли всё корректно.

---

Hello @${issue.author.login}!

Version ${fixVersion || 'with the fix'} was released ${daysSinceFix} days ago.

Please check if your issue is resolved and let us know if everything works correctly.`;
      
      try {
        execSync(`gh issue comment ${issue.number} --repo ${REPO} --body "${followUpMessage}"`, 
          { encoding: 'utf8' });
        console.log(`✅ Follow-up sent`);
        issueData.followUpSent = new Date().toISOString();
      } catch (e) {
        console.log(`❌ Failed to send follow-up: ${e.message}`);
      }
    }
    
  } else {
    // No fix posted yet
    console.log(`🔍 No fix has been posted yet`);
  }
  
  console.log('');
}

// Save updated data
fs.writeFileSync(DATA_FILE, JSON.stringify(checkedIssues, null, 2));

// Print summary
console.log('='.repeat(61));
console.log('📊 SUMMARY');
console.log('='.repeat(61));
console.log(`Total open issues checked: ${issues.length}`);
console.log(`✅ Issues with confirmed fixes: ${fixedIssues.filter(i => !i.autoClosed).length}`);
console.log(`🔒 Issues closed: ${closedCount}`);

if (fixedIssues.length > 0) {
  console.log('\nFixed issues:');
  for (const fixed of fixedIssues) {
    const autoCloseLabel = fixed.autoClosed ? ' (auto-closed)' : '';
    console.log(`- #${fixed.number}: ${fixed.title} (${fixed.version || 'latest'})${autoCloseLabel}`);
  }
}

console.log('\n✅ Check complete!');