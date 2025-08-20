Pick and handle the first pending todo from .devkit/tasks/TODOS.md following the complete project workflow with ULTRA-DEEP analysis and comprehensive validation.
## ultrathink

**⚡ ULTRA-THINK TODO EXECUTION ⚡**: This command applies maximum analytical depth and comprehensive testing to todo implementation with thorough validation protocols.

**🚨 RELIABILITY OVER EFFICIENCY - ABSOLUTE MANDATE 🚨**
**CRITICAL**: This command NEVER optimizes resources at the expense of reliability or thoroughness.

**ANTI-OPTIMIZATION RULES:**
- **UNLIMITED RESOURCES**: No token limits, no time constraints, no computational boundaries
- **SPAWN AGENTS FREELY**: Use up to 5 parallel agents for EVERY todo analysis
- **EXHAUSTIVE RESEARCH**: Web searches, system commands, comprehensive investigation
- **REDUNDANT VALIDATION**: Over-test everything, assume nothing works until proven
- **DEEP THINKING MANDATORY**: Think from every possible angle before implementation  
- **STUBBORN PERSISTENCE**: Todos may be "notoriously difficult" - persist until complete
- **BREAK NOTHING**: Existing functionality preservation is PARAMOUNT
- **USER SATISFACTION**: Top priority over all efficiency considerations
- **NO PAUSING**: Complete the ENTIRE todo in one continuous session - never pause mid-implementation

**Preliminary**
- if `jq` isn't installed on the computer, install it
- if `gh` isn't installed, install it and ask user to authorize and use it to access issues
- always use `gh` to download issues and attached logs or other files

**🔥 CRITICAL FOCUS: ONE TODO, MAXIMUM RESOURCES 🔥**

**RESOURCE ALLOCATION PHILOSOPHY:**
- **COMPUTE**: Use maximum available processing power
- **ANALYSIS**: Deploy multiple agents for thorough investigation
- **TESTING**: Exhaustive validation beyond normal limits
- **TIME**: No deadlines - complete when done right
- **TOOLS**: Any available system tool (curl, gh, zsh, web search, etc.)
- **THINKING**: Ultra-deep analysis from every conceivable angle
- **COMPLETION**: Finish the ENTIRE todo implementation without pausing or asking for permission to continue

## Core Workflow with ULTRA-DEEP Analysis

**Phase 1: Todo Selection & Deep Analysis**
1. **Read** first pending todo from .devkit/tasks/TODOS.md (ONLY select todos WITHOUT ✅ checkmark)
2. **ULTRA-DEEP Analysis** of the todo requirements and implications
3. **Historical Context Analysis** - check related changes and patterns
4. **Solution Strategy Matrix** - develop multiple approaches
5. **Risk Assessment** - identify potential failure points

**Phase 2: Production Code Mapping**
Create comprehensive code flow analysis for the todo implementation:
```typescript
// Create analysis workspace
mkdir -p .devkit/todo-analysis/{code-mapping,testing,validation}

interface TodoAnalysis {
    task: string;
    codeFiles: string[];
    dependencies: string[];
    testingStrategy: string[];
    validationPoints: string[];
    riskFactors: string[];
}

// Map ENTIRE code execution path for the todo
class TodoDeepAnalyzer {
    private todoTask: string;
    private affectedFiles: string[];
    private dependencyChain: string[];
    
    async analyzeCompleteImpact(): Promise<TodoAnalysis> {
        // 1. Trace all code paths affected by this todo
        await this.mapCodeFlow();
        
        // 2. Identify all dependencies and interactions
        await this.analyzeDependencies();
        
        // 3. Plan comprehensive testing strategy
        await this.planTestingApproach();
        
        // 4. Identify validation checkpoints
        await this.identifyValidationPoints();
        
        return this.generateAnalysisReport();
    }
}
```

**Phase 3: Multi-Dimensional Implementation Planning**

