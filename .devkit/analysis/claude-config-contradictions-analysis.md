# CLAUDE.md Configuration Contradictions Analysis

## Executive Summary

This analysis identifies 8 major contradictions and conflicts across the three CLAUDE.md configuration files that could lead to inconsistent behavior and ambiguous decision-making.

## Configuration Hierarchy

Based on the documented priority system:
1. **Local Private** (`PROJECT/CLAUDE.local.md`) - User's private project settings
2. **Project Specific** (`PROJECT/CLAUDE.md`) - Project-specific rules (committed) ⭐ **HIGHEST PRIORITY in this analysis**
3. **Global Project** (`~/CLAUDE.md`) - Cross-project defaults
4. **Global System** (`~/.claude/CLAUDE.md`) - System-wide configuration ⭐ **LOWEST PRIORITY in this analysis**

---

## 🚨 CRITICAL CONTRADICTIONS

### 1. Automatic Actions vs User Confirmation Requirements

**CONTRADICTION:**

**Global System** (line 9):
> - **Destructive Actions**: Always confirm with user before permanent deletions, force pushes, or data modifications

**Cross-Project** (line 15):
> - **Trigger words**: "commit", "commit-push", "push" should automatically trigger the respective actions without asking for confirmation.

**Project-Specific** (lines 34-39):
> **AUTOMATIC BUMP REQUIRED** after any functional change:
> - Bug fixes affecting app functionality
> - New features or improvements

**Project-Specific** (lines 72-84):
> **CRITICAL: NEVER BUMP VERSION WITHOUT EXPLICIT USER APPROVAL**
> **NO AUTOMATIC BUMPS:** Never bump version automatically, regardless of keywords

**CONFLICT EXPLANATION:**
The global system requires confirmation for "data modifications" (which version bumps and commits certainly are), but cross-project rules allow automatic commits without confirmation, and project-specific rules contradict themselves by requiring both automatic bumps AND explicit user approval.

**RESOLUTION PRIORITY:** Project-specific rules take precedence
**PROPOSED REFACTORING:**
```markdown
## Version Bump Policy
- **EXPLICIT APPROVAL REQUIRED:** Always wait for explicit user approval before version bumps
- **COMMIT AUTOMATION:** Allow automatic commits for trigger words "commit", "commit-push", "push" without confirmation
- **VERSION BUMPS ARE NOT COMMITS:** Version bump is a separate action requiring explicit approval after validation completion
```

---

### 2. Development Server Policy Conflicts

**CONTRADICTION:**

**Cross-Project** (line 8):
> - **Development Server Policy**: NEVER automatically start or maintain development servers (npm run dev, npm start, etc.) unless explicitly requested by the user.

**Cross-Project** (line 7):
> - **Background Agents**: ... should not include development servers or continuous processes unless specifically requested.

**Project-Specific** (lines 147-149):
> - **Development Commands:**
>   - `npm run dev` - runs with visible window (for user interaction)
>   - `npm run dev:headless` - runs in headless mode (for automated testing/Claude usage)

**CONFLICT EXPLANATION:**
Cross-project rules forbid automatic development servers, but project-specific rules document development commands without clarifying when they can be used automatically vs when they require explicit user request.

**RESOLUTION PRIORITY:** Project-specific rules take precedence
**PROPOSED REFACTORING:**
```markdown
## Development Server Policy
- **EXPLICIT REQUEST REQUIRED:** Never automatically start development servers
- **AVAILABLE COMMANDS:** 
  - `npm run dev` - visible window (only when user explicitly requests UI interaction)
  - `npm run dev:headless` - headless mode (only for automated testing when explicitly requested)
- **TESTING EXCEPTION:** Headless mode may be used for validation protocols when explicitly testing libraries
```

---

### 3. Background Agents vs Process Management

**CONTRADICTION:**

**Global System** (line 59):
> - **Agents**: Always run additional agents in the background using Task tool

**Cross-Project** (line 7):
> - **Background Agents**: When explicitly requested by the user, run additional agents in the background using Task tool.

**Project-Specific** (lines 7-15):
> - User can specify how many additional agents you can spawn, if not specified by user, spawn default of 5 agents.
> - You can spawn agents as many times as you want, just don't overcome the limit of parallel.

**CONFLICT EXPLANATION:**
Global system says "always" run agents, cross-project says "when explicitly requested", and project-specific allows default spawning without explicit request.

**RESOLUTION PRIORITY:** Project-specific rules take precedence
**PROPOSED REFACTORING:**
```markdown
## Background Agents Policy
- **DEFAULT SPAWNING:** Spawn default of 5 agents when not specified by user
- **USER CONTROL:** User can specify custom agent count
- **EXPLICIT REQUEST:** Required only for development servers and continuous processes, not for general task agents
- **PARALLEL LIMITS:** Respect specified parallel limits at all times
```

---

### 4. Output Management Inconsistencies

**CONTRADICTION:**

**Global System** (line 50):
> - **Output Management**: Always summarize tool outputs, especially during multi-file analysis. Limit individual tool outputs to essential information only.

**Cross-Project** (lines 24-32):
> - **MANDATORY OUTPUT SUPPRESSION**: NEVER EVER display raw tool outputs. This is CRITICAL for user experience:
>   - **ZERO TOLERANCE**: Raw outputs create thousands of lines of spam - THIS IS UNACCEPTABLE

**Project-Specific** (lines 18-23):
> - **Tool Output Suppression**: NEVER display raw tool outputs. Always summarize:
>   - Exception: Only show critical error details (max 3-5 lines) if needed for troubleshooting

**CONFLICT EXPLANATION:**
Global system allows "essential information" and "summarize", cross-project has "ZERO TOLERANCE" for raw outputs, project-specific allows exceptions for critical errors.

**RESOLUTION PRIORITY:** Project-specific rules take precedence
**PROPOSED REFACTORING:**
```markdown
## Output Management Policy
- **ZERO RAW OUTPUTS:** Never display raw tool outputs
- **SUMMARIZATION REQUIRED:** Always provide concise summaries instead
- **CRITICAL ERROR EXCEPTION:** Show max 3-5 lines of critical error details only when needed for troubleshooting
- **USER EXPERIENCE PRIORITY:** Prevent output spam that degrades user experience
```

---

### 5. Git Command Safety Conflicts

**CONTRADICTION:**

**Cross-Project** (line 6):
> - **Safe Reverts**: Only revert changes made in the current session. User can work simultaneously, so don't use `git reset --hard` or similar commands.

**Project-Specific** (line 28):
> - DO NOT USE `git add .` or similar!

**Global System** (line 9):
> - **Destructive Actions**: Always confirm with user before permanent deletions, force pushes, or data modifications

**CONFLICT EXPLANATION:**
Different levels of git safety requirements across configurations without clear definition of what constitutes "destructive" in the git context.

**RESOLUTION PRIORITY:** Project-specific rules take precedence
**PROPOSED REFACTORING:**
```markdown
## Git Safety Protocol
- **FORBIDDEN COMMANDS:** Never use `git add .`, `git reset --hard`, or similar broad commands
- **SESSION-SCOPED CHANGES:** Only revert changes made in current session
- **PARALLEL WORK SAFETY:** User may have parallel sessions, so track changes precisely
- **SELECTIVE STAGING:** Always stage specific files/changes that Claude modified
```

---

### 6. File Organization Directory Conflicts

**CONTRADICTION:**

**Global System** (line 30):
> - **Standard structure**: Use `.devkit/docs/` for documentation, `.devkit/cache/` for temporary data, `.devkit/tools/` for scripts, `.devkit/analysis/` for reports

**Project-Specific** (line 138):
> - Store all reports/analysis in `.devkit/reports/` (create if doesn't exist)

**CONFLICT EXPLANATION:**
Global system specifies `.devkit/analysis/` for reports, but project-specific requires `.devkit/reports/`.

**RESOLUTION PRIORITY:** Project-specific rules take precedence
**PROPOSED REFACTORING:**
```markdown
## File Organization Structure
- **PROJECT OVERRIDE:** Use `.devkit/reports/` for all reports and analysis (overrides global `.devkit/analysis/`)
- **GLOBAL FALLBACK:** Use global structure for directories not explicitly overridden by project
- **CONSISTENCY:** Maintain consistent structure within each project
```

---

### 7. Process Termination Command Conflicts

**CONTRADICTION:**

**Project-Specific** (line 123):
> - Use PID-safe commands: `npm run test:e2e:start`/`npm run test:e2e:kill`

**Cross-Project** (implied from development server policy):
> Development servers should only run when the user specifically asks for them

**CONFLICT EXPLANATION:**
Project-specific rules document PID-safe commands for process management, but cross-project rules suggest avoiding long-running processes altogether. No clear guidance on when to use `killall` vs PID-safe commands.

**RESOLUTION PRIORITY:** Project-specific rules take precedence
**PROPOSED REFACTORING:**
```markdown
## Process Management Protocol
- **PID-SAFE PREFERRED:** Use PID-safe commands like `npm run test:e2e:kill` when available
- **KILLALL FORBIDDEN:** Never use `killall` or similar broad process termination
- **TESTING EXCEPTION:** Long-running test processes are allowed with proper PID management
- **DEVELOPMENT SERVERS:** Only start when explicitly requested by user
```

---

### 8. Language and Communication Conflicts

**CONTRADICTION:**

**Global System** (line 11):
> - **Language Default**: Respond in English unless explicitly asked otherwise

**Cross-Project** (line 4):
> - **LANGUAGE REQUIREMENT**: ALWAYS respond to user in English only. Use Russian for GitHub comments/PRs/issues.

**CONFLICT EXPLANATION:**
Global system allows language switching "unless explicitly asked otherwise", but cross-project requires "ALWAYS respond to user in English only" with exception for GitHub interactions.

**RESOLUTION PRIORITY:** Cross-project rules take precedence
**PROPOSED REFACTORING:**
```markdown
## Language Policy
- **USER COMMUNICATION:** Always respond to user in English only, no exceptions
- **GITHUB INTERACTIONS:** Use Russian for GitHub comments, PRs, and issues
- **CONSISTENCY:** Maintain language consistency within each communication context
```

---

## 🔧 AMBIGUOUS RULES REQUIRING CLARIFICATION

### 9. Destructive Actions Definition

**AMBIGUITY:**
The global system mentions "destructive actions" but doesn't clearly define what constitutes destructive in different contexts (git operations, file operations, process management).

**PROPOSED CLARIFICATION:**
```markdown
## Destructive Actions Definition
- **FILE OPERATIONS:** Permanent deletions, overwrites of existing files without backup
- **GIT OPERATIONS:** Force pushes, hard resets, branch deletions
- **PROCESS OPERATIONS:** Killing processes not started by Claude, system-wide process termination
- **VERSION OPERATIONS:** Version bumps (always require explicit approval)
- **NON-DESTRUCTIVE:** Staging specific files, committing tracked changes, creating new files
```

### 10. Background Agent Termination Criteria

**AMBIGUITY:**
Cross-project rules mention "clear termination criteria" for background agents but don't specify what constitutes clear criteria.

**PROPOSED CLARIFICATION:**
```markdown
## Background Agent Termination Criteria
- **TASK-BASED:** Agent completes specific assigned task
- **TIME-BASED:** Maximum execution time limit (default: 10 minutes)
- **ERROR-BASED:** Agent encounters unrecoverable error
- **USER-BASED:** User explicitly requests termination
- **DEPENDENCY-BASED:** Agent's prerequisites are no longer met
```

---

## 📋 RECOMMENDED REFACTORING APPROACH

### Phase 1: Immediate Fixes
1. **Resolve Version Bump Contradiction:** Clarify that version bumps ALWAYS require explicit user approval
2. **Standardize Output Management:** Implement zero-tolerance raw output policy with critical error exception
3. **Fix File Organization:** Use project-specific directory structure

### Phase 2: Policy Harmonization
1. **Create Destructive Actions Matrix:** Define exactly what requires confirmation vs what can be automated
2. **Establish Agent Management Rules:** Clear policies for when agents can be spawned automatically
3. **Standardize Process Management:** PID-safe commands as default, with clear escalation procedures

### Phase 3: Documentation Consistency
1. **Update Global System:** Remove conflicting rules that are overridden by higher-priority configs
2. **Enhance Project-Specific:** Add missing clarifications for ambiguous rules
3. **Cross-Reference Validation:** Ensure all three files reference the same priority system

---

## ⚠️ CRITICAL RECOMMENDATIONS

1. **IMMEDIATE ACTION REQUIRED:** Fix the version bump contradiction - this could lead to unexpected automatic version bumps
2. **USER SAFETY:** Clarify destructive actions definition to prevent accidental data loss
3. **CONSISTENCY ENFORCEMENT:** Implement validation mechanism to detect future contradictions
4. **DOCUMENTATION PRIORITY:** Always update project-specific rules first, then cascade to lower-priority configs

This analysis provides a clear roadmap for resolving configuration conflicts and establishing consistent, predictable behavior across all Claude interactions.