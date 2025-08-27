#!/bin/bash
# Version Bump Safety Check Script
# Prevents catastrophic build failures due to missing files

set -e  # Exit on any error

echo "🔍 VERSION BUMP SAFETY CHECK"
echo "============================"

# 1. Show current git status
echo "📋 Current repository status:"
git status --porcelain

# 2. Check for untracked files that might be dependencies
UNTRACKED_FILES=$(git ls-files --others --exclude-standard)
if [ -n "$UNTRACKED_FILES" ]; then
    echo ""
    echo "⚠️  UNTRACKED FILES DETECTED (potential missing dependencies):"
    echo "$UNTRACKED_FILES"
    echo ""
    echo "❓ These files will NOT be committed unless you run 'git add -A'"
    echo "❓ For 'bump all' command, ALL files should be included to prevent build failures"
    echo ""
fi

# 3. Show what files are currently staged
STAGED_FILES=$(git diff --cached --name-status)
if [ -n "$STAGED_FILES" ]; then
    echo "✅ Currently staged files:"
    echo "$STAGED_FILES"
    echo ""
else
    echo "⚠️  NO FILES CURRENTLY STAGED"
    echo "   For version bump, you need to stage files first:"
    echo "   - 'bump': git add -u (tracked modifications only)"
    echo "   - 'bump all': git add -A (ALL files including untracked)"
    echo ""
fi

# 4. Check for common dependency file patterns
POTENTIAL_DEPS=$(git ls-files --others --exclude-standard | grep -E '\.(ts|js|json|vue)$' || true)
if [ -n "$POTENTIAL_DEPS" ]; then
    echo "🚨 POTENTIAL DEPENDENCY FILES (commonly cause build failures):"
    echo "$POTENTIAL_DEPS"
    echo ""
    echo "⚠️  These TypeScript/JS files are untracked and may cause:"
    echo "   - 'Could not resolve' build errors"
    echo "   - Import resolution failures"
    echo "   - Catastrophic deployment failures"
    echo ""
fi

# 5. Pre-build verification if files are staged
if git diff --cached --quiet; then
    echo "⚠️  No files staged - skipping build verification"
else
    echo "🏗️  BUILD VERIFICATION with currently staged files..."
    if npm run build > /dev/null 2>&1; then
        echo "✅ Build passes with currently staged files"
    else
        echo "❌ BUILD FAILED with currently staged files"
        echo ""
        echo "🚨 CRITICAL: Do NOT commit - this will cause deployment failure"
        echo "   Either fix build errors or stage missing dependency files"
        echo ""
        echo "Common fixes:"
        echo "  1. Add missing files: git add missing-file.ts"
        echo "  2. Stage all files: git add -A"
        echo "  3. Fix import/export errors in staged files"
        exit 1
    fi
fi

# 6. Summary and recommendations
echo ""
echo "📊 SAFETY CHECK SUMMARY:"
echo "========================"

TOTAL_UNTRACKED=$(echo "$UNTRACKED_FILES" | wc -l)
TOTAL_STAGED=$(git diff --cached --name-only | wc -l)

echo "📁 Staged files: $TOTAL_STAGED"
echo "📁 Untracked files: $TOTAL_UNTRACKED"

if [ -n "$UNTRACKED_FILES" ]; then
    echo ""
    echo "🔧 RECOMMENDATIONS:"
    echo "  - For 'bump all': Run 'git add -A' to include ALL files"
    echo "  - For 'bump': Run 'git add -u' for tracked modifications only"
    echo "  - Always verify build passes: npm run build"
    echo "  - Monitor GitHub Actions after push: gh run list --limit 1"
fi

echo ""
echo "✅ Safety check complete - ready for version bump decision"