### 3.1 Solution Strategy Matrix
**Create MULTIPLE implementation approaches:**
```
SOLUTION MATRIX for Todo: [TASK_DESCRIPTION]
┌─────────────────────────────────────────┐
│ Approach A: Direct Implementation       │
│ - Minimal code changes                  │
│ - Risk: May miss edge cases             │
│ - Confidence: 70%                       │
├─────────────────────────────────────────┤
│ Approach B: Comprehensive Refactor      │
│ - Robust architecture changes           │
│ - Risk: Broader impact                  │
│ - Confidence: 90%                       │
├─────────────────────────────────────────┤
│ Approach C: Progressive Enhancement     │
│ - Step-by-step improvements             │
│ - Risk: Longer implementation           │
│ - Confidence: 85%                       │
└─────────────────────────────────────────┘
```

### 3.2 Multi-Dimensional Testing Strategy
**MANDATORY: Test from EVERY angle:**

1. **Functionality Testing:**
   - Core feature implementation
   - Edge case handling
   - Error boundary testing
   - Integration points
   - User workflow validation

2. **Regression Testing:**
   - All existing features must continue working
   - Performance impact measurement
   - Memory usage analysis
   - Network behavior verification

3. **Environment Testing:**
   - Development environment
   - Production build testing
   - Different operating systems (if applicable)
   - Various data conditions

4. **Stress Testing:**
   - Large data sets
   - Concurrent operations
   - Resource limitation scenarios
   - Error recovery testing

### 3.3 Historical Pattern Analysis
```bash
# Search for similar todos in completed history
grep -r "similar_pattern" .devkit/tasks/TODOS-COMPLETED.md

# Analyze git history for related implementations
git log --grep="$TODO_KEYWORD" --oneline > .devkit/todo-analysis/related-commits.txt

# Check for pattern regressions
git diff HEAD~10..HEAD -- $AFFECTED_FILES > .devkit/todo-analysis/recent-changes.diff
```

**Phase 4: Safe Implementation with Progressive Testing**

### 4.1 Implementation with MAXIMUM Safety
```typescript
// BEFORE any changes - create safety snapshot
interface SafetySnapshot {
    timestamp: string;
    todoTask: string;
    originalCode: Record<string, string>;
    workingFeatures: boolean[];
    approach: string;
}

// Create comprehensive backup before implementation
const safetySnapshot: SafetySnapshot = {
    timestamp: new Date().toISOString(),
    todoTask: SELECTED_TODO,
    originalCode: await backupAffectedFiles(),
    workingFeatures: await testAllExistingFeatures(),
    approach: selectedApproach
};

await fs.writeFile('.devkit/todo-analysis/safety-snapshot.json', JSON.stringify(safetySnapshot, null, 2));
```

### 4.2 Progressive Implementation Protocol
1. **Implement minimal working version first**
2. **Test core functionality immediately**
3. **If successful, enhance gradually**  
4. **Test after EACH enhancement**
5. **Stop at optimal solution**
6. **Never proceed if tests fail**

**Phase 5: ULTRA-VALIDATION Protocol**

### 5.1 Exhaustive Test Suite
```typescript
interface ValidationResults {
    coreFunction: TestResult;
    edgeCases: TestResult[];
    regressionTests: TestResult[];
    performanceMetrics: PerformanceData;
    stressTests: StressTestResults;
    integrationTests: TestResult[];
}

class TodoUltraValidator {
    async validateComprehensively(): Promise<ValidationResults> {
        const results: ValidationResults = {
            coreFunction: await this.testCoreImplementation(),
            edgeCases: await this.testAllEdgeCases(),
            regressionTests: await this.testAllExistingFeatures(),
            performanceMetrics: await this.measurePerformanceImpact(),
            stressTests: await this.runStressTests(),
            integrationTests: await this.testIntegrationPoints()
        };
        
        // Generate comprehensive evidence
        await this.generateValidationEvidence(results);
        
        return results;
    }
    
    private async generateValidationEvidence(results: ValidationResults): Promise<void> {
        // Create proof of working implementation
        // Generate performance comparisons
        // Document test coverage
        // Build comprehensive validation report
    }
}
```

### 5.2 Multi-Environment Validation
```bash
# Test in different environments
npm run test:e2e               # Electron environment
bun todo-validation.ts         # Pure TypeScript with Bun
npm run build && test built    # Production build validation

# Verify all project-specific test commands pass
npm run lint                   # Code quality validation
npm run typecheck              # Type safety verification
```

