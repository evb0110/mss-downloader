#!/bin/bash

# Script to check GitHub issue responses after fixes

echo "Checking GitHub issue responses..."
echo "================================="

# Get all open issues
open_issues=$(gh issue list --state open --json number,author,title,createdAt -q '.[] | @json')

if [ -z "$open_issues" ]; then
    echo "No open issues found."
    exit 0
fi

# Get current version from package.json
VERSION=$(node -p "require('./package.json').version")

# Function to get the last fix comment date from bot/me (containing "Исправлено в версии")
get_last_fix_comment_date() {
    local issue_num=$1
    # Get my username
    local my_username=$(gh api user -q .login)
    
    # Get all comments and find the last one from me that contains the fix announcement
    gh issue view "$issue_num" --json comments -q ".comments[] | select(.author.login == \"$my_username\" and (.body | contains(\"Исправлено в версии\"))) | .createdAt" | tail -1
}

# Function to check if we already tagged the author
check_if_already_tagged() {
    local issue_num=$1
    local author=$2
    local last_bot_comment=$3
    
    # Get my username
    local my_username=$(gh api user -q .login)
    
    # Check if there's a comment from me after the fix comment that contains the author tag
    local tag_comment=$(gh issue view "$issue_num" --json comments -q ".comments[] | select(.author.login == \"$my_username\" and .createdAt > \"$last_bot_comment\" and (.body | contains(\"@$author\"))) | .createdAt" | head -1)
    
    if [ -n "$tag_comment" ]; then
        echo "$tag_comment"
        return 0
    else
        return 1
    fi
}

# Function to check if author responded after bot comment
check_author_response() {
    local issue_num=$1
    local author=$2
    local last_bot_comment=$3
    
    if [ -z "$last_bot_comment" ]; then
        echo "  No bot comment found"
        return 1
    fi
    
    # Get comments from author after bot's last comment
    local author_response=$(gh issue view "$issue_num" --json comments -q ".comments[] | select(.author.login == \"$author\" and .createdAt > \"$last_bot_comment\") | .createdAt" | head -1)
    
    if [ -n "$author_response" ]; then
        echo "  Author responded at: $author_response"
        return 0
    else
        echo "  No response from author since: $last_bot_comment"
        return 1
    fi
}

# Function to calculate days since date
days_since() {
    local date=$1
    local now=$(date +%s)
    local then=$(date -d "$date" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$date" +%s 2>/dev/null)
    local diff=$((now - then))
    echo $((diff / 86400))
}

# Process each issue
echo "$open_issues" | while IFS= read -r issue_json; do
    issue_num=$(echo "$issue_json" | jq -r '.number')
    author=$(echo "$issue_json" | jq -r '.author.login')
    title=$(echo "$issue_json" | jq -r '.title')
    
    echo ""
    echo "Issue #$issue_num: $title"
    echo "Author: @$author"
    
    # Get last fix comment date (should be the fix announcement)
    last_bot_comment=$(get_last_fix_comment_date "$issue_num")
    
    if [ -z "$last_bot_comment" ]; then
        echo "  ⚠️  No fix comment posted yet"
        continue
    fi
    
    # Check if author responded
    if check_author_response "$issue_num" "$author" "$last_bot_comment"; then
        echo "  ✅ Author has responded - check their feedback"
    else
        # Check if we already tagged the author
        tag_date=$(check_if_already_tagged "$issue_num" "$author" "$last_bot_comment")
        
        if [ -n "$tag_date" ]; then
            # We already tagged, check how long ago
            days_since_tag=$(days_since "$tag_date")
            echo "  ⏱️  Already tagged author $days_since_tag days ago"
            
            if [ "$days_since_tag" -ge 3 ]; then
                echo "  🔒 Can close issue (no response for $days_since_tag days after tagging)"
                echo ""
                echo "  ACTION: Close issue with:"
                echo "  -------"
                echo "  Закрываю issue, так как исправление было выпущено в версии $VERSION и не было получено обратной связи в течение $days_since_tag дней."
                echo "  "
                echo "  Если проблема всё ещё существует, пожалуйста, откройте новый issue с подробным описанием."
                echo "  -------"
            else
                echo "  ⏳ Waiting for response (${days_since_tag}/3 days)"
            fi
        else
            # No tag yet, should we tag now?
            echo "  📢 No follow-up tag found"
            echo ""
            echo "  ACTION: Tag author with:"
            echo "  -------"
            echo "  @$author, пожалуйста, проверьте исправление в версии $VERSION и сообщите, работает ли оно."
            echo "  -------"
        fi
    fi
done

echo ""
echo "================================="
echo "Review complete!"
echo ""
echo "To take actions, use gh issue comment <number> --body \"<message>\""