Handle all pending todos from TODOS.md by sequentially calling pick-todo.md for each one.

**🔄 TODO BATCH PROCESSOR 🔄**: This command is a simple wrapper that loops through all pending todos and processes each one using the comprehensive pick-todo.md workflow.

**🚨 ANTI-OPTIMIZATION DIRECTIVE 🚨**
**NEVER sacrifice reliability for efficiency. NEVER optimize resources at the cost of thoroughness.**
- **NO TOKEN LIMITS**: Use unlimited resources for analysis and validation
- **NO TIME PRESSURE**: Take as long as needed for each todo
- **NO SHORTCUTS**: Always use full ULTRA-DEEP analysis workflow
- **NO PARALLEL PROCESSING**: Sequential only to ensure stability
- **MAXIMUM REDUNDANCY**: Over-test rather than under-test
- **ULTRATHINKING MANDATORY**: Deep analysis is non-negotiable

**🛑 MANDATORY CONTINUOUS EXECUTION - NO PAUSING ALLOWED 🛑**
**CRITICAL**: This command MUST process ALL todos in one continuous session WITHOUT pausing.
- **NEVER PAUSE**: Do not stop after processing chunks (5, 10, 25, etc.) of todos
- **NEVER ASK**: Do not ask user to continue - keep going automatically
- **NEVER CHUNK**: Do not break the work into batches requiring user approval
- **CONTINUOUS FLOW**: Process todo #1, then #2, then #3... until ALL are complete
- **NO INTERRUPTIONS**: Complete the entire todo list in one uninterrupted session
- **AUTO-CONTINUE**: If you feel like pausing, DON'T - continue to the next todo immediately

**Core Function:**
This command reads all pending todos from `.devkit/tasks/TODOS.md` and calls the `pick-todo.md` command for each one in sequence (NOT parallel).

**Sequential Processing Workflow:**

### Phase 1: Context Analysis
1. **Read** complete TODOS.md to understand all pending tasks
2. **Analyze** relationships between todos - some may be related
3. **Plan** optimal processing order if dependencies exist
4. **Report** total count and brief overview to user

### Phase 2: Sequential Todo Processing
**CRITICAL**: Process todos ONE AT A TIME using pick-todo.md - NEVER PAUSE BETWEEN TODOS

```bash
# CONTINUOUS WORKFLOW - NO PAUSING ALLOWED:
TOTAL_TODOS=$(grep -c "^- \[ \]" .devkit/tasks/TODOS.md)
CURRENT_COUNT=0

while [ $(grep -c "^- \[ \]" .devkit/tasks/TODOS.md) -gt 0 ]; do
    CURRENT_COUNT=$((CURRENT_COUNT + 1))
    echo "📋 Processing todo $CURRENT_COUNT/$TOTAL_TODOS - CONTINUOUS MODE"
    
    # Call pick-todo.md command (which includes ULTRA-DEEP analysis)
    # This handles:
    # - Reading first pending todo
    # - ULTRA-DEEP analysis and implementation  
    # - Comprehensive testing and validation
    # - Evidence collection
    # - Archiving completed todo
    
    /claude pick-todo
    
    # IMMEDIATELY continue to next todo - NO PAUSING
    echo "✅ Todo $CURRENT_COUNT completed. IMMEDIATELY continuing to next..."
    
    # DO NOT PAUSE HERE - CONTINUE AUTOMATICALLY
    # DO NOT ASK USER PERMISSION - KEEP GOING
    # DO NOT BATCH PROCESS - ONE CONTINUOUS FLOW
done

echo "🎉 ALL $TOTAL_TODOS todos completed in continuous session!"
```

### Phase 3: Final Batch Completion
**After ALL todos are completed:**
1. **Version** bump patch version in package.json
2. **Update** changelog with consolidated changes
3. **Commit** all changes with descriptive message
4. **Push** to trigger automated builds/notifications
5. **Report** completion summary to user

**Key Principles:**
- **Sequential Only**: Never process todos in parallel
- **Complete Each Todo**: Use full pick-todo.md workflow for each
- **Wait for Completion**: Only start next todo after current one is fully done
- **Context Awareness**: Keep track of relationships between todos
- **Comprehensive Testing**: Each todo gets full validation via pick-todo.md
- **Single Version Bump**: Only bump version once at the end for all changes

**🔬 ULTRA-RELIABILITY MANDATES:**
- **NEVER SKIP ANALYSIS**: Every todo gets full ULTRA-DEEP treatment
- **NEVER RUSH IMPLEMENTATION**: Quality over speed, always
- **NEVER LIMIT TESTING**: Test beyond normal boundaries
- **NEVER ASSUME SUCCESS**: Verify everything multiple times
- **NEVER OPTIMIZE PREMATURELY**: Reliability first, efficiency never
- **NEVER PAUSE EXECUTION**: Complete ALL todos in one continuous session
- **SPAWN AGENTS**: Use up to 5 parallel agents per todo for thorough analysis
- **WEB SEARCHES**: Use unlimited web research when needed
- **SYSTEM COMMANDS**: Use any tools (gh, curl, zsh) for comprehensive analysis

**🚫 FORBIDDEN BEHAVIORS:**
- ❌ Pausing after processing X number of todos
- ❌ Asking user "Should I continue with the remaining todos?"
- ❌ Breaking work into chunks requiring user approval
- ❌ Stopping for any reason before ALL todos are complete
- ❌ Batching todos and waiting for permission between batches
- ❌ Any interruption of the continuous processing flow

**Command Delegation:**
This command does NOT implement todo logic itself. It simply:
1. Reads the todo list
2. Calls `/claude pick-todo` for each pending item
3. Handles final version bump and deployment

All the heavy lifting (analysis, implementation, testing, validation) is done by the enhanced pick-todo.md workflow.