### 5.3 Evidence Collection Requirements
**MANDATORY evidence before marking todo complete:**
1. Screenshots/logs showing working implementation
2. Test output showing all validations passed
3. Performance metrics comparison (before/after)
4. Regression test results (all existing features working)
5. Code quality metrics (lint, typecheck passing)
6. Integration test evidence

**Phase 6: Completion & Documentation**

### 6.1 Comprehensive Implementation Report
```markdown
# Todo Implementation Report: [TASK_DESCRIPTION]

## Executive Summary
[One paragraph explaining what was implemented]

## Analysis Phase Results
### Problem Understanding
[Detailed analysis of the todo requirements]

### Solution Strategy
[Why this approach was chosen over alternatives]

### Risk Mitigation
[How potential issues were addressed]

## Implementation Details
### Code Changes
[Detailed explanation of changes with file locations]

### Testing Strategy
[Comprehensive testing approach used]

### Validation Results
[All test results and evidence]

## Performance Impact
[Before/after metrics and analysis]

## Future Considerations
[Any follow-up items or monitoring needed]
```

### 6.2 Final Workflow Steps
6. **Report** completion with comprehensive evidence
7. **Update** CLAUDE.md with insights/changes if applicable  
8. **Archive** completed todo to .devkit/tasks/TODOS-COMPLETED.md (remove from .devkit/tasks/TODOS.md)

**Critical Requirements - ENHANCED:**
- Only mark tasks as completed when ACTUALLY FULLY IMPLEMENTED AND WORKING
- Never mark completed based on code changes alone - verify functionality works through comprehensive testing
- Use project-specific test commands (e.g., `npm run test:e2e:start`/`npm run test:e2e:kill`)
- Follow project's version bump and deployment workflow
- **NEW**: Must pass ULTRA-VALIDATION protocol before completion
- **NEW**: Must generate comprehensive evidence of working implementation
- **NEW**: Must verify no regressions in existing functionality
- **NEW**: Must document implementation approach and testing strategy

**File Management - ENHANCED:**
- Keep .devkit/tasks/TODOS.md clean with only pending tasks
- Archive completed tasks in .devkit/tasks/TODOS-COMPLETED.md organized by version
- Maintain clean separation between pending and completed todos
- **NEW**: Store all analysis artifacts in .devkit/todo-analysis/
- **NEW**: Generate validation evidence in .devkit/todo-analysis/validation/
- **NEW**: Clean up analysis workspace after successful completion

**Quality Gates - NO COMPROMISES:**
- [ ] ULTRA-DEEP analysis completed (NEVER skip this)
- [ ] Multiple solution approaches evaluated (minimum 3 approaches)
- [ ] Safest implementation approach selected (NOT fastest)
- [ ] Progressive implementation with testing at each step (NEVER batch test)
- [ ] Comprehensive validation protocol executed (NEVER assume success)
- [ ] All evidence collected and verified (REDUNDANT verification required)
- [ ] No regressions detected (Test ALL existing functionality) 
- [ ] Performance maintained or improved (NEVER degrade performance)
- [ ] Documentation complete (COMPREHENSIVE, not minimal)

**🛡️ RELIABILITY CHECKPOINTS:**
- [ ] Spawned multiple agents for thorough analysis
- [ ] Used web research when knowledge gaps identified
- [ ] Applied system tools for comprehensive investigation
- [ ] Tested beyond normal boundaries (stress testing)
- [ ] Verified working functionality multiple times
- [ ] Confirmed NO existing functionality broken
- [ ] Generated excessive evidence rather than minimal proof
- [ ] Completed ENTIRE todo in one continuous session without pausing

**🚫 FORBIDDEN BEHAVIORS IN TODO PROCESSING:**
- ❌ Pausing mid-implementation to ask for permission to continue
- ❌ Stopping analysis to wait for user approval  
- ❌ Breaking todo into sub-chunks requiring user confirmation
- ❌ Asking "Should I proceed with the implementation?" - JUST PROCEED
- ❌ Any interruption of the todo completion flow