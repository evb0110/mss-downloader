#!/bin/bash

# Pick-Todo v1.0 - Deep-Thinking Single Todo Resolution
# Modeled after handle-issues thorough deep-thinking approach

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 PICK-TODO v1.0 - DEEP-THINKING SINGLE TODO RESOLVER"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🧠 PRINCIPLE: Unlimited thinking time for thorough todo analysis and resolution"
echo ""
echo "This command applies multi-layer approach to single todo:"
echo "1. DEEP ANALYSIS - Understand the library architecture and requirements"
echo "2. SAFE PLANNING - Plan implementation without breaking existing functionality"
echo "3. CAREFUL IMPLEMENTATION - Code with extensive safety checks"
echo "4. THOROUGH VALIDATION - Test both new functionality and existing libraries"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

# Path to todos file
TODOS_FILE="$PROJECT_ROOT/.devkit/tasks/TODOS.md"

# Check if todos file exists
if [ ! -f "$TODOS_FILE" ]; then
    echo "❌ Error: TODOS.md not found at $TODOS_FILE"
    exit 1
fi

# Change to project root
cd "$PROJECT_ROOT"

# Check if todo number is provided
TODO_NUMBER="$1"
if [ -z "$TODO_NUMBER" ]; then
    echo "🔍 No specific todo number provided. Selecting first pending todo..."
    echo ""
    
    # Get the first pending todo
    FIRST_TODO=$(grep "^[0-9]\+\." "$TODOS_FILE" | head -1)
    if [ -z "$FIRST_TODO" ]; then
        echo "❌ No pending todos found in TODOS.md"
        exit 1
    fi
    
    TODO_NUMBER=$(echo "$FIRST_TODO" | grep -o "^[0-9]\+")
    echo "📝 Selected todo #$TODO_NUMBER: $(echo "$FIRST_TODO" | cut -d' ' -f2- | head -c 60)..."
else
    echo "🎯 Targeting specific todo #$TODO_NUMBER"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 LAUNCHING DEEP-THINKING TODO RESOLUTION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Extract the specific todo
SELECTED_TODO=$(grep "^$TODO_NUMBER\." "$TODOS_FILE")
if [ -z "$SELECTED_TODO" ]; then
    echo "❌ Todo #$TODO_NUMBER not found in TODOS.md"
    exit 1
fi

echo "📋 SELECTED TODO:"
echo "$SELECTED_TODO"
echo ""

# Parse todo details
TODO_CONTENT=$(echo "$SELECTED_TODO" | sed "s/^$TODO_NUMBER\. //")
TODO_LIBRARY=$(echo "$TODO_CONTENT" | grep -o "Fix [A-Za-z ]*" | sed 's/Fix //' | sed 's/ .*//')
TODO_URL=$(echo "$TODO_CONTENT" | grep -o "https\?://[^ ]*")

echo "🏛️  LIBRARY: $TODO_LIBRARY"
echo "🔗 URL: $TODO_URL"
echo ""

echo "🧠 DEEP-THINKING ANALYSIS PHASES:"
echo "Phase 1: Library Architecture Investigation"
echo "Phase 2: Manifest/API Endpoint Discovery"  
echo "Phase 3: Filename Pattern Analysis"
echo "Phase 4: Implementation Strategy Planning"
echo "Phase 5: Safety-First Implementation"
echo "Phase 6: Multi-Library Validation Testing"
echo ""
echo "MANDATORY SAFETY REQUIREMENTS:"
echo "- PRESERVE all existing working libraries"
echo "- DISCOVER actual filenames (never assume patterns)"
echo "- TEST with real manuscript downloads"
echo "- VALIDATE existing libraries still work after changes"
echo ""

# Signal to Claude that pick-todo mode should be used
echo "PICK_TODO_MODE=true"
echo "DEEP_THINKING_ENABLED=true"
echo "SELECTED_TODO_NUMBER=$TODO_NUMBER"
echo "TODO_LIBRARY=$TODO_LIBRARY"
echo "TODO_URL=$TODO_URL"
echo "TODO_CONTENT=$TODO_CONTENT"
echo "TODOS_FILE=$TODOS_FILE"
echo ""
echo "Claude, please begin deep-thinking analysis and resolution for this todo."