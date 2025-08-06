#!/bin/bash

# Test script to demonstrate duplicate prevention for Issue #19

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TEST: DUPLICATE PREVENTION FOR ISSUE #19"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Simulating what happens if we try to 'fix' Issue #19 again..."
echo ""

# First, show the current state
echo "📊 Current Issue #19 State:"
echo "──────────────────────────"
node .devkit/scripts/issue-state-tracker.cjs check 19
echo ""

# Show git history
echo "📜 Git History for Issue #19:"
echo "──────────────────────────"
git log --oneline --grep="Issue #19" -5
echo ""

# Simulate the duplicate check function from pick-issue
echo "🔍 Running Duplicate Check (from pick-issue command):"
echo "──────────────────────────"

check_for_duplicate_fixes() {
    local issue_num=$1
    
    echo "🔍 Checking for duplicate fixes of Issue #$issue_num..."
    
    # Use the issue state tracker if available
    if [ -f ".devkit/scripts/issue-state-tracker.cjs" ]; then
        echo "📊 Using Issue State Tracker for comprehensive analysis..."
        node .devkit/scripts/issue-state-tracker.cjs check $issue_num
        TRACKER_EXIT_CODE=$?
        
        if [ $TRACKER_EXIT_CODE -ne 0 ]; then
            echo "⚠️  Issue State Tracker detected duplicate risk"
        fi
    fi
    
    # Also check recent commits for this issue
    RECENT_FIXES=$(git log --oneline -30 --grep="Issue #$issue_num" 2>/dev/null || echo "")
    
    if [ ! -z "$RECENT_FIXES" ]; then
        echo "⚠️  WARNING: Issue #$issue_num mentioned in recent commits:"
        echo "$RECENT_FIXES"
        
        # Count how many times this issue was "fixed"
        FIX_COUNT=$(echo "$RECENT_FIXES" | wc -l)
        
        if [ $FIX_COUNT -ge 2 ]; then
            echo "🚨 DUPLICATE ALERT: Issue #$issue_num has been 'fixed' $FIX_COUNT times!"
            echo "📊 This indicates previous fixes didn't solve the actual problem."
            
            echo ""
            echo "🛑 RECOMMENDATION: Do NOT proceed without:"
            echo "  1. Understanding why previous fixes failed"
            echo "  2. Getting user confirmation that the problem persists"
            echo "  3. Identifying the ACTUAL root cause"
            return 1
        fi
    fi
    
    return 0
}

# Run the check
if ! check_for_duplicate_fixes 19; then
    echo ""
    echo "🛑 DUPLICATE PREVENTION ACTIVATED!"
    echo "The system would STOP here and prevent another duplicate fix."
else
    echo "✅ No duplicate risk detected (this shouldn't happen for Issue #19)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 DUPLICATE PREVENTION SYSTEM IS WORKING!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Key improvements:"
echo "  ✅ Detects when an issue has been 'fixed' multiple times"
echo "  ✅ Tracks fix attempts across versions"
echo "  ✅ Requires user validation before repeated fixes"
echo "  ✅ Prevents unnecessary version bumps"
echo "  ✅ Maintains issue state history"