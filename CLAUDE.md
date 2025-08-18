# CLAUDE.md

Electron manuscript downloader - Vue 3 + TypeScript UI, Node.js backend for PDF creation.
**Technologies:** Electron, Vue 3, TypeScript, SCSS, Vite, `electron-store`

## 🚨 ABSOLUTE MANDATORY RULES - NO EXCEPTIONS 🚨

### -1. TWO ROME LIBRARIES - CRITICAL WARNING
- **TWO IMPLEMENTATIONS EXIST:** RomeLoader.ts AND SharedManifestLoaders.getRomeManifest()
- **ONLY SharedManifestLoaders IS USED:** Due to routing in EnhancedManuscriptDownloaderService line 2071
- **RomeLoader.ts IS NEVER CALLED:** Despite being registered, it's bypassed entirely
- **FIX BOTH IF UNSURE:** When fixing Rome issues, check BOTH implementations
- **SharedManifestLoaders PATH:** src/shared/SharedManifestLoaders.ts (getRomeManifest, discoverRomePageCount)
- **RomeLoader PATH:** src/main/services/library-loaders/RomeLoader.ts (NOT USED but exists)
- **ROUTING BUG:** EnhancedManuscriptDownloaderService sends Rome directly to SharedManifestAdapter

### 0. NO ARTIFICIAL LIMITS OR CAPS - EVER
- **NEVER SET PAGE CAPS:** Do NOT limit pages to 256, 512, 1024 or ANY number
- **NEVER HARDCODE LIMITS:** No manuscript is "too large" - users decide what to download
- **DYNAMIC DISCOVERY ONLY:** Always discover actual page count through proper detection
- **FIX ROOT CAUSES:** If getting wrong page counts, fix the detection logic, don't cap results
- **NO ASSUMPTIONS:** Don't assume "most manuscripts are < X pages" - detect actual count
- **USER CONTROLS LIMITS:** Only users can set page ranges, never impose artificial restrictions

### 0.5. CACHE PURGE ON DELETION - ABSOLUTELY MANDATORY
- **ALWAYS CLEAR CACHE:** When ANY manuscript is deleted, its cache MUST be cleared
- **100% COVERAGE REQUIRED:** clearCompleted, clearFailed, clearAll, removeManuscript - ALL must clear cache
- **NO EXCEPTIONS:** Every library, every deletion method, every scenario - cache MUST be purged
- **PREVENTS DATA CORRUPTION:** Old/wrong cached data causes "unfixable" manuscript issues
- **SILENT BUG KILLER:** Missing cache clear = users stuck with corrupted data forever
- **CRITICAL FOR USER EXPERIENCE:** Without cache purge, deleted manuscripts retain bad data

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

### 3. DEEP ISSUE ANALYSIS - CRITICAL LESSONS FROM v1.4.192
**CRITICAL PRINCIPLE: If users report problems after fixes, PROBLEMS EXIST**

**The v1.4.192 Discovery:**
My initial testing only verified manifest loading, missing the real bugs in download processing. Users continued reporting infinite loops because:
- Issue #29: Download queue success detection was broken (object vs string return)
- Issue #4: Morgan library had ReferenceError in Electron production environment

**MANDATORY Multi-Layer Validation:**
1. **Manifest Loading Test** - Basic functionality 
2. **Download Processing Test** - Full user workflow simulation
3. **Production Environment Test** - Electron-specific issues
4. **User Experience Test** - Complete end-to-end validation

**Testing Framework Requirements - ULTRATHINK AGENTS:**
```typescript
// ✅ MANDATORY - Multi-layer approach
1. Basic production code test (manifest loading)
2. Deploy ultrathink agents for DEEP analysis if user reports persist
3. Test actual user workflow, not just individual components
4. Validate in production-like Electron environment
```

**ULTRATHINK AGENT DEPLOYMENT RULES:**
- **ALWAYS deploy when user reports problems after "fixes"**
- **NEVER trust superficial testing** - dig into actual user experience
- **FOCUS on complete user workflow** - manifest → download → completion
- **ANALYZE production logs** and user-provided error traces

**BUN DEVELOPMENT RULE - ENHANCED:**
- **ALWAYS use Bun** for TypeScript testing
- **COMMAND:** `bun filename.ts` to run TypeScript directly  
- **LIMITATION:** Bun tests don't reveal Electron environment issues
- **SOLUTION:** Use ultrathink agents for production environment analysis

### 4. VERSION CONTROL - COMPLETE WORKFLOW MANDATORY
**Version Bump Requirements:**
- **USER APPROVAL:** When user says "bump", "bump version", "release", or "approved" → Execute FULL workflow
- **FULL WORKFLOW MANDATORY:** Version bump → Commit → Push → Verify GitHub Actions → Check Telegram
- **NEVER bump without pushing:** Phantom versions break the workflow and confuse everyone
- **SINGLE EXCEPTION:** User explicitly says "bump locally" or "don't push yet" 
- **AUTONOMOUS:** `/handle-issues` command handles everything automatically

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

