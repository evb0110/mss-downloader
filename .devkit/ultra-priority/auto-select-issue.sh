#\!/bin/bash

echo "🚀 AUTO-START: Analyzing all open issues to select best candidate..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Function to check duplicate fixes
check_duplicate_fixes() {
    local issue_num=$1
    local duplicate_count=$(git log --oneline --grep="Issue #$issue_num" 2>/dev/null | wc -l)
    echo $duplicate_count
}

# Analyze each issue
echo "📊 Analyzing open issues for duplicate fix patterns..."
BEST_ISSUE=""
BEST_PRIORITY=-1

while IFS= read -r issue_num; do
    # Get issue details
    ISSUE_TITLE=$(cat .devkit/all-open-issues.json | jq -r ".[] | select(.number == $issue_num) | .title")
    ISSUE_AUTHOR=$(cat .devkit/all-open-issues.json | jq -r ".[] | select(.number == $issue_num) | .author.login")
    
    # Check for duplicate fixes
    DUPLICATE_COUNT=$(check_duplicate_fixes $issue_num)
    
    echo ""
    echo "Issue #$issue_num: $ISSUE_TITLE"
    echo "  Author: $ISSUE_AUTHOR"
    echo "  Previous fix attempts: $DUPLICATE_COUNT"
    
    # Scoring system for auto-selection
    PRIORITY=100
    
    # Penalize heavily for multiple fix attempts
    if [ $DUPLICATE_COUNT -ge 2 ]; then
        echo "  ⚠️ Already 'fixed' $DUPLICATE_COUNT times - SKIPPING"
        continue
    elif [ $DUPLICATE_COUNT -eq 1 ]; then
        PRIORITY=$((PRIORITY - 30))
        echo "  ⚠️ One previous fix attempt - Lower priority"
    fi
    
    # Check for author activity (issue with author's last comment gets priority)
    gh api "repos/{owner}/{repo}/issues/$issue_num/comments" --jq '.[].user.login' > .devkit/comment-authors-$issue_num.txt 2>/dev/null || true
    
    if [ -s .devkit/comment-authors-$issue_num.txt ]; then
        LAST_COMMENTER=$(tail -1 .devkit/comment-authors-$issue_num.txt)
        if [ "$LAST_COMMENTER" = "$ISSUE_AUTHOR" ] && [ "$LAST_COMMENTER" \!= "github-actions[bot]" ]; then
            PRIORITY=$((PRIORITY + 50))
            echo "  ⭐ Author has last comment - HIGH PRIORITY"
        fi
    else
        # No comments, fresh issue
        PRIORITY=$((PRIORITY + 30))
        echo "  ✨ Fresh issue with no comments"
    fi
    
    # Special handling for specific known issues
    if [[ "$ISSUE_TITLE" =~ "BNE" ]] || [ "$issue_num" = "11" ]; then
        PRIORITY=$((PRIORITY + 20))
        echo "  🎯 Known library issue (BNE) - Increased priority"
    fi
    
    echo "  📊 Final priority score: $PRIORITY"
    
    if [ $PRIORITY -gt $BEST_PRIORITY ]; then
        BEST_ISSUE=$issue_num
        BEST_PRIORITY=$PRIORITY
    fi
done < <(cat .devkit/all-open-issues.json | jq -r '.[].number')

# Clean up
rm -f .devkit/comment-authors-*.txt

if [ -z "$BEST_ISSUE" ]; then
    # Fallback: pick most recent
    TARGET_ISSUE=$(cat .devkit/all-open-issues.json | jq -r 'sort_by(.createdAt) | reverse | .[0].number')
    echo ""
    echo "⚡ Fallback: Selected most recent issue #$TARGET_ISSUE"
else
    TARGET_ISSUE=$BEST_ISSUE
    ISSUE_TITLE=$(cat .devkit/all-open-issues.json | jq -r ".[] | select(.number == $TARGET_ISSUE) | .title")
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔥 ULTRA-PRIORITY ISSUE SELECTED: #$TARGET_ISSUE"
    echo "Title: $ISSUE_TITLE"
    echo "Priority Score: $BEST_PRIORITY"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

echo $TARGET_ISSUE > .devkit/ultra-priority/selected-issue.txt
echo ""
echo "🔥 ULTRA-PRIORITY AUTONOMOUS MODE ACTIVATED 🔥"
echo "Starting immediate work on Issue #$TARGET_ISSUE"
