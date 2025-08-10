# 🚀 Quick Type Safety Guide for Claude

## CRITICAL: Run This Before EVERY Commit
```bash
npm run precommit
```

## If Errors Found, Fix Them:
```bash
# Try automatic fix first
npm run typefix

# Check what's left
npm run typecheck

# Manual fix with watch mode
npm run typecheck:watch
```

## The loadVatlibManifest Issue (PREVENTED)

**What happened:** Method didn't exist, TypeScript didn't catch it, users got runtime errors

**Now prevented by:**
- ✅ Type checking before builds
- ✅ Pre-commit checks
- ✅ Method reference validation

## Emergency Commands

```bash
# Generate detailed report
npm run typecheck:report

# Build without type checking (EMERGENCY ONLY)
npm run build:unsafe

# Normal build (with type checking)
npm run build
```

## Remember
- **NEVER commit with type errors**
- **ALWAYS run `npm run precommit`**
- **Type errors = Runtime failures**