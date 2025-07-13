# Refactored CLAUDE.md Rules - Contradiction-Free Version

## 🔧 CRITICAL FIXES TO PREVENT KILLALL VIOLATIONS

### Process Management Protocol (HIGHEST PRIORITY)
```markdown
## Process Management Protocol
- **KILLALL ABSOLUTELY FORBIDDEN:** Never use `killall electron`, `killall node`, or any broad process termination commands
- **PID-SAFE ONLY:** Always use PID-safe commands like `npm run test:e2e:kill` when available
- **EXPLICIT USER PERMISSION:** ALL process termination requires explicit user request and approval
- **NO AUTOMATIC CLEANUP:** Never automatically terminate processes for "cleanup" purposes
- **DEVELOPMENT SERVERS:** Only start when explicitly requested by user
- **TESTING EXCEPTION:** Long-running test processes are allowed ONLY with proper PID management and user approval
```

### Destructive Actions Definition (CRITICAL MISSING PIECE)
```markdown
## Destructive Actions Definition
- **PROCESS OPERATIONS:** 
  - DESTRUCTIVE: `killall`, system-wide process termination, killing processes not started by Claude
  - NON-DESTRUCTIVE: Using PID-safe project commands with user approval
- **FILE OPERATIONS:** 
  - DESTRUCTIVE: Permanent deletions, overwrites without backup
  - NON-DESTRUCTIVE: Creating new files, editing specific content
- **GIT OPERATIONS:** 
  - DESTRUCTIVE: Force pushes, hard resets, `git add .`
  - NON-DESTRUCTIVE: Staging specific files, committing tracked changes
- **VERSION OPERATIONS:** 
  - DESTRUCTIVE: Version bumps (ALWAYS require explicit approval)
  - NON-DESTRUCTIVE: Preparing changes for version bump
```

## 📋 REFACTORED PROJECT-SPECIFIC RULES

### Updated Project CLAUDE.md
```markdown
# CLAUDE.md - MSS Downloader Project

## 🚨 CRITICAL PROCESS MANAGEMENT RULES
- **KILLALL BANNED:** Absolutely never use `killall electron`, `killall node`, or similar commands
- **USER APPROVAL REQUIRED:** All process management requires explicit user permission
- **PID-SAFE ONLY:** Use project commands like `npm run test:e2e:kill` exclusively
- **NO AUTOMATIC CLEANUP:** Never terminate processes for "cleanup" without user request

## Version Bump Policy (FIXED CONTRADICTION)
- **EXPLICIT APPROVAL ALWAYS:** Wait for explicit user approval before ANY version bump
- **COMMIT AUTOMATION:** Allow automatic commits for trigger words "commit", "commit-push", "push"
- **VALIDATION FIRST:** Complete all validation protocols, then wait for user approval
- **NO EXCEPTIONS:** Even with trigger words, version bumps require separate explicit approval

## Development Server Policy (CLARIFIED)
- **EXPLICIT REQUEST REQUIRED:** Never automatically start development servers
- **AVAILABLE COMMANDS:** 
  - `npm run dev` - visible window (only when user explicitly requests UI interaction)
  - `npm run dev:headless` - headless mode (only for validation when explicitly requested)
- **VALIDATION EXCEPTION:** Headless mode may be used for library validation protocols when explicitly testing

## Process Management Protocol (NEW SECTION)
- **PID-SAFE COMMANDS:** Always prefer `npm run test:e2e:start`/`npm run test:e2e:kill`
- **USER PERMISSION:** Required for all process operations
- **FORBIDDEN COMMANDS:** `killall`, `pkill`, system-wide process termination
- **TESTING SAFETY:** Even test processes require proper PID management

## Background Agents Policy (CLARIFIED)
- **DEFAULT SPAWNING:** Spawn default of 5 agents when not specified by user
- **USER CONTROL:** User can specify custom agent count
- **NO DEVELOPMENT SERVERS:** Agents cannot automatically start development servers
- **TERMINATION CRITERIA:** Clear task completion, time limits, or user request
```

### Updated Cross-Project CLAUDE.md
```markdown
# Claude User Configuration (Cross-Project Patterns)

## 🔧 Process Management Rules (CRITICAL UPDATE)
- **KILLALL PROHIBITION:** Never use `killall`, `pkill`, or broad process termination
- **EXPLICIT PERMISSION:** All process management requires user approval
- **PID-SAFE PREFERRED:** Use project-specific process management commands
- **DEVELOPMENT SERVER POLICY:** Never automatically start or maintain development servers

## Destructive Actions Protocol (NEW SECTION)
- **ALWAYS CONFIRM:** Before process termination, file deletion, git force operations
- **VERSION BUMPS:** Always require explicit user approval, no exceptions
- **AUTOMATED COMMITS:** Allowed for trigger words, but version bumps are separate actions

## Background Agents Guidelines (CLARIFIED)
- **EXPLICIT REQUEST:** Required for development servers and continuous processes
- **GENERAL TASKS:** Can be spawned automatically for analysis, search, and similar tasks
- **TERMINATION:** Must have clear completion criteria
```

### Updated Global System CLAUDE.md
```markdown
# Claude Global System Configuration

## 🔒 CRITICAL UNIVERSAL RULES (UPDATED)
- **Process Safety**: Never use broad process termination commands (`killall`, `pkill`)
- **Destructive Actions**: Always confirm before process termination, file deletion, version bumps
- **User Approval**: Required for all potentially disruptive operations
- **PID Management**: Use project-specific process management when available

## Process Management Universal Policy (NEW)
- **FORBIDDEN GLOBALLY:** `killall`, `pkill`, system-wide process termination
- **REQUIRED APPROVAL:** All process operations need explicit user permission
- **PROJECT OVERRIDE:** Defer to project-specific process management commands
- **SAFETY FIRST:** When in doubt, ask user before any process operation
```

## 🎯 IMPLEMENTATION PRIORITY

### Immediate (Phase 1)
1. **Add process management prohibition** to all three config files
2. **Fix version bump contradiction** in project config
3. **Define destructive actions** clearly

### Near-term (Phase 2)
1. **Harmonize background agent policies** across configs
2. **Standardize development server rules**
3. **Clarify termination criteria**

### Long-term (Phase 3)
1. **Create validation mechanism** to detect future contradictions
2. **Implement consistency checks** across config hierarchy
3. **Document priority resolution** clearly

## ✅ VALIDATION CHECKLIST

Before implementing these changes, verify:
- [ ] No remaining contradictions between config levels
- [ ] Clear hierarchy of rule precedence
- [ ] Explicit prohibition of broad process termination
- [ ] User approval requirements are unambiguous
- [ ] Development server policies are consistent
- [ ] Background agent rules don't conflict with process management

This refactoring ensures that the `killall electron || killall node || true` violation can never happen again by explicitly forbidding such commands and requiring user approval for all process management operations.