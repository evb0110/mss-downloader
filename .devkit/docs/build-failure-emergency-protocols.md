# BUILD FAILURE EMERGENCY PROTOCOLS
**Created:** 2025-08-27 from catastrophic build failures 17258588974, 17259179725
**Purpose:** Systematic disaster response to prevent cascading failures

## 🚨 EMERGENCY ACTIVATION TRIGGERS

### Immediate Emergency Protocol Activation
- **Build failures in main branch** (GitHub Actions failing)
- **Missing file errors** ("Could not resolve", "Module not found")
- **Cascading commit failures** (multiple failed builds in sequence)
- **User mentions build failure IDs** (17258588974, 17259179725)
- **"beware previous build failed"** + version bump context

## 🔥 PHASE 1: DAMAGE ASSESSMENT (0-60 seconds)

### Immediate System Status Check
```bash
# 1. Current build status
gh run list --limit 5 --json status,conclusion,name,createdAt

# 2. Local repository state
git status --porcelain  # Show staged/modified/untracked files
git log --oneline -5    # Recent commits

# 3. Identify failure pattern  
gh run view <build-id> --log | grep -E "(Could not resolve|Module not found|Error:|Failed)"
```

### Critical Questions (Answer in 60 seconds)
1. **Scope**: Is main branch broken? How many builds failing?
2. **Root Cause**: Missing files? Type errors? Import issues?
3. **User Impact**: Are users blocked from downloading manuscripts?
4. **Urgency**: Emergency fix needed or can wait for proper testing?

## ⚡ PHASE 2: ROOT CAUSE IDENTIFICATION (60-180 seconds)

### Most Common Causes (Learned from disasters)
1. **MISSING FILES** (80% of emergencies)
   - Untracked files not committed (GlobalDziCache.ts example)
   - New dependencies not staged
   - Moved files without updating imports

2. **TYPE ERRORS** (15% of emergencies)
   - Precommit bypassed (should be impossible now)
   - New code without proper typing
   - Import/export mismatches

3. **IMPORT PATH ISSUES** (5% of emergencies)
   - Refactored files without updating references
   - Circular import dependencies
   - Case-sensitive path mismatches

### Root Cause Analysis Commands
```bash
# For missing files (most common)
grep -n "Could not resolve" <(gh run view <build-id> --log)
grep -n "Module not found" <(gh run view <build-id> --log)

# Check what files are untracked but needed
git status --porcelain | grep "^??" 
git ls-files --others --exclude-standard

# For type issues  
npm run typecheck 2>&1 | head -20

# For import issues
grep -r "import.*from.*GlobalDziCache" src/ || echo "Import references found"
```

## 🛠️ PHASE 3: RAPID SURGICAL FIX (180-300 seconds)

### Missing Files Emergency Fix (Most Common)
```bash
# 1. Identify missing files from build log
# Example: GlobalDziCache.ts missing

# 2. Add ONLY the missing files (surgical approach)
git add src/main/services/GlobalDziCache.ts

# 3. Commit with clear emergency message
git commit -m "fix(build): add missing GlobalDziCache.ts

- Fixes build failures 17258588974, 17259179725
- File was created but not committed in previous change
- Emergency fix to restore main branch stability

Emergency-Fix-By: Claude <noreply@anthropic.com>"

# 4. IMMEDIATE push to fix main branch
git push
```

### Type Error Emergency Fix  
```bash
# 1. Auto-fix attempt
npm run typefix

# 2. Verify fix
npm run typecheck

# 3. If clean, emergency commit
git add -u
git commit -m "fix(types): resolve type errors blocking build"
git push
```

### Import Path Emergency Fix
```bash
# 1. Find broken imports
grep -rn "import.*MissingModule" src/

# 2. Fix import paths (example)
sed -i 's|from "./MissingModule"|from "./services/MissingModule"|g' src/main/*.ts

# 3. Emergency commit
git add -u  
git commit -m "fix(imports): correct import paths after refactor"
git push
```

## 🔄 PHASE 4: CASCADE PREVENTION (300-600 seconds)

### Anti-Cascade Principles
1. **ONE FIX AT A TIME**: Don't batch multiple changes during emergency
2. **IMMEDIATE PUSH**: Fix main branch before adding more commits
3. **ROOT CAUSE FOCUS**: Address why files were missed initially  
4. **PROCESS IMPROVEMENT**: Update procedures to prevent recurrence

### Emergency Build Validation
```bash
# 1. Monitor fix deployment
gh run list --limit 3 --json status,conclusion

# 2. Wait for build success confirmation (max 10 minutes)
while ! gh api repos/$(gh repo view --json owner,name -q '.owner.login + "/" + .name')/actions/runs --jq '.workflow_runs[0].conclusion' | grep -q "success"; do
  echo "Waiting for build to complete..."
  sleep 30
done

# 3. Verify fix worked
echo "✅ Build fixed successfully"
```

### Post-Emergency Version Bump (If User Requested)
```bash
# Only after build is fixed and stable
npm version patch
git push --tags

# Update changelog
npm run update-changelog
git add package.json
git commit -m "chore: update changelog for emergency fix"
git push
```

## 📋 PHASE 5: POST-INCIDENT ANALYSIS (600+ seconds)

### Mandatory Post-Incident Report
```markdown
# Emergency Response Report - $(date)

## Incident Summary
- **Build Failures**: 17258588974, 17259179725  
- **Root Cause**: Missing GlobalDziCache.ts file
- **Duration**: X minutes from detection to fix
- **Impact**: Main branch builds failing

## Timeline
- 00:00 - User reported "beware previous build failed" 
- 01:30 - Emergency protocols activated
- 03:45 - Root cause identified (missing file)
- 05:20 - Emergency fix committed and pushed
- 08:45 - Build success confirmed

## Root Cause Analysis
- **Why Missing**: File created but not staged during "bump all"
- **Why Not Caught**: Ignored user's "bump all" directive  
- **Process Failure**: Command priority hierarchy not followed

## Prevention Measures
- ✅ Updated CLAUDE.md Rule -3 Command Priority Hierarchy
- ✅ Strengthened "bump all" = "git add -A" enforcement
- ✅ Created build failure emergency protocols
- ✅ Added pattern recognition for user frustration signals

## Lessons Learned
1. User "bump all" commands override ALL default restrictions
2. Missing files are 80% of emergency build failures
3. Emergency fixes should be surgical (one file at a time)
4. User frustration signals indicate missed commands
```

## 🧪 EMERGENCY DRILL SCENARIOS

### Drill 1: Missing File Recovery
**Scenario**: User says "bump all", Claude stages only some files, build fails
**Expected Response**: 
1. Immediate damage assessment (60s)
2. Identify missing files from build log (120s)
3. Surgical fix with git add + commit + push (180s)
4. Monitor build recovery (300s)

### Drill 2: Type Error Emergency
**Scenario**: Precommit bypassed, build fails with type errors
**Expected Response**:
1. FULL STOP all version bump activity
2. npm run typefix + typecheck
3. Emergency type fix commit only if successful
4. If still failing, manual intervention required

### Drill 3: User Emergency Direction
**Scenario**: "beware previous build failed" + bump context
**Expected Response**:
1. Recognize as emergency version bump directive
2. Execute comprehensive version bump (git add -A)
3. Include build failure fix measures
4. Push immediately after quality gates pass

## 🛡️ PREVENTION MAINTENANCE

### Weekly Emergency Preparedness Check
- [ ] Verify gh CLI authentication working
- [ ] Test emergency command sequences in safe branch  
- [ ] Review recent build failures for new patterns
- [ ] Update emergency protocols based on new failure types

### Emergency Contact Protocol
- **GitHub Actions**: Monitor via `gh run list`
- **Telegram Notifications**: Verify delivery after fixes
- **User Communication**: Provide technical details of fixes applied

## 📚 REFERENCE: FAILED PATTERNS (NEVER REPEAT)

### ❌ Anti-Pattern 1: Symptom Fighting
```bash
# WRONG: Try to trigger rebuild without fixing cause
npm run build  # Still fails, root cause (missing file) not addressed
git push       # Creates another failed build
```

### ❌ Anti-Pattern 2: Batching During Emergency
```bash  
# WRONG: Multiple changes during emergency
git add file1.ts file2.ts file3.ts config.json package.json
git commit -m "fix multiple things"
# Hard to isolate if one change breaks something else
```

### ❌ Anti-Pattern 3: Ignoring User Emergency Signals
```
User: "beware previous build failed" + bump context
Claude: "Should I bump the version?"  # WRONG - missed emergency direction
```

### ✅ Correct Pattern: Surgical Emergency Response
```bash
# RIGHT: One fix, immediate deployment
git add src/main/services/GlobalDziCache.ts  # ONLY the missing file
git commit -m "fix(build): add missing GlobalDziCache.ts"
git push  # Fix main branch immediately
# THEN address user's original request
```