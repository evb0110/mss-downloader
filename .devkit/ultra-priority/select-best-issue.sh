#!/bin/bash

echo "🚀 AUTO-START: Analyzing all open issues to select best candidate..."

BEST_ISSUE=""
for issue_num in $(cat .devkit/issue-candidates.json | jq -r '.[].number'); do
    # Get issue comments
    gh api "repos/evb4876/mss-downloader/issues/$issue_num/comments" --jq '.[].user.login' > .devkit/comment-authors-$issue_num.txt 2>/dev/null || continue
    
    # Get issue author
    ISSUE_AUTHOR=$(cat .devkit/issue-candidates.json | jq -r ".[] | select(.number == $issue_num) | .author.login")
    
    # Check if last comment is from author
    if [ -s .devkit/comment-authors-$issue_num.txt ]; then
        LAST_COMMENTER=$(tail -1 .devkit/comment-authors-$issue_num.txt)
        if [ "$LAST_COMMENTER" = "$ISSUE_AUTHOR" ] && [ "$LAST_COMMENTER" != "github-actions[bot]" ]; then
            BEST_ISSUE=$issue_num
            echo "Found issue #$issue_num with author's last comment"
            break
        fi
    else
        # No comments yet, issue is fresh
        BEST_ISSUE=$issue_num
        echo "Found fresh issue #$issue_num with no comments"
        break
    fi
done

# Clean up temporary files
rm -f .devkit/comment-authors-*.txt

if [ -z "$BEST_ISSUE" ]; then
    # Fallback: pick most recent
    TARGET_ISSUE=$(cat .devkit/issue-candidates.json | jq -r 'sort_by(.createdAt) | reverse | .[0].number')
    echo "⚡ AUTO-SELECTED: Most recent issue #$TARGET_ISSUE"
else
    TARGET_ISSUE=$BEST_ISSUE
    ISSUE_TITLE=$(cat .devkit/issue-candidates.json | jq -r ".[] | select(.number == $TARGET_ISSUE) | .title")
    echo "⚡ AUTO-SELECTED: Issue #$TARGET_ISSUE: $ISSUE_TITLE"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔥 ULTRA-PRIORITY AUTONOMOUS MODE ACTIVATED 🔥"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Target: Issue #$TARGET_ISSUE"

# Save to file for next steps
echo "$TARGET_ISSUE" > .devkit/ultra-priority/selected-issue.txt