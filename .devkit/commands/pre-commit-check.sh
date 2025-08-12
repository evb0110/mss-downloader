#!/bin/bash

# Pre-commit type checking for Claude
# This script should be run before any commit to catch type errors

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🔍 Running pre-commit type checks..."
echo "=================================="

cd "$PROJECT_ROOT"

# Function to print colored output
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "\033[32m✅ $2\033[0m"
    else
        echo -e "\033[31m❌ $2\033[0m"
    fi
}

# Track overall status
ALL_CHECKS_PASSED=true

# 1. Type Check
echo -e "\n📋 Type Checking..."
# Run type check and capture errors
TSC_OUTPUT=$(npx tsc --noEmit 2>&1)
TSC_EXIT_CODE=$?

if [ $TSC_EXIT_CODE -eq 0 ]; then
    print_status 0 "Type check passed"
else
    print_status 1 "Type check failed"
    # Show first 10 errors
    echo "$TSC_OUTPUT" | head -20
    echo "   ..."
    echo "   Total errors: $(echo "$TSC_OUTPUT" | grep -c 'error TS')"
    echo "   Run 'npm run typecheck' for full details"
    ALL_CHECKS_PASSED=false
fi

# 2. Check for 'any' types in changed files
echo -e "\n🚫 Checking for 'any' types in staged files..."
STAGED_TS_FILES=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(ts|tsx)$' || true)

if [ -n "$STAGED_TS_FILES" ]; then
    ANY_COUNT=0
    for file in $STAGED_TS_FILES; do
        if [ -f "$file" ]; then
            # Check for explicit 'any' usage (excluding comments)
            COUNT=$(grep -E '\bany\b' "$file" 2>/dev/null | grep -v '//' | grep -v '/\*' | wc -l || echo 0)
            if [ "$COUNT" -gt 0 ]; then
                ANY_COUNT=$((ANY_COUNT + COUNT))
                echo "   ⚠️  $file: $COUNT 'any' types found"
            fi
        fi
    done
    
    if [ $ANY_COUNT -eq 0 ]; then
        print_status 0 "No 'any' types in staged files"
    else
        print_status 1 "$ANY_COUNT 'any' types found in staged files"
        echo "   Consider using specific types instead of 'any'"
    fi
fi

# 3. Check for unresolved type imports
echo -e "\n📦 Checking for missing type imports..."
IMPORT_ERRORS=$(npx tsc --noEmit 2>&1 | grep "Cannot find module" | wc -l || echo 0)

if [ "$IMPORT_ERRORS" -eq 0 ]; then
    print_status 0 "All imports resolved"
else
    print_status 1 "$IMPORT_ERRORS missing imports found"
    ALL_CHECKS_PASSED=false
fi

# 4. Method reference check (prevent loadVatlibManifest-type errors)
echo -e "\n🔗 Checking method references..."
METHOD_ERRORS=$(npx tsc --noEmit 2>&1 | grep -E "Property .* does not exist|is not a function" | wc -l || echo 0)

if [ "$METHOD_ERRORS" -eq 0 ]; then
    print_status 0 "All method references valid"
else
    print_status 1 "$METHOD_ERRORS invalid method references found"
    echo "   This includes errors like 'loadVatlibManifest is not a function'"
    ALL_CHECKS_PASSED=false
fi

# 5. Strict null checks
echo -e "\n⚡ Checking for null/undefined issues..."
NULL_ERRORS=$(npx tsc --noEmit 2>&1 | grep -E "possibly 'null'|possibly 'undefined'" | wc -l || echo 0)

if [ "$NULL_ERRORS" -eq 0 ]; then
    print_status 0 "No null/undefined issues"
else
    echo "   ⚠️  $NULL_ERRORS potential null/undefined issues found"
    echo "   Consider using optional chaining (?.) or null checks"
fi

# 6. Generate quick report
echo -e "\n📊 Generating type check summary..."
node "$SCRIPT_DIR/../workflows/typecheck-report.cjs" > /dev/null 2>&1 || true

# Final status
echo -e "\n=================================="
if [ "$ALL_CHECKS_PASSED" = true ]; then
    echo -e "\033[32m✅ All critical type checks passed!\033[0m"
    echo -e "\nYou can proceed with commit."
    exit 0
else
    echo -e "\033[31m❌ Type checks failed!\033[0m"
    echo -e "\nActions to fix:"
    echo "1. View detailed report: cat .devkit/reports/typecheck-summary.md"
    echo "2. Fix automatically: npm run typefix"
    echo "3. Fix manually: npm run typecheck:watch"
    echo ""
    echo "⚠️  DO NOT COMMIT with type errors!"
    echo "   Type errors like 'loadVatlibManifest is not a function' will break production."
    exit 1
fi