**Version Bump Triggers (execute immediately when user approves):**
- Bug fixes affecting functionality
- New features or improvements
- Library additions/fixes
- Performance improvements
- When user explicitly says "bump", "release", or "approved"

**Complete Version Bump Workflow (MANDATORY):**
1. Update package.json version number
2. Update changelog with clear user benefits
3. Run `npm run precommit` for type safety
4. Commit with descriptive message
5. **Push to GitHub immediately**
6. Monitor `gh run list` for build status
7. Verify Telegram notification sent
8. Report success/failure to user

**NOT Version Bump Triggers:**
- Documentation changes (unless requested)
- Telegram bot fixes
- Code refactoring without behavior changes

### 4. COMMIT & PUSH STRATEGY - COMPLETE THE WORKFLOW
- **FORBIDDEN:** `git add .` or similar broad adds
- **MUST track:** ALL your specific changes for parallel work safety
- **WORKFLOW:** After version bump → Commit → Push immediately → Verify build
- **VERIFICATION:** Monitor GitHub Actions (gh run list) and confirm Telegram sent
- **FALLBACK:** If Bash fails, create Node.js script (.cjs) with `child_process.execSync()`

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
7. **VERSION BUMP:** User saying "bump" or "approved" IS the approval - execute full workflow immediately

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
**MUST run before EVERY commit:**
1. `npm run precommit` - Type safety check (MANDATORY)
2. `npm run lint` - MUST pass with zero errors
3. `npm run build` - MUST complete successfully (includes type checking)

**Type Safety Requirements (NEW):**
- **NEVER commit with type errors** - Causes runtime failures like `loadVatlibManifest is not a function`
- **Run `npm run precommit` BEFORE EVERY commit** - Catches method reference errors
- **If type errors exist:** Run `npm run typefix` for auto-fix, then verify with `npm run typecheck`
- **Build now includes type checking** - Will fail if types are wrong

**After push:**
1. Verify GitHub Actions build success
2. Check telegram notifications sent
3. If build fails: fix, commit, push fixes

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

## 🎭 Handle-Issues Command v5.0 - Layered Validation with Ultrathink

The `/handle-issues` command now uses **Multi-Layer Validation with Ultrathink Agents** based on lessons from v1.4.192.

### How Claude Should Respond to /handle-issues

**PHASE 1: Initial Assessment**
1. **Fetch ALL open issues** comprehensively
2. **Basic production code testing** (manifest loading verification)
3. **Create issue status report** - preliminary analysis

**PHASE 2: User Persistence Check** 
```
IF users report problems AFTER claimed fixes:
  → DEPLOY ULTRATHINK AGENTS immediately
  → NEVER argue "it should work"
  → DIG DEEPER into actual user workflow
ELSE:
  → Standard notification process
```

**PHASE 3: Ultrathink Deep Analysis**
For each persistent issue:
- **Agent Mission**: Find exact root cause in full user workflow
- **Focus Areas**: Download processing, IPC communication, production environment
- **Required Output**: Specific code fixes with exact line numbers
- **Validation**: Must reproduce user's exact problem first

**PHASE 4: Real Fixes Implementation**
- Apply ultrathink agent discoveries  
- Test complete user workflow (not just components)
- Version bump ONLY when real fixes exist
- Update users with technical details of actual fixes

### Expected Todos Structure v5.0
```
☐ Multi-Layer Issue Resolution
  ☐ Phase 1: Initial Assessment  
    ☐ Fetch all open issues
    ☐ Basic production testing (manifest loading)
    ☐ Create preliminary status report
  ☐ Phase 2: Check for User Persistence
    ☐ Analyze comment history for post-fix complaints
    ☐ Identify issues requiring ultrathink analysis
  ☐ Phase 3: Ultrathink Deep Analysis (if needed)
    ☐ Deploy agent for Issue #X - complete workflow analysis
    ☐ Deploy agent for Issue #Y - production environment focus  
    ☐ Deploy agent for Issue #Z - IPC/Electron specific analysis
  ☐ Phase 4: Real Fixes Implementation
    ☐ Apply ultrathink discoveries with exact code locations
    ☐ Test complete user workflow (not just components)
    ☐ Version bump with genuine fixes
    ☐ Update users with technical details
```

### Files and Paths
- **Command Script**: `.devkit/commands/handle-issues.sh`
- **Orchestrator**: `.devkit/scripts/orchestrated-issue-resolver.cjs`
- **Issue Analyzer**: `.devkit/scripts/enhanced-issue-analyzer.cjs`
- **Reports**: `.devkit/orchestrator/fix-report.json`
- **Agent Workspaces**: `.devkit/orchestrator/agent-{issue-number}/`

### Key Principles v5.0 - Lessons from v1.4.192
- **User Reports = Truth**: If users report problems after fixes, problems exist
- **Multi-Layer Testing**: Manifest → Download → Production → User Experience  
- **Ultrathink When Needed**: Deploy agents for persistent issues
- **Real Fixes Only**: Version bump only when genuine code fixes exist
- **Complete Workflow Focus**: Test full user experience, not just components
- **Production Environment**: Consider Electron/Windows specific issues
- **Technical Transparency**: Update users with exact technical details of fixes

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