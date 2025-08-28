# Precommit Zero Tolerance - Bulletproof Enforcement

**🚨 CATASTROPHIC LESSON LEARNED: NEVER bypass precommit failures 🚨**
**Disaster Reference: User had to say "this is critical!!!!" to stop me from bypassing**

## Precommit Failure = Full System Shutdown

```
🚨🚨🚨 IF npm run precommit FAILS: 🚨🚨🚨
   ❌ STOP ALL VERSION BUMP ACTIVITY IMMEDIATELY
   ❌ STOP ALL GIT COMMITS IMMEDIATELY  
   ❌ STOP ALL BUILD ATTEMPTS IMMEDIATELY
   ❌ NO "build passes anyway" logic EVER ALLOWED
   ❌ NO "types don't matter" reasoning EVER ALLOWED
   ❌ NO "we can fix later" postponement EVER ALLOWED
   ✅ FIX TYPE ERRORS FIRST - NOTHING ELSE MATTERS
   ✅ Use npm run typefix + npm run typecheck
   ✅ Only proceed after precommit shows 0 errors
```

## Forbidden Disaster Thinking (That Led to Failures)

**These thoughts are now BANNED:**
- "Build passes so type errors don't matter" ← CATASTROPHICALLY WRONG - caused production crashes
- "Type errors are just warnings" ← CAUSES RUNTIME FAILURES in Electron  
- "We can fix types later" ← NEVER ACCEPTABLE - fix NOW
- "User is waiting, skip type safety" ← USER PREFERS WORKING CODE over fast broken code
- "It works in dev so types don't matter" ← PRODUCTION != DEV environment

## Mandatory Quality Gate Sequence

```bash
# BULLETPROOF SEQUENCE - NO SHORTCUTS ALLOWED
1. npm run precommit    # MUST show 0 errors - FULL STOP if fails
2. npm run lint         # MUST pass with zero errors  
3. npm run build        # MUST complete successfully
4. git commit          # ONLY if ALL gates pass
5. git push            # Deploy only verified code
```

## Precommit Failure Emergency Protocol

```bash
# When precommit fails (MANDATORY RESPONSE):
1. STOP IMMEDIATELY - no other actions allowed
2. npm run typefix     # Auto-fix attempt
3. npm run typecheck   # Verify fix worked  
4. IF STILL FAILING: Manual type fixes required
5. REPEAT until precommit passes 100%
6. ONLY THEN resume version bump process
```

## Critical Failure Patterns Now Impossible

- ❌ Seeing precommit errors and continuing anyway ← BLOCKED by immediate stop protocol
- ❌ "Build passes so type errors don't matter" ← BANNED thinking pattern
- ❌ Ignoring type safety for speed ← Quality over speed always
- ✅ ALWAYS fix type errors before any commit ← ONLY acceptable pattern

## After Push (unchanged)

1. Verify GitHub Actions build success
2. Check telegram notifications sent
3. If build fails: fix, commit, push fixes