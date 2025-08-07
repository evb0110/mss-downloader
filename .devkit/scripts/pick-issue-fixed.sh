#!/bin/bash

# Fixed pick-issue command - respects user feedback
# Only re-attempts issues where the author explicitly reports problems

echo "🔍 Fixed Pick-Issue Command - Analyzing open issues..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create workspace
mkdir -p .devkit/ultra-priority

# Fetch all open issues
gh issue list --state open --json number,title,body,author,comments,createdAt --limit 100 > .devkit/all-open-issues.json

# Function to check if user reported the fix isn't working
check_user_feedback() {
    local issue_num=$1
    local issue_author=$2
    
    # Check if this issue was previously "fixed"
    local fix_count=$(git log --oneline --grep="Issue #$issue_num" 2>/dev/null | wc -l)
    
    if [ $fix_count -eq 0 ]; then
        echo "never_fixed"
        return
    fi
    
    # Get the timestamp of the last fix
    local last_fix_date=$(git log --format="%ai" --grep="Issue #$issue_num" -1 2>/dev/null | cut -d' ' -f1)
    
    if [ -z "$last_fix_date" ]; then
        echo "never_fixed"
        return
    fi
    
    # Get issue comments after the last fix
    local comments=$(gh api "repos/{owner}/{repo}/issues/$issue_num/comments" --jq '.[] | {user: .user.login, body: .body, created: .created_at}' 2>/dev/null || echo "")
    
    if [ -z "$comments" ]; then
        echo "no_feedback"
        return
    fi
    
    # Check if the issue author reported problems after the fix
    local author_feedback=$(echo "$comments" | grep "\"user\": \"$issue_author\"" -A 2 | tail -3)
    
    if [ -z "$author_feedback" ]; then
        echo "no_author_feedback"
        return
    fi
    
    # Check if the feedback indicates problems
    if echo "$author_feedback" | grep -qE "(не работает|not working|still|всё ещё|broken|библиотеки нет|doesn't work|fails|error|проблема)"; then
        echo "reported_broken"
    elif echo "$author_feedback" | grep -qE "(работает|works|fixed|спасибо|thanks|great|отлично)"; then
        echo "reported_working"
    else
        echo "unclear_feedback"
    fi
}

# Analyze each issue
echo "📊 Analyzing issues with proper feedback detection..."
echo ""

BEST_ISSUE=""
BEST_PRIORITY=-1
ISSUES_ANALYSIS=""

while IFS= read -r issue_num; do
    ISSUE_TITLE=$(cat .devkit/all-open-issues.json | jq -r ".[] | select(.number == $issue_num) | .title")
    ISSUE_AUTHOR=$(cat .devkit/all-open-issues.json | jq -r ".[] | select(.number == $issue_num) | .author.login")
    
    # Check fix history and user feedback
    FEEDBACK_STATUS=$(check_user_feedback "$issue_num" "$ISSUE_AUTHOR")
    FIX_COUNT=$(git log --oneline --grep="Issue #$issue_num" 2>/dev/null | wc -l)
    
    echo "Issue #$issue_num: $ISSUE_TITLE"
    echo "  Author: @$ISSUE_AUTHOR"
    echo "  Previous fixes: $FIX_COUNT"
    echo "  Feedback status: $FEEDBACK_STATUS"
    
    # Determine if we should work on this issue
    SHOULD_WORK=false
    PRIORITY=0
    
    case "$FEEDBACK_STATUS" in
        "never_fixed")
            SHOULD_WORK=true
            PRIORITY=100
            echo "  ✅ Never attempted - HIGH PRIORITY"
            ;;
        "reported_broken")
            SHOULD_WORK=true
            PRIORITY=150  # Highest priority - user confirmed it's broken
            echo "  🔥 User reported still broken - ULTRA HIGH PRIORITY"
            ;;
        "reported_working")
            SHOULD_WORK=false
            echo "  ❌ User confirmed working - SKIPPING"
            ;;
        "no_feedback"|"no_author_feedback")
            if [ $FIX_COUNT -gt 0 ]; then
                SHOULD_WORK=false
                echo "  ⏸️  Fixed but no user feedback - SKIPPING (assume working)"
            else
                SHOULD_WORK=true
                PRIORITY=100
                echo "  ✅ No previous attempts"
            fi
            ;;
        "unclear_feedback")
            SHOULD_WORK=false
            echo "  ❓ Unclear feedback - SKIPPING (need clarification)"
            ;;
    esac
    
    # Check for recent author activity (bonus priority)
    if [ "$SHOULD_WORK" = true ]; then
        gh api "repos/{owner}/{repo}/issues/$issue_num/comments" --jq '.[].user.login' > .devkit/comment-authors-$issue_num.txt 2>/dev/null || true
        
        if [ -s .devkit/comment-authors-$issue_num.txt ]; then
            LAST_COMMENTER=$(tail -1 .devkit/comment-authors-$issue_num.txt)
            if [ "$LAST_COMMENTER" = "$ISSUE_AUTHOR" ]; then
                PRIORITY=$((PRIORITY + 20))
                echo "  ⭐ Author has last comment - Priority boost"
            fi
        fi
        
        echo "  📊 Final priority: $PRIORITY"
        
        if [ $PRIORITY -gt $BEST_PRIORITY ]; then
            BEST_ISSUE=$issue_num
            BEST_PRIORITY=$PRIORITY
        fi
    fi
    
    echo ""
done < <(cat .devkit/all-open-issues.json | jq -r '.[].number')

# Clean up
rm -f .devkit/comment-authors-*.txt

# Select the best issue
if [ -z "$BEST_ISSUE" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ No issues need attention!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "All open issues either:"
    echo "• Have been fixed (no user complaints)"
    echo "• Are awaiting user feedback"
    echo "• Have been confirmed as working"
    exit 0
else
    TARGET_ISSUE=$BEST_ISSUE
    ISSUE_TITLE=$(cat .devkit/all-open-issues.json | jq -r ".[] | select(.number == $TARGET_ISSUE) | .title")
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🎯 SELECTED ISSUE: #$TARGET_ISSUE"
    echo "Title: $ISSUE_TITLE"
    echo "Priority Score: $BEST_PRIORITY"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Save selection
    echo $TARGET_ISSUE > .devkit/ultra-priority/selected-issue.txt
    
    # Extract issue details
    cat .devkit/all-open-issues.json | jq ".[] | select(.number == $TARGET_ISSUE)" > .devkit/ultra-priority/target-issue.json
    
    echo ""
    echo "Issue details saved to .devkit/ultra-priority/target-issue.json"
    echo "Ready to begin work on Issue #$TARGET_ISSUE"
fi