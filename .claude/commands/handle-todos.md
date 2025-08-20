Handle all pending todos from TODOS.md by launching separate ultrathink-working subagents for each todo.

**🔄 TODO ULTRATHINK PROCESSOR 🔄**: This command launches separate ultrathink-working subagents for each pending todo, allowing parallel execution with maximum analytical depth.

**🚨 ANTI-OPTIMIZATION DIRECTIVE 🚨**
**NEVER sacrifice reliability for efficiency. NEVER optimize resources at the cost of thoroughness.**
- **NO TOKEN LIMITS**: Use unlimited resources for analysis and validation
- **NO TIME PRESSURE**: Take as long as needed for each todo
- **NO SHORTCUTS**: Always use full ULTRA-DEEP analysis workflow
- **MAXIMUM PARALLEL AGENTS**: Launch separate ultrathink agent for EVERY todo
- **MAXIMUM REDUNDANCY**: Over-test rather than under-test
- **ULTRATHINKING MANDATORY**: Deep analysis is non-negotiable

**🛑 MANDATORY CONTINUOUS EXECUTION - NO PAUSING ALLOWED 🛑**
**CRITICAL**: This command MUST process ALL todos in one continuous session WITHOUT pausing.
- **NEVER PAUSE**: Do not stop after launching agents or collecting results
- **NEVER ASK**: Do not ask user to continue - keep going automatically
- **NEVER CHUNK**: Do not break the work into batches requiring user approval
- **CONTINUOUS FLOW**: Launch agent for todo #1, then #2, then #3... until ALL are launched
- **NO INTERRUPTIONS**: Complete the entire todo list in one uninterrupted session
- **AUTO-CONTINUE**: If you feel like pausing, DON'T - continue to the next todo immediately

**Core Function:**
This command reads all pending todos from `.devkit/tasks/TODOS.md` and launches a separate ultrathink-working subagent for each todo using the Task tool with general-purpose subagent_type.

**Ultrathink Agent Workflow:**

### Phase 1: Context Analysis & Agent Preparation
1. **Read** complete TODOS.md to understand all pending tasks
2. **Extract** each pending todo with full context
3. **Prepare** agent prompts for parallel execution
4. **Report** total count and brief overview to user

### Phase 2: Parallel Agent Deployment
**CRITICAL**: Launch separate ultrathink agent for EVERY todo - NEVER PAUSE BETWEEN LAUNCHES

```typescript
// ULTRATHINK AGENT DEPLOYMENT WORKFLOW:
const pendingTodos = extractPendingTodos('.devkit/tasks/TODOS.md');
const TOTAL_TODOS = pendingTodos.length;

console.log(`🚀 Deploying ${TOTAL_TODOS} ultrathink agents - PARALLEL MODE`);

// Launch all agents simultaneously using Task tool
for (let i = 0; i < pendingTodos.length; i++) {
    const todo = pendingTodos[i];
    const todoNumber = i + 1;
    
    console.log(`🧠 Launching ultrathink agent ${todoNumber}/${TOTAL_TODOS} for: ${todo.content}`);
    
    // Use Task tool with general-purpose subagent_type
    const agentPrompt = `
ULTRATHINK TODO EXECUTION AGENT #${todoNumber}

ASSIGNED TODO: ${todo.content}
TODO CONTEXT: ${todo.context}
TODO ID: ${todo.id}

MISSION: Execute the complete pick-todo.md workflow for this specific todo with ULTRA-DEEP analysis.

REQUIRED TASKS:
1. ULTRA-DEEP analysis and implementation of the assigned todo
2. Comprehensive testing and validation
3. Evidence collection and documentation
4. Mark todo as completed in TODOS.md
5. Archive completed todo to COMPLETED.md

CRITICAL REQUIREMENTS:
- Use MAXIMUM analytical depth
- Apply full pick-todo.md workflow
- NEVER skip testing or validation
- Provide detailed completion report
- Ensure todo is properly marked as complete

