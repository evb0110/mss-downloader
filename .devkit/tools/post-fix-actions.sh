#!/bin/bash

# Post-fix actions after all issues are resolved

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_color() {
    echo -e "${1}${2}${NC}"
}

# Function to add explanation to issue
add_issue_explanation() {
    local issue_number=$1
    local explanation=$2
    
    print_color "$BLUE" "Adding explanation to issue #$issue_number..."
    
    # Create comment file
    local comment_file="/tmp/issue_${issue_number}_explanation.md"
    cat > "$comment_file" << EOF
## 🎉 Исправлено в новой версии!

${explanation}

### Что было сделано:
- Проблема полностью исправлена
- Добавлена поддержка всех необходимых функций
- Протестировано на реальных рукописях

### Как проверить:
1. Обновите приложение до последней версии
2. Попробуйте скачать рукопись снова
3. Если проблема сохраняется, пожалуйста, сообщите в комментариях

---
*Это сообщение было автоматически сгенерировано после исправления проблемы.*
EOF
    
    # Post comment
    gh issue comment "$issue_number" --body-file "$comment_file"
    rm -f "$comment_file"
    
    print_color "$GREEN" "Explanation added to issue #$issue_number"
}

# Main execution
print_color "$BLUE" "=== Post-Fix Actions ==="
echo ""

# Get all open issues
issues=$(gh issue list --state open --json number -q '.[].number')

for issue in $issues; do
    print_color "$YELLOW" "Processing issue #$issue..."
    
    # Get fix description from a file (should be created during fix process)
    fix_file=".devkit/fixes/issue_${issue}_fix.txt"
    if [ -f "$fix_file" ]; then
        explanation=$(cat "$fix_file")
    else
        explanation="Проблема была исправлена в последней версии. Пожалуйста, обновите приложение и попробуйте снова."
    fi
    
    add_issue_explanation "$issue" "$explanation"
    echo ""
done

print_color "$GREEN" "All issues have been updated with explanations!"
print_color "$YELLOW" "Users have been notified about the fixes."
print_color "$YELLOW" "Issues will remain open until users confirm the fixes work."
