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

# Function to get the last comment date from bot/me
get_last_bot_comment_date() {
    local issue_num=$1
    # Get my username
    local my_username=$(gh api user -q .login)
    
    # Get all comments and find the last one from me
    gh issue view "$issue_num" --json comments -q ".comments[] | select(.author.login == \"$my_username\") | .createdAt" | tail -1
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
    
    # Get last bot comment date
    last_bot_comment=$(get_last_bot_comment_date "$issue_num")
    
    if [ -z "$last_bot_comment" ]; then
        echo "  ⚠️  No fix comment posted yet"
        continue
    fi
    
    # Check if author responded
    if check_author_response "$issue_num" "$author" "$last_bot_comment"; then
        echo "  ✅ Author has responded - check their feedback"
    else
        # Calculate days since bot comment
        days_passed=$(days_since "$last_bot_comment")
        echo "  ⏱️  Days since fix comment: $days_passed"
        
        # Check if we need to follow up
        if [ "$days_passed" -ge 2 ] && [ "$days_passed" -lt 5 ]; then
            echo "  📢 Need to tag author for response"
            echo ""
            echo "  Suggested comment:"
            echo "  @$author, пожалуйста, проверьте исправление в версии 1.4.42 и сообщите, работает ли оно."
        elif [ "$days_passed" -ge 5 ]; then
            echo "  🔒 Can close issue (no response for $days_passed days)"
            echo ""
            echo "  Suggested closing comment:"
            echo "  Закрываю issue, так как исправление было выпущено в версии 1.4.42 и не было получено обратной связи в течение $days_passed дней."
            echo "  "
            echo "  Если проблема всё ещё существует, пожалуйста, откройте новый issue с подробным описанием."
        fi
    fi
done

echo ""
echo "================================="
echo "Review complete!"