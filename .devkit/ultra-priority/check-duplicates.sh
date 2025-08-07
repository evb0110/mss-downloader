#!/bin/bash

echo "🔍 Analyzing issues for duplicate fixes..."

# Check each issue for previous fixes
for issue_num in 20 11 10 6 5 4; do
    count=$(git log --oneline --grep="Issue #$issue_num" 2>/dev/null | wc -l || echo "0")
    title=$(cat .devkit/all-open-issues.json | jq -r ".[] | select(.number == $issue_num) | .title" 2>/dev/null || echo "Unknown")
    echo "Issue #$issue_num: $count previous fixes - $title"
done

echo ""
echo "🚀 AUTO-SELECTING best issue to work on..."

# Find the best issue (one without duplicate fixes and with author interaction)
BEST_ISSUE=""
for issue_num in 20 11 10 6 5 4; do
    duplicate_count=$(git log --oneline --grep="Issue #$issue_num" 2>/dev/null | wc -l || echo "0")
    
    if [ "$duplicate_count" -ge 2 ]; then
        echo "  Skipping Issue #$issue_num (already 'fixed' $duplicate_count times)"
        continue
    fi
    
    # Check if issue has comments from author
    gh api "repos/evb0110/mss-downloader/issues/$issue_num/comments" --jq '.[].user.login' > .devkit/comment-authors-$issue_num.txt 2>/dev/null || true
    
    # Get issue author
    ISSUE_AUTHOR=$(cat .devkit/all-open-issues.json | jq -r ".[] | select(.number == $issue_num) | .author.login" 2>/dev/null || echo "")
    
    if [ -s ".devkit/comment-authors-$issue_num.txt" ]; then
        LAST_COMMENTER=$(tail -1 .devkit/comment-authors-$issue_num.txt)
        if [ "$LAST_COMMENTER" = "$ISSUE_AUTHOR" ] && [ "$LAST_COMMENTER" != "github-actions[bot]" ]; then
            BEST_ISSUE=$issue_num
            echo "  ✅ Selected Issue #$issue_num (author's last comment pending)"
            break
        fi
    else
        # No comments yet, issue is fresh from author
        if [ -z "$BEST_ISSUE" ]; then
            BEST_ISSUE=$issue_num
            echo "  ✅ Selected Issue #$issue_num (fresh issue from author)"
        fi
    fi
done

# Clean up temporary files
rm -f .devkit/comment-authors-*.txt

if [ -z "$BEST_ISSUE" ]; then
    # Fallback: pick most recent issue
    TARGET_ISSUE=$(cat .devkit/all-open-issues.json | jq -r 'sort_by(.createdAt) | reverse | .[0].number')
    echo "⚡ AUTO-SELECTED: Most recent issue #$TARGET_ISSUE (fallback)"
else
    TARGET_ISSUE=$BEST_ISSUE
fi

# Extract and display issue details
ISSUE_TITLE=$(cat .devkit/all-open-issues.json | jq -r ".[] | select(.number == $TARGET_ISSUE) | .title")
ISSUE_AUTHOR=$(cat .devkit/all-open-issues.json | jq -r ".[] | select(.number == $TARGET_ISSUE) | .author.login")

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔥 TARGET ISSUE SELECTED: #$TARGET_ISSUE"
echo "Title: $ISSUE_TITLE"
echo "Author: @$ISSUE_AUTHOR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Save target issue data
cat .devkit/all-open-issues.json | jq ".[] | select(.number == $TARGET_ISSUE)" > .devkit/target-issue.json

echo "$TARGET_ISSUE" > .devkit/ultra-priority/target-issue-number.txt
echo "🎯 Issue data saved. Beginning AUTONOMOUS ULTRA-PRIORITY WORK..."