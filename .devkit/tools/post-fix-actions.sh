#!/bin/bash

# Post-fix actions after releasing a new version with fixes

echo "Running post-fix actions..."
echo "=========================="
echo ""

# Get the current version from package.json
VERSION=$(node -p "require('./package.json').version")
echo "Current version: $VERSION"
echo ""

# Function to add fix comment to issue
add_fix_comment() {
    local issue_num=$1
    local library_name=$2
    local fix_description=$3
    
    echo "Adding comment to issue #$issue_num..."
    
    gh issue comment "$issue_num" --body "Исправлено в версии $VERSION! 🎉

$fix_description

Пожалуйста, обновитесь до версии $VERSION и проверьте, что всё работает корректно.

Новая версия будет доступна через несколько минут после автоматической сборки."
}

# Check if we have fix descriptions
if [ -d ".devkit/fixes" ]; then
    echo "Found fix descriptions in .devkit/fixes/"
    echo ""
    
    # Process each fix file
    for fix_file in .devkit/fixes/issue_*_fix.txt; do
        if [ -f "$fix_file" ]; then
            # Extract issue number from filename
            issue_num=$(basename "$fix_file" | sed 's/issue_\([0-9]*\)_fix.txt/\1/')
            
            # Read fix description
            fix_description=$(cat "$fix_file")
            
            # Get issue title to extract library name
            issue_title=$(gh issue view "$issue_num" --json title -q .title)
            
            echo "Processing Issue #$issue_num: $issue_title"
            add_fix_comment "$issue_num" "$issue_title" "$fix_description"
            echo ""
        fi
    done
else
    echo "No fix descriptions found in .devkit/fixes/"
    echo "Make sure to save fix descriptions as issue_N_fix.txt"
fi

echo ""
echo "Setting up follow-up reminders..."
echo "================================="

# Create a reminder file
REMINDER_FILE=".devkit/issue-follow-ups.md"
cat > "$REMINDER_FILE" << EOF
# Issue Follow-up Reminders

Generated: $(date)
Version: $VERSION

## Check Response Schedule:

### 2 days after fix ($(date -d "+2 days" +%Y-%m-%d 2>/dev/null || date -v +2d +%Y-%m-%d)):
Run: \`.devkit/tools/check-issue-responses.sh\`
- Tag authors who haven't responded

### 5 days after fix ($(date -d "+5 days" +%Y-%m-%d 2>/dev/null || date -v +5d +%Y-%m-%d)):
Run: \`.devkit/tools/check-issue-responses.sh\`
- Close issues with no response

## Open Issues:
EOF

# Add current open issues to reminder
gh issue list --state open --json number,title,author >> "$REMINDER_FILE"

echo "Created follow-up reminder file: $REMINDER_FILE"
echo ""
echo "Post-fix actions complete!"
echo ""
echo "Next steps:"
echo "1. Wait for GitHub Actions to build and release"
echo "2. Monitor Telegram for user feedback"
echo "3. Check issue responses in 2 days"
echo "4. Use .devkit/tools/check-issue-responses.sh to track responses"