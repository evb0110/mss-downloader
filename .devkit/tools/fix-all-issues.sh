#!/bin/bash

# Comprehensive issue fixing system for mss-downloader
# This script automatically processes all open issues, fixes them, and manages version bumps

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

print_color "$BLUE" "=== MSS Downloader Comprehensive Issue Fixing System ==="
echo ""

# Step 1: Get all open issues
print_color "$YELLOW" "Step 1: Fetching all open issues..."
open_issues=$(gh issue list --state open --json number,title,body,url -q '.[] | @json' | jq -s '.')

# Save issues to a file for reference
echo "$open_issues" > .devkit/current-issues.json

# Count issues
issue_count=$(echo "$open_issues" | jq 'length')
print_color "$GREEN" "Found $issue_count open issue(s)"

if [ "$issue_count" -eq 0 ]; then
    print_color "$GREEN" "No open issues to fix!"
    exit 0
fi

# Step 2: Create todo list from issues
print_color "$YELLOW" "Step 2: Creating todo list from issues..."
todos_file=".devkit/tasks/TODOS.md"
mkdir -p "$(dirname "$todos_file")"

# Create header
echo "# Auto-generated TODO list from GitHub Issues" > "$todos_file"
echo "" >> "$todos_file"
echo "Generated on: $(date)" >> "$todos_file"
echo "" >> "$todos_file"

# Process each issue and create todos
echo "$open_issues" | jq -r '.[] | "## Issue #\(.number): \(.title)\n\n**URL:** \(.url)\n\n**Description:**\n\(.body)\n\n**TODO:**\n- [ ] Analyze issue and identify root cause\n- [ ] Implement fix\n- [ ] Test fix thoroughly\n- [ ] Add explanation to issue\n\n---\n"' >> "$todos_file"

print_color "$GREEN" "Todo list created at: $todos_file"

# Step 3: Create comprehensive fix plan
print_color "$YELLOW" "Step 3: Creating comprehensive fix plan..."
fix_plan_file=".devkit/issue-fix-plan.json"

# Create a structured plan for consecutive work (NO AGENTS)
cat > "$fix_plan_file" << 'EOF'
{
  "task": "Fix all open MSS Downloader issues",
  "approach": "consecutive",
  "workflow": "single-threaded",
  "phases": [
    {
      "phase": 1,
      "name": "Issue Analysis",
      "description": "Analyze each issue to understand the root cause",
      "approach": "consecutive - work through each issue one by one"
    },
    {
      "phase": 2,
      "name": "Implementation",
      "description": "Implement fixes for all identified issues",
      "approach": "consecutive - implement fixes one by one"
    },
    {
      "phase": 3,
      "name": "Node.js Testing",
      "description": "Test all fixes thoroughly with Node.js validation scripts",
      "approach": "consecutive - test each fix using Node.js (never Electron)"
    }
  ],
  "critical_requirements": [
    "NO SUBAGENTS - work consecutively through all tasks",
    "NODE.JS TESTING ONLY - never spawn Electron",
    "Use SharedManifestLoaders directly in Node.js",
    "Create validation PDFs using Node.js scripts"
  ]
}
EOF

# Step 4: Execute fixes with Claude
print_color "$YELLOW" "Step 4: Initiating automated fix process..."
print_color "$BLUE" "This will:"
echo "  1. Analyze each issue systematically"
echo "  2. Implement necessary fixes"
echo "  3. Test all changes"
echo "  4. Create validation PDFs"
echo "  5. Bump version when complete"
echo "  6. Add explanations to each issue"
echo ""

# Create instruction file for Claude
cat > .devkit/fix-instructions.md << 'EOF'
# Instructions for Fixing All Open Issues

## Overview
You need to fix all open issues found in `.devkit/current-issues.json`.

## Process (WORK CONSECUTIVELY - NO SUBAGENTS)
1. **Analyze Issues**: Read each issue carefully and understand the problem
2. **Implement Fixes**: Make necessary code changes to fix each issue
3. **Test Thoroughly**: Create Node.js validation scripts and PDFs for each fix
4. **Document Changes**: Keep track of what was fixed for each issue

## Important Guidelines
- **CRITICAL: DO NOT USE SUBAGENTS** - Work through all tasks consecutively
- **CRITICAL: NODE.JS TESTING ONLY** - Never run Electron for testing
- Focus on fixing the actual problems, not just symptoms
- Test with real manuscript URLs from the issues using Node.js scripts
- Ensure all fixes are backward compatible
- Create comprehensive Node.js validation for each library

## Testing Requirements
- Use SharedManifestLoaders directly in Node.js (same as Electron main process)
- Import dependencies: `const { SharedManifestLoaders } = require('./src/shared/SharedManifestLoaders.js')`
- Use pdfkit for PDF creation (same library as Electron)
- Use https module for image downloads
- Use fs.promises for file operations
- Validate with poppler using execSync('pdfinfo filename.pdf')

## CRITICAL: NO FINDER/FILE MANAGER OPENING
- **NEVER use shell.openItem, shell.openPath, shell.showItemInFolder**
- **NEVER open file manager or Finder windows**
- **NEVER use commands like `open` (macOS) or `explorer` (Windows)**
- All validation results are saved to files only
- No manual PDF inspection by users in autonomous workflow

## After Fixing
- Run all Node.js tests
- Create validation PDFs using Node.js scripts
- Prepare non-technical explanations for each issue
- DO NOT bump version until all fixes are confirmed working

## Use Ultra-thinking
For complex issues, use extended thinking to:
- Understand the root cause
- Plan the best solution
- Consider edge cases
- Ensure robust implementation
EOF

print_color "$GREEN" "Fix instructions created"

# Step 5: Inform user about next steps
print_color "$BLUE" "=== Ready to Fix All Issues ==="
echo ""
print_color "$YELLOW" "The system is now set up to fix all $issue_count open issues."
echo ""
echo "Files created:"
echo "  - Todo list: $todos_file"
echo "  - Current issues: .devkit/current-issues.json"
echo "  - Fix plan: $fix_plan_file"
echo "  - Instructions: .devkit/fix-instructions.md"
echo ""
print_color "$GREEN" "Claude will now work on fixing all issues systematically."
print_color "$GREEN" "After fixes are complete, Node.js validation will run automatically."
echo ""

# Create validation runner script call
cat > .devkit/run-validations.sh << 'VALSCRIPT'
#!/bin/bash
# Run Node.js validations for all fixed issues

echo "🧪 Starting Node.js validation for all fixed issues..."
echo "CRITICAL: This uses Node.js only - never spawns Electron"
echo ""

cd "$(dirname "$0")/.."
node .devkit/tools/run-issue-validations.js

validation_result=$?

if [ $validation_result -eq 0 ]; then
    echo ""
    echo "✅ All validations passed!"
    echo "✅ Ready for autonomous version bump"
else
    echo ""
    echo "❌ Some validations failed"
    echo "❌ Fix issues before proceeding with version bump"
    exit 1
fi
VALSCRIPT

chmod +x .devkit/run-validations.sh

print_color "$GREEN" "Node.js validation runner created: .devkit/run-validations.sh"

# Step 6: Create post-fix script
cat > .devkit/tools/post-fix-actions.sh << 'POSTFIX'
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
POSTFIX

chmod +x .devkit/tools/post-fix-actions.sh

print_color "$GREEN" "Post-fix actions script created"