DELIVERABLES:
- Completed implementation
- Test results and validation evidence
- Updated TODOS.md with todo marked complete
- Detailed completion report

Execute with maximum thoroughness and ultrathinking depth.
    `;
    
    // Launch ultrathink agent using Task tool
    Task({
        description: `Execute todo ${todoNumber}`,
        prompt: agentPrompt,
        subagent_type: "general-purpose"
    });
    
    // IMMEDIATELY continue to next agent - NO PAUSING
    console.log(`✅ Agent ${todoNumber} launched. IMMEDIATELY launching next...`);
    
    // DO NOT PAUSE HERE - CONTINUE AUTOMATICALLY
    // DO NOT ASK USER PERMISSION - KEEP GOING
    // DO NOT BATCH PROCESS - ONE CONTINUOUS FLOW
}

console.log(`🎉 ALL ${TOTAL_TODOS} ultrathink agents deployed simultaneously!`);
```

### Phase 3: Agent Coordination & Results Collection
**After ALL agents are launched:**
1. **Monitor** agent execution and collect completion reports
2. **Verify** all todos have been marked as completed
3. **Consolidate** changes and test results from all agents
4. **Validate** that no todos remain pending

### Phase 4: Final Batch Completion
**After ALL agents complete their todos:**
1. **Version** bump patch version in package.json
2. **Update** changelog with consolidated changes from all agents
3. **Commit** all changes with descriptive message
4. **Push** to trigger automated builds/notifications
5. **Report** completion summary to user

**Key Principles:**
- **Maximum Parallelism**: Launch separate ultrathink agent for EVERY todo
- **Complete Autonomy**: Each agent executes full pick-todo.md workflow independently
- **No Dependencies**: Agents work simultaneously without waiting
- **Context Awareness**: Each agent receives full todo context
- **Comprehensive Testing**: Each todo gets full validation via dedicated agent
- **Single Version Bump**: Only bump version once at the end for all changes
- **Ultrathink Depth**: Every agent applies maximum analytical thoroughness

**🔬 ULTRA-RELIABILITY MANDATES:**
- **NEVER SKIP ANALYSIS**: Every todo gets full ULTRA-DEEP treatment via dedicated agent
- **NEVER RUSH IMPLEMENTATION**: Quality over speed, always - each agent takes unlimited time
- **NEVER LIMIT TESTING**: Test beyond normal boundaries - each agent validates thoroughly
- **NEVER ASSUME SUCCESS**: Verify everything multiple times via agent reports
- **NEVER OPTIMIZE PREMATURELY**: Reliability first, efficiency never - maximum agents deployed
- **NEVER PAUSE EXECUTION**: Complete ALL agent launches in one continuous session
- **MAXIMUM AGENTS**: Deploy separate ultrathink agent for EVERY single todo
- **WEB SEARCHES**: Each agent uses unlimited web research when needed
- **SYSTEM COMMANDS**: Each agent uses any tools (gh, curl, zsh) for comprehensive analysis

**🚫 FORBIDDEN BEHAVIORS:**
- ❌ Pausing after launching X number of agents
- ❌ Asking user "Should I continue with the remaining todos?"
- ❌ Breaking work into chunks requiring user approval
- ❌ Stopping for any reason before ALL agents are launched
- ❌ Batching agent launches and waiting for permission between batches
- ❌ Any interruption of the continuous agent deployment flow
- ❌ Reusing agents for multiple todos - each todo gets its own dedicated agent

**Command Delegation:**
This command does NOT implement todo logic itself. It simply:
1. Reads the todo list and extracts all pending todos
2. Launches separate ultrathink agents using Task tool with general-purpose subagent_type
3. Each agent executes the full pick-todo.md workflow independently
4. Handles final version bump and deployment after all agents complete

All the heavy lifting (analysis, implementation, testing, validation) is done by dedicated ultrathink agents executing the enhanced pick-todo.md workflow in parallel.