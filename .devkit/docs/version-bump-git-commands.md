# Version Bump Git Commands Reference

## 🚨 CRITICAL: Commands by User Intent

### When User Says "bump all"
```bash
# 1. Stage ALL files (modifications + untracked)
git add -A

# 2. Quality gates with ALL files staged
npm run precommit
npm run build

# 3. Version bump (after staging)
npm version patch --no-git-tag-version
git add package.json

# 4. Commit with transparency
git commit -m "🚀 v1.4.XXX: Description with all files

Files included:
$(git diff --cached --name-only | sed 's/^/- /')

$(if git diff --cached --name-only --diff-filter=A | grep -q .; then
    echo "Untracked files added (prevents build failures):"
    git diff --cached --name-only --diff-filter=A | sed 's/^/- /'
    echo ""
fi)

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### When User Says "bump" (only)
```bash
# 1. Stage tracked modifications only
git add -u

# 2. Quality gates with staged files
npm run precommit  
npm run build

# 3. Version bump
npm version patch --no-git-tag-version
git add package.json

# 4. Commit
git commit -m "🚀 v1.4.XXX: Description

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## 🛡️ Safety Commands (ALWAYS run first)

### Pre-bump Safety Check
```bash
# Run safety analysis
.devkit/scripts/version-bump-safety-check.sh

# Manual inspection
git status --porcelain
git ls-files --others --exclude-standard  # Untracked files
git diff --cached --name-status           # Currently staged
```

### Emergency Recovery (If Build Fails)
```bash
# Find the missing file from build error
gh run view FAILED_RUN_ID --log-failed | grep "Could not resolve"

# Add missing file and fix immediately  
git add missing-file.ts
git commit -m "fix(build): add missing [filename] to resolve import errors"
git push origin main

# Verify fix worked
gh run list --limit 1
```

## 🔧 Automated Safe Process

### Use the Safe Version Bump Script
```bash
# For "bump all" - includes ALL files
.devkit/scripts/safe-version-bump.cjs bump-all patch

# For "bump" - tracked modifications only  
.devkit/scripts/safe-version-bump.cjs bump patch

# For minor/major versions
.devkit/scripts/safe-version-bump.cjs bump-all minor
.devkit/scripts/safe-version-bump.cjs bump-all major
```

## ⚠️ FORBIDDEN Commands (Cause Disasters)

### NEVER Do This for Version Bumps
```bash
# ❌ WRONG - Only stages package.json, misses dependencies
git add package.json
git commit -m "bump version"

# ❌ WRONG - Runs quality gates before staging files
npm run precommit
git add -A  

# ❌ WRONG - No verification of what's being committed
git add -A && git commit -m "version bump" && git push
```

## 📊 Success Verification

### After Every Version Bump
```bash
# 1. Push immediately
git push origin main

# 2. Monitor build (wait ~30 seconds)
gh run list --limit 1

# 3. Check for failures
gh run view LATEST_RUN_ID --log-failed

# 4. Success indicators
# - Status: "completed"  
# - Conclusion: "success"
# - No "Could not resolve" errors
# - Telegram notification sent
```

## 🎯 The Golden Rule

**When user says "bump all", literally include ALL files - no exceptions, no missed dependencies, no build failures.**

The GlobalDziCache.ts disaster proved that missing even one untracked file can cause catastrophic deployment failures. These commands ensure that NEVER happens again.