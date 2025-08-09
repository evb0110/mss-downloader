#!/bin/bash

echo "🚀 AUTO-START: Analyzing all open issues to select best candidate..."
echo ""

BEST_ISSUE=""
BEST_ISSUE_TITLE=""

for issue_num in 11 10 9 6 5 4 2; do
    DUPLICATE_COUNT=$(git log --oneline --grep="Issue #$issue_num" 2>/dev/null | wc -l)
    ISSUE_TITLE=$(cat .devkit/all-open-issues.json | jq -r ".[] | select(.number == $issue_num) | .title")
    
    if [ $DUPLICATE_COUNT -ge 2 ]; then
        echo "  ❌ Skipping Issue #$issue_num ($ISSUE_TITLE) - already 'fixed' $DUPLICATE_COUNT times"
    else
        echo "  ✅ Issue #$issue_num ($ISSUE_TITLE) - $DUPLICATE_COUNT previous fix attempts"
        if [ -z "$BEST_ISSUE" ]; then
            BEST_ISSUE=$issue_num
            BEST_ISSUE_TITLE=$ISSUE_TITLE
        fi
    fi
done

echo ""
if [ -n "$BEST_ISSUE" ]; then
    echo "⚡ AUTO-SELECTED: Issue #$BEST_ISSUE: $BEST_ISSUE_TITLE"
    echo "$BEST_ISSUE" > .devkit/ultra-priority/selected-issue.txt
else
    # Fallback to most recent
    BEST_ISSUE=$(cat .devkit/all-open-issues.json | jq -r 'sort_by(.createdAt) | reverse | .[0].number')
    BEST_ISSUE_TITLE=$(cat .devkit/all-open-issues.json | jq -r 'sort_by(.createdAt) | reverse | .[0].title')
    echo "⚡ AUTO-SELECTED (fallback): Issue #$BEST_ISSUE: $BEST_ISSUE_TITLE"
    echo "$BEST_ISSUE" > .devkit/ultra-priority/selected-issue.txt
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔥 ULTRA-PRIORITY AUTONOMOUS MODE ACTIVATED 🔥"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Target Issue: #$BEST_ISSUE - $BEST_ISSUE_TITLE"