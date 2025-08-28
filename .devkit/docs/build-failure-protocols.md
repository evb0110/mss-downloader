# Build Failure Emergency Protocols

## Cascading Build Failure Response

**🚨 CATASTROPHIC LESSON LEARNED: Fix root cause, not symptoms 🚨**

### Phase 1: IMMEDIATE DAMAGE ASSESSMENT
```bash
# 1. Identify failure scope
gh run list --limit 5  # Recent build status
git status --porcelain  # What files are staged/modified

# 2. Check for missing files (most common cause)
grep -n "Could not resolve" <build-log>
grep -n "Module not found" <build-log>
```

### Phase 2: ROOT CAUSE IDENTIFICATION
- **Missing Files**: Most common cause of build failures
- **Untracked Dependencies**: New files not committed
- **Type Errors**: Precommit bypassed (should be impossible)
- **Import Paths**: Refactoring without updating references

### Phase 3: RAPID FIX PROTOCOL
```bash
# For missing files (most common)
git add <missing-file>
git commit -m "fix(build): add missing <filename>"
git push  # IMMEDIATE push to fix main branch

# Version bump AFTER fixing root cause
npm version patch
git push --tags
```

### Phase 4: CASCADE PREVENTION
- **ONE FIX AT A TIME**: Don't batch multiple changes
- **IMMEDIATE PUSH**: Fix main branch before adding more commits  
- **ROOT CAUSE FOCUS**: Find why files were missed initially
- **PROCESS UPDATE**: Prevent same failure pattern

## Anti-Cascade Patterns

### ✅ CORRECT (Root Cause First):
1. Identify missing GlobalDziCache.ts
2. `git add src/main/services/GlobalDziCache.ts`
3. `git commit -m "fix(build): add missing GlobalDziCache.ts"`
4. `git push` ← Fix main branch first
5. THEN version bump if needed

### ❌ WRONG (Symptom Fighting):
1. Try to trigger rebuild without fixing missing files
2. Create multiple failing commits
3. Version bump while root cause still exists
4. Stack failures on top of failures

## Emergency Response for Missing Files

1. **IMMEDIATE DETECTION**: Build fails with "Could not resolve" = missing file
2. **RAPID FIX**: `git add missing-file && git commit -m "fix(build): add missing [filename]"`
3. **PUSH IMMEDIATELY**: Don't leave broken build in main branch
4. **PREVENT RECURRENCE**: Update process to catch similar files