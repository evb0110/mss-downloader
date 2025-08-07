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

// Keywords to detect EXPLICIT fix confirmations
// MUST be clear positive confirmation, not just politeness
const FIX_CONFIRMED_KEYWORDS = [
  // Russian - explicit confirmations only
  'всё работает', 'теперь работает', 'проблема решена', 
  'исправлено', 'всё исправлено', 'работает отлично',
  'работает корректно', 'успешно скачивает', 'всё ок',
  // English - explicit confirmations only  
  'it works', 'now works', 'problem solved', 'issue resolved',
  'fixed successfully', 'working perfectly', 'all good now',
  'successfully downloads', 'confirmed working',
  // Clear confirmation emojis
  '✅ работает', '✅ fixed', '👍 works'
];

// Politeness words that should NOT trigger closure
const POLITENESS_KEYWORDS = [
  'спасибо', 'thanks', 'благодарю', 'thank you'
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
      
      // Check if author confirms fix - require explicit confirmation
      // Must have confirmation keyword AND not be contradicted by problem keywords
      for (const keyword of FIX_CONFIRMED_KEYWORDS) {
        if (commentText.includes(keyword)) {
          // Check this isn't just politeness or partial success
          const hasProblemKeyword = PROBLEM_PERSISTS_KEYWORDS.some(pk => commentText.includes(pk));
          const isJustPoliteness = POLITENESS_KEYWORDS.some(pk => commentText.includes(pk)) && 
                                   commentText.length < 50; // Short "thanks" messages
          
          if (!hasProblemKeyword && !isJustPoliteness) {
            authorConfirmedFix = true;
            console.log(`  ✓ Found explicit confirmation: "${keyword}"`);
            break;
          }
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
    // Author EXPLICITLY confirmed fix works
    console.log(`✅ Author EXPLICITLY confirmed fix works!`);
    
    // Update validation state
    issueData.userValidated = true;
    issueData.validationDate = new Date().toISOString();
    
    // Close the issue with thank you message
    const closeMessage = `✅ Спасибо за подтверждение! Рад, что проблема решена.

Thank you for confirming! Glad the issue is resolved.

Closing this issue as VALIDATED and fixed in version ${fixVersion || 'latest'}.`;
    
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
    issueData.userValidated = false;
    issueData.requiresNewFix = true;
    
  } else if (fixComment && !lastAuthorComment) {
    // Fix posted but no author response yet
    const daysSinceFix = Math.floor((new Date() - new Date(fixComment.createdAt)) / (1000 * 60 * 60 * 24));
    console.log(`⏳ Waiting for author response (${daysSinceFix} days)`);
    
    if (daysSinceFix >= AUTO_CLOSE_DAYS) {
      // DO NOT auto-close - instead send a final reminder
      console.log(`⏰ ${AUTO_CLOSE_DAYS} days passed - sending final reminder (NOT auto-closing)`);
      
      if (!issueData.finalReminderSent) {
        const reminderMessage = `🔔 **Последнее напоминание / Final Reminder**

@${issue.author.login}, прошло ${AUTO_CLOSE_DAYS} дней с момента выпуска исправления в версии ${fixVersion || 'latest'}.

**Пожалуйста, подтвердите статус:**
- Если проблема решена, напишите "всё работает" или "problem solved"
- Если проблема остаётся, опишите, что именно не работает

Без вашего ответа мы не можем быть уверены, что проблема действительно решена.

---

It's been ${AUTO_CLOSE_DAYS} days since the fix was released in version ${fixVersion || 'latest'}.

**Please confirm the status:**
- If the issue is resolved, please write "it works" or "problem solved"
- If the problem persists, please describe what's still not working

Without your response, we cannot be sure the issue is truly resolved.`;
        
        try {
          execSync(`gh issue comment ${issue.number} --repo ${REPO} --body "${reminderMessage}"`, 
            { encoding: 'utf8' });
          console.log(`✅ Final reminder sent (issue remains open)`);
          issueData.finalReminderSent = new Date().toISOString();
        } catch (e) {
          console.log(`❌ Failed to send final reminder: ${e.message}`);
        }
      } else {
        console.log(`  Final reminder already sent on ${issueData.finalReminderSent}`);
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
console.log(`✅ Issues with EXPLICIT confirmed fixes: ${fixedIssues.length}`);
console.log(`🔒 Issues closed (with validation): ${closedCount}`);

// Count validation states
let validatedCount = 0;
let awaitingValidationCount = 0;
let problemPersistsCount = 0;

for (const [num, data] of Object.entries(checkedIssues)) {
  if (data.userValidated === true) validatedCount++;
  else if (data.status === 'problem_persists') problemPersistsCount++;
  else if (data.fixPosted) awaitingValidationCount++;
}

console.log(`\nValidation Status:`);
console.log(`  ✅ Validated by users: ${validatedCount}`);
console.log(`  ⏳ Awaiting validation: ${awaitingValidationCount}`);
console.log(`  ⚠️  Problem persists: ${problemPersistsCount}`);

if (fixedIssues.length > 0) {
  console.log('\nValidated and closed issues:');
  for (const fixed of fixedIssues) {
    console.log(`- #${fixed.number}: ${fixed.title} (${fixed.version || 'latest'}) - USER VALIDATED`);
  }
}

console.log('\n✅ Check complete!');