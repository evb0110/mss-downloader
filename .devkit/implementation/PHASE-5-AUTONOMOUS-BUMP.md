# Phase 5: Autonomous Version Bump Protocol

## Objective
If all tests pass, autonomously bump the version and release the critical fix to desperate users.

## Pre-Bump Validation

### Required Checks
1. All Phase 1-4 implementations complete
2. Comprehensive tests passed (>95% success rate)
3. No critical errors in test logs
4. PDF validation successful
5. Memory usage stable

## Version Bump Process

### Step 1: Determine Version Increment
Current version: Check package.json
Increment: PATCH (e.g., 1.4.99 → 1.4.100)

### Step 2: Update package.json
```javascript
const packageJson = require('./package.json');
const currentVersion = packageJson.version;
const versionParts = currentVersion.split('.');
versionParts[2] = (parseInt(versionParts[2]) + 1).toString();
const newVersion = versionParts.join('.');

packageJson.version = newVersion;
packageJson.changelog = [
    `v${newVersion}: 🚨 CRITICAL FIX: Manuscript splitting bug resolved`,
    "Fixed: All split parts now download correct page ranges (not duplicates)",
    "Fixed: Graz, Vatican, and all libraries properly handle multi-part downloads",
    "Improved: Page indexing accuracy for split manuscripts",
    "Validated: Comprehensive testing across 42+ supported libraries"
];
```

### Step 3: Git Commit
```bash
git add package.json package-lock.json
git add src/main/services/EnhancedManuscriptDownloaderService.ts
git add src/main/services/EnhancedDownloadQueue.ts
git add src/main/services/DownloadQueue.ts

git commit -m "$(cat <<'EOF'
🚨 CRITICAL FIX v${newVersion}: Resolve manuscript splitting duplicate pages bug

Major fixes:
- Split manuscripts now download correct page ranges for each part
- Fixed duplicate page bug affecting Graz, Vatican, and all auto-split downloads
- Preserved special processor support (Bordeaux tiles, Morgan .zif)
- Comprehensive validation across 42+ libraries

Technical changes:
- EnhancedManuscriptDownloaderService accepts pre-sliced pageLinks
- Queue passes correct page ranges to downloader
- Prevented manifest re-loading for split parts
- Maintained backward compatibility

Impact:
- Users no longer receive duplicate content in split manuscripts
- Correct page sequences in all parts
- No data loss or missing pages

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### Step 4: Build Verification
```bash
npm run lint
npm run build
```

### Step 5: GitHub Push
```bash
git push origin main
```

### Step 6: Monitor GitHub Actions
Wait for build to complete and verify Telegram notifications sent.

## Rollback Plan

If issues are detected post-release:

### Immediate Rollback
```bash
git revert HEAD
git push origin main
```

### Fix Forward
1. Identify the issue from user reports
2. Create hotfix branch
3. Apply minimal fix
4. Test specific failing case
5. Merge and bump patch version

## Success Metrics

### Immediate (1 hour):
- GitHub Actions build successful
- Telegram notification sent
- No crash reports

### Short-term (24 hours):
- User confirmations of fix working
- No regression reports
- Download completion rates improved

### Long-term (1 week):
- No duplicate page reports
- Successful multi-part downloads confirmed
- User satisfaction improved

## Autonomous Decision Tree

```
START
  |
  v
Tests Pass? --> NO --> Fix Issues --> Re-test
  |                                      ^
  YES                                    |
  |                                      |
  v                                      |
Critical Errors? --> YES ----------------+
  |
  NO
  |
  v
Regression Found? --> YES --> Document --> Fix --> Re-test
  |
  NO
  |
  v
PROCEED WITH BUMP
  |
  v
Update Version
  |
  v
Commit Changes
  |
  v
Run Build
  |
  v
Build Success? --> NO --> Fix Build --> Re-build
  |
  YES
  |
  v
Push to GitHub
  |
  v
Monitor Actions
  |
  v
Actions Success? --> NO --> Investigate --> Fix
  |
  YES
  |
  v
RELEASE COMPLETE
```

## User Communication

### Telegram Changelog Message
```
🚨 CRITICAL UPDATE v${newVersion} 🚨

Fixed the manuscript splitting bug where all parts were downloading the same pages!

✅ What's Fixed:
• Split manuscripts now download correct page ranges
• Part 1, Part 2, Part 3 each get their unique pages
• No more duplicate content or missing pages
• Graz, Vatican, and all libraries properly handled

🎯 Impact:
• If you downloaded split manuscripts recently, they may be incomplete
• Please re-download affected manuscripts with this version
• All 42+ supported libraries validated and working

📥 Download now to get the fix!

Thank you for your patience while we resolved this critical issue.
```

## Final Validation

Before declaring success:
1. Download one test manuscript with splitting
2. Verify each part has different pages
3. Merge parts to PDF
4. Open PDF and check page sequence
5. Confirm no duplicates visually

## Autonomous Execution Trigger

```javascript
async function autonomousBump() {
    // Check test results
    const testResults = require('.devkit/testing/test-results.json');
    
    if (testResults.summary.failed > 0) {
        console.log('❌ Tests failed, cannot bump');
        return false;
    }
    
    // Check for critical issues
    const criticalIssues = [
        'Bordeaux tile processing broken',
        'Morgan .zif handling failed',
        'Memory leak detected',
        'Crash during testing'
    ];
    
    for (const issue of criticalIssues) {
        if (testResults.results.errors.some(e => e.includes(issue))) {
            console.log(`❌ Critical issue detected: ${issue}`);
            return false;
        }
    }
    
    console.log('✅ All checks passed, proceeding with autonomous bump');
    return true;
}
```

## Authority to Execute
Given the critical nature of this bug (users losing days of downloads, getting incomplete data), and following the `/handle-issues` autonomous principles, this fix is authorized for autonomous execution upon successful testing.