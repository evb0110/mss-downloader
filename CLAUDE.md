# CLAUDE.md

Electron manuscript downloader - Vue 3 + TypeScript UI, Node.js backend for PDF creation.
**Technologies:** Electron, Vue 3, TypeScript, SCSS, Vite, `electron-store`

## 🚨 ABSOLUTE MANDATORY RULES - NO EXCEPTIONS 🚨

### 1. ELECTRON EXECUTION - ABSOLUTELY FORBIDDEN
- **NEVER RUN ELECTRON DIRECTLY:** Do NOT execute `electron`, `npm run dev`, `npm run dev:headless` or ANY Electron commands
- **USER RUNS THE APP:** The user will run the application themselves when needed
- **NO BACKGROUND PROCESSES:** Never start Electron processes in background or foreground
- **SINGLE INSTANCE LOCK:** Electron has single-instance lock - your processes block user's app!
- **BUILD ONLY:** You may run `npm run build` but NEVER launch the app

### 2. PROCESS TERMINATION - ZERO TOLERANCE
- **KILLALL FORBIDDEN:** NEVER use `killall electron`, `killall node`, or ANY broad process termination
- **PID-SAFE ONLY:** MUST use PID-safe commands (`npm run test:e2e:kill`)
- **USER PERMISSION REQUIRED:** ALL process termination REQUIRES explicit user approval
- **NO AUTOMATIC CLEANUP:** NEVER terminate processes for "cleanup" - EVER

### 3. PRODUCTION CODE TESTING - CRITICAL
**From v1.4.49 failure - these rules prevent false fixes:**
- **MUST test with production code** - Import actual src/ files, NO isolated scripts
- **MUST use exact user URLs** - Copy from issues character-by-character 
- **MUST reproduce errors first** - See the failure before claiming any fix
- **MUST fix root causes** - Debug to find WHY it fails, not just THAT it fails
- **MUST validate with same failing URL** - Verify fix works on original problem

**Testing Framework Requirements:**
```javascript
// ✅ MANDATORY - Uses actual production code
const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');
const loaders = new SharedManifestLoaders();

// ❌ FORBIDDEN - Isolated test implementation
async function testManifest() { /* custom logic */ }
```

### 3. VERSION CONTROL - EXPLICIT APPROVAL MANDATORY
**Version Bump Requirements:**
- **USER APPROVAL MANDATORY:** NEVER bump without explicit "approved"/"proceed"/"bump version"
- **SINGLE EXCEPTION:** `/handle-issues` command is AUTONOMOUS - bumps after all fixes complete
- **NO AUTOMATIC BUMPS:** Keywords like "bump" do NOT authorize automatic version changes

**🚨 CHANGELOG UPDATE - MANDATORY WITH EVERY VERSION BUMP 🚨**
```javascript
// package.json - MUST update when bumping version
"changelog": [
  "v{VERSION}: Brief title of changes",
  "Major fix or feature 1 description",
  "Major fix or feature 2 description",
  "UI/UX improvements if any",
  "Performance improvements if any"
]
```
- **CRITICAL:** Changelog NOT updating = Telegram sends OLD version info
- **ALWAYS:** Update to current version number
- **ALWAYS:** Replace entire array with current version's changes
- **NEVER:** Leave old version numbers in changelog

**Version Bump Triggers (still require approval):**
- Bug fixes affecting functionality
- New features or improvements
- Library additions/fixes
- Performance improvements
- When user explicitly says "bump"

**NOT Version Bump Triggers:**
- Documentation changes
- Telegram bot fixes
- Code refactoring without behavior changes

### 4. COMMIT STRATEGY - TRACK YOUR CHANGES
- **FORBIDDEN:** `git add .` or similar broad adds
- **MUST track:** ALL your specific changes for parallel work safety
- **FALLBACK:** If Bash fails, create Node.js script (.cjs) with `child_process.execSync()`
- **VERIFICATION:** After version bump, MUST verify GitHub Actions build and telegram notifications

### 5. LIBRARY VALIDATION PROTOCOL - 100% SUCCESS REQUIRED
**MANDATORY Steps (except in `/handle-issues` workflow):**
1. **MAXIMUM RESOLUTION TESTING:** Test ALL IIIF parameters (full/full, full/max, full/2000, full/4000) - users MUST get highest quality
2. Download 10 different pages using HIGHEST resolution found
3. Verify DIFFERENT manuscript content on each page (not stuck on page 1)
4. Merge to PDF and validate with poppler
5. **CLAUDE MUST INSPECT:** Before showing user, MUST verify:
   - File size with `ls -la` (0-byte = failure)
   - PDF structure with `pdfimages -list`
   - Visual content with `pdfimages -png` + Read tool
   - DIFFERENT pages (no duplicates)
   - NO "Preview non disponibile" or auth errors
   - Rate result: ["failed", "something not ok", "ok"]
6. **USER VALIDATION FOLDER:** Create SINGLE clean `.devkit/validation/READY-FOR-USER/` with ONLY final PDFs
7. **WAIT FOR USER APPROVAL** before ANY version bump

### 6. FILE ORGANIZATION - ZERO ROOT CLUTTER
**MANDATORY Structure:**
```
.devkit/
├── validation/     # PDF validation files ONLY
├── testing/        # Test scripts ONLY  
├── scripts/        # Utility scripts ONLY
├── docs/           # Documentation ONLY
├── reports/        # Generated reports ONLY
├── tasks/          # Todo management ONLY
├── orchestrator/   # Handle-issues workflow ONLY
├── commands/       # Claude command scripts ONLY
└── artifacts/      # Temporary files ONLY
```

**ABSOLUTELY FORBIDDEN in root:**
- ❌ ANY validation folders
- ❌ ANY test scripts
- ❌ ANY utility scripts (except standard build)
- ❌ ANY documentation reports
- ❌ ANY temporary files

**ANTI-ACCUMULATION RULES:**
- **LIMITS:** 200 files max, 200MB max in `.devkit/`
- **LIFECYCLE:** CREATE → USE → DELETE immediately
- **CLEANUP:** Delete after EVERY task completion
- **PWD CHECK:** If files "missing", IMMEDIATELY run `pwd` to verify location

### 7. PRE-PUSH QUALITY GATES - NO EXCEPTIONS
**MUST run before EVERY push:**
1. `npm run lint` - MUST pass with zero errors
2. `npm run build` - MUST complete successfully
3. Fix ALL errors before commit/push
4. Verify GitHub Actions build success
5. If build fails: fix, commit, push fixes, verify telegram notifications sent

### 8. OUTPUT DISCIPLINE - MINIMAL VERBOSITY
- **NEVER display:** Raw tool outputs, full file contents, verbose logs
- **ALWAYS summarize:** "Found X changes", "Command successful", specific errors only
- **CRITICAL errors only:** Maximum 3-5 lines when troubleshooting

### 9. TELEGRAM CHANGELOG - USER-FACING CLARITY
**MUST provide specific benefits:**
- ✅ "Added Vatican Library manuscript downloads"
- ✅ "Fixed hanging downloads for large Graz manuscripts"
- ❌ "Bug fixes and improvements"
- ❌ "Library support enhancements"

**Parse semantically:** Convert technical → user benefits

### 10. DEVELOPMENT SERVER POLICY
- **NEVER start automatically** - requires explicit user request
- `npm run dev` - ONLY when user requests UI
- `npm run dev:headless` - ONLY for explicit validation

## 🎭 Handle-Issues Command v4.0 - Orchestrated Sequential Resolution

The `/handle-issues` command uses **Orchestrated Sequential Ultra-Resolution**.

### How Claude Should Respond to /handle-issues

When the user runs `/handle-issues`, Claude should:

1. **Check for ORCHESTRATED_MODE signal**
   - If present: Use sequential processing
   - If absent: Fall back to old parallel mode

2. **Process Issues SEQUENTIALLY**
   ```
   For each issue:
   - Create dedicated workspace
   - Think DEEPLY about root cause
   - Implement ROBUST solution
   - Validate EXHAUSTIVELY
   - Document changes
   ```

3. **NO PARALLELIZATION**
   - One issue at a time
   - Full attention to each
   - No rushing

4. **Consolidated Release**
   - After ALL issues fixed
   - Single version bump
   - Comprehensive changelog

### Expected Todos Structure
```
☐ Orchestrated Issue Resolution
  ☐ Analyze Issue #X
    ☐ Understand root cause
    ☐ Design solution
    ☐ Implement fix
    ☐ Validate thoroughly
  ☐ Analyze Issue #Y
    ☐ Understand root cause
    ☐ Design solution
    ☐ Implement fix
    ☐ Validate thoroughly
  ☐ Consolidated Release
    ☐ Combine all fixes
    ☐ Create changelog
    ☐ Bump version
    ☐ Push to main
```

### Files and Paths
- **Command Script**: `.devkit/commands/handle-issues.sh`
- **Orchestrator**: `.devkit/scripts/orchestrated-issue-resolver.cjs`
- **Issue Analyzer**: `.devkit/scripts/enhanced-issue-analyzer.cjs`
- **Reports**: `.devkit/orchestrator/fix-report.json`
- **Agent Workspaces**: `.devkit/orchestrator/agent-{issue-number}/`

### Key Principles
- **Quality Over Speed**: No time limits
- **Sequential Processing**: No conflicts
- **Deep Thinking**: Understand root causes
- **Exhaustive Validation**: 100% confidence
- **Single Release**: User-friendly

## Agent Management (Legacy - for other workflows)
- Default: 5 parallel agents (user can specify)
- Split work into phases for different agents
- Agents write large findings to `.devkit/` subfolders
- Each agent works silently - no terminal output

## TODO Management Commands
- `/user:todo [task]` - Add todo
- `/user:handle-todos` - Handle first pending  
- `/user:list-todos` - Show all pending
- Completed todos → `.devkit/tasks/COMPLETED.md`

## References
- **Development:** `.devkit/docs/development-guide.md`
- **Architecture:** `ARCHITECTURE.md`
- **Testing:** `TESTING.md`
- **Telegram Bot:** `.devkit/docs/telegram-bot-workflow-documentation.md`
- **Active Todos:** `.devkit/tasks/TODOS.md`
- **Handle-Issues v4:** `.devkit/docs/handle-issues-v4-orchestrated.md`

## Core Principles
- Do what's asked - nothing more, nothing less
- NEVER create unnecessary files
- ALWAYS prefer editing over creating
- NEVER create docs unless explicitly requested