# CLAUDE.md

Electron manuscript downloader - Vue 3 + TypeScript UI, Node.js backend for PDF creation.
**Technologies:** Electron, Vue 3, TypeScript, SCSS, Vite, `electron-store`

## 🚨 ABSOLUTE MANDATORY RULES - NO EXCEPTIONS 🚨

### Command Priority Hierarchy - User Commands Override All Defaults 👑

**🚨 CATASTROPHIC LESSON LEARNED: User commands ALWAYS override default restrictions 🚨**

#### 📢 ABSOLUTE COMMAND PRIORITY ORDER
```
1. EXPLICIT USER COMMANDS (highest priority)
2. SAFETY GATE FAILURES (precommit/build errors) 
3. DEFAULT AUTOMATION RULES
4. OPTIMIZATION PREFERENCES (lowest priority)
```

#### 🔥 CRITICAL COMMAND OVERRIDES
**"bump all" Command:**
- OVERRIDES: "FORBIDDEN: git add ." restriction
- REQUIRES: `git add -A` to stage ALL files including untracked
- MANDATORY: Include untracked files even if normally prohibited
- **Pattern Recognition**: User frustration = missed command priority

**"bump once more" / "don't you understand" Signals:**
- USER IS TELLING YOU TO VERSION BUMP
- Context: Previous build failed = need new version bump
- NEVER ask "should I bump?" - just do it immediately
- Pattern: Build failure + user prompt = emergency bump protocol

**Emergency User Direction:**
- User says "this is critical!!!!" = IMMEDIATE STOP current approach
- User corrects approach = abandon current method immediately  
- User frustration signals = you missed something obvious

### Precommit Zero Tolerance - Absolutely Bulletproof 🛡️⚡

**🚨 CATASTROPHIC LESSON LEARNED: NEVER bypass precommit failures 🚨**

#### 🛑 PRECOMMIT FAILURE = IMMEDIATE FULL STOP
```
🚨 IF npm run precommit FAILS:
   ❌ STOP all version bump activity IMMEDIATELY
   ❌ NO "build passes anyway" logic EVER
   ❌ NO "types don't matter" reasoning EVER
   ✅ FIX type errors FIRST before ANY commit
   ✅ Use npm run typefix + npm run typecheck
   ✅ Only proceed after precommit passes 100%
```

**See detailed protocol:** [.devkit/docs/precommit-enforcement.md](.devkit/docs/precommit-enforcement.md)

### Code Preservation Hierarchy - Protect Working Code 🏗️🛡️

**🚨 CATASTROPHIC LESSON LEARNED: Preserve working runtime code, adapt types 🚨**

#### 🎯 CHANGE RISK ASSESSMENT HIERARCHY
```
1. TYPE ADJUSTMENTS (lowest risk)
   - Make types more flexible/permissive
   - Add type assertions or any casts
   - Update interface definitions

2. IMPORT/EXPORT CHANGES (low risk)
   - Add missing exports
   - Update import paths  
   - Adjust module references

3. RUNTIME LOGIC CHANGES (high risk)
   - Modify function behavior
   - Change control flow
   - Alter data processing

4. CORE ALGORITHM CHANGES (highest risk)
   - Change download logic
   - Modify manifest processing
   - Alter queue management
```

#### 🏛️ CODE PRESERVATION PRINCIPLES
1. **Working Code is Sacred**: If it works in production, don't change runtime behavior
2. **Types Serve Code**: Make types match reality, not force code to match types  
3. **Risk Assessment**: Always choose lower-risk solution
4. **User Direction Priority**: When user says "don't change runtime code" - obey immediately

### Library Routing Architecture - Critical Understanding 🏗️

**THE #1 CAUSE OF CRITICAL FAILURES:** "Two Implementations Bug" - 60% of critical failures are routing issues

#### 🚨 ROUTING COLLISION PATTERNS (MUST UNDERSTAND)

**Pattern 1: Two Implementations Exist**
Many libraries have BOTH a dedicated loader AND a SharedManifestLoaders method:
- `LibraryLoader.ts` in `/src/main/services/library-loaders/`  
- `getLibraryManifest()` in `/src/shared/SharedManifestLoaders.ts`

**Pattern 2: Registration vs Routing Mismatch**  
Library registered with key `'libraryname'` but routed to `'library_name'` (or vice versa)

**Pattern 3: URL Detection vs Routing Mismatch**
URL detection returns `'detected_name'` but routing expects `'registered_name'`

#### 🔍 ROUTING FLOW ARCHITECTURE
```
1. URL INPUT → SharedLibraryDetector.detectLibrary()
2. DETECTION → Returns library identifier (e.g., 'saint_omer')  
3. ROUTING → EnhancedManuscriptDownloaderService.loadManifest()
4. SWITCH CASE → Routes to loader based on identifier
5. LOADER CALL → Either loadLibraryManifest() OR sharedManifestAdapter.getManifestForLibrary()
```

**See detailed routing methodology:** [.devkit/docs/routing-methodology.md](.devkit/docs/routing-methodology.md)

### 🛑 ZERO PATTERN ASSUMPTIONS RULE - TOP PRIORITY 🛑

**🚨 FUNDAMENTAL PROHIBITION: NEVER ASSUME PATTERNS - ALWAYS DISCOVER FROM SOURCE 🚨**

This is the **#1 CAUSE OF 404 ERRORS AND BROKEN DOWNLOADS**. Pattern assumptions have caused critical failures in:
- Lindau Gospels (fake ZIF patterns)
- Multiple library implementations
- User download breakages

**IMMEDIATE VIOLATION CHECK:**
- Are you generating URLs with patterns like `page-{num}`, `{id}-{suffix}`, `{base}_{index}`?
- Are you assuming filename structures without fetching real data?
- Are you using template substitution instead of individual page discovery?

**IF YES TO ANY → STOP IMMEDIATELY → USE INDIVIDUAL DISCOVERY ONLY**

**See comprehensive rules:** [Section: ZERO PATTERN ASSUMPTIONS](#zero-pattern-assumptions)

## CORE OPERATIONAL RULES

### Library Requests = Immediate Implementation - No Deferrals Ever 🚀
- **WHEN USER REQUESTS LIBRARY:** Implement NOW, not "in future versions"
- **FORBIDDEN RESPONSES:** "Принято к рассмотрению", "Will be added later", "Documented for consideration"
- **REQUIRED RESPONSE:** Create loader → Test → Deploy → "✅ Implemented in v1.4.XXX"
- **TIME LIMIT:** 1-2 hours maximum from request to deployment
- **USER EXPECTATION:** When they request, they expect immediate action, not promises

### No Artificial Limits or Caps - Ever
- **NEVER SET PAGE CAPS:** Do NOT limit pages to 256, 512, 1024 or ANY number
- **DYNAMIC DISCOVERY ONLY:** Always discover actual page count through proper detection
- **USER CONTROLS LIMITS:** Only users can set page ranges, never impose artificial restrictions

### Cache Purge on Deletion - Absolutely Mandatory
- **ALWAYS CLEAR CACHE:** When ANY manuscript is deleted, its cache MUST be cleared
- **100% COVERAGE REQUIRED:** clearCompleted, clearFailed, clearAll, removeManuscript - ALL must clear cache

### 🚨 ZERO PATTERN ASSUMPTIONS - DISCOVER ALL DATA FROM SOURCE 🚨

**🛑 ABSOLUTE PROHIBITION: NEVER ASSUME, GUESS, OR GENERATE ANY PATTERNS 🛑**

#### 🚨 CATASTROPHIC LESSON LEARNED: Pattern assumptions cause 404 failures and broken downloads 🚨

**FORBIDDEN ACTIVITIES - ZERO TOLERANCE:**
- ❌ **NEVER ASSUME FILENAME PATTERNS:** Do NOT guess "001r.jp2", "002v.jp2", "page-0004.zif" or ANY filename patterns
- ❌ **NEVER GENERATE URL PATTERNS:** Do NOT create "fake" URLs based on assumptions about naming conventions
- ❌ **NEVER EXTRAPOLATE PATTERNS:** Do NOT use "sample-based inference" to generate URLs for remaining pages
- ❌ **NEVER USE TEMPLATE SUBSTITUTION:** Do NOT create URL templates like `{baseId}_page-{num}.zif`

**MANDATORY APPROACHES - ONLY SOURCE OF TRUTH:**
- ✅ **DISCOVER FROM MANIFESTS:** Get actual filenames from IIIF manifests, JSON APIs, XML responses
- ✅ **DISCOVER FROM HTML PARSING:** Extract actual URLs from individual page HTML content  
- ✅ **DISCOVER FROM DIRECTORY LISTINGS:** Use server-provided file listings when available
- ✅ **DISCOVER FROM API RESPONSES:** Use actual data returned by library APIs and services

**CRITICAL VALIDATION RULES:**
- 🚨 **404 = PATTERN ASSUMPTION:** If getting 404s, you are assuming patterns instead of discovering actual files
- 🚨 **ALWAYS VERIFY URLS:** Every generated URL must be validated against actual source data
- 🚨 **NO BULK GENERATION:** Never generate multiple URLs without individual validation per URL
- 🚨 **FETCH REAL DATA:** For each page/image, fetch the actual page/manifest to discover real URLs

#### 📋 DISCOVERY METHODOLOGY (MANDATORY WORKFLOW)
```
1. INITIAL DISCOVERY → Parse manifest/API for available pages
2. INDIVIDUAL PAGE FETCH → For each page, fetch actual HTML/JSON  
3. URL EXTRACTION → Extract real image/ZIF URLs from each page
4. VALIDATION → Verify each URL exists before including in manifest
5. NO PATTERN SHORTCUTS → Every URL must be individually discovered
```

**VIOLATION CONSEQUENCES:**
- Immediate 404 failures breaking user downloads
- Incomplete manuscripts with missing pages  
- User frustration and broken functionality
- Violation of core "real data only" principle

### Electron Execution - Absolutely Forbidden
- **NEVER RUN ELECTRON DIRECTLY:** Do NOT execute `electron`, `npm run dev`, `npm run dev:headless` or ANY Electron commands
- **USER RUNS THE APP:** The user will run the application themselves when needed
- **SINGLE INSTANCE LOCK:** Electron has single-instance lock - your processes block user's app!

### Process Termination - Zero Tolerance
- **KILLALL FORBIDDEN:** NEVER use `killall electron`, `killall node`, or ANY broad process termination
- **USER PERMISSION REQUIRED:** ALL process termination REQUIRES explicit user approval

## VERSION CONTROL - BULLETPROOF WORKFLOW

### User Command Recognition (Learned from Disasters)
**Version Bump Triggers (execute immediately):**
- **"bump"** - Standard version bump with tracked files only
- **"bump all"** - Comprehensive bump with ALL files (git add -A)
- **"bump once more"** - Emergency bump, usually after build failures
- **"don't you understand you need to bump once more??"** - USER IS FRUSTRATED, missed obvious direction
- **"approved"** - Permission to execute full workflow

### File Inclusion Rules - Catastrophic Failures Prevention
**"bump" vs "bump all" ABSOLUTE Distinction:**
- **"bump"**: Only staged/modified tracked files (`git add -u`)
- **"bump all"**: ALL files including untracked (`git add -A`) 
  - **OVERRIDES**: "FORBIDDEN: git add ." default restriction
  - **PRIORITY**: User explicit command > default automation rules

### Complete Version Bump Workflow (MANDATORY):
1. **FILE STAGING**: `git add -A` if "bump all", `git add -u` if just "bump"
2. **QUALITY GATES**: `npm run precommit` with ALL files staged
3. **BUILD VERIFICATION**: `npm run build` with ALL files staged
4. Update package.json version number
5. Update changelog with clear user benefits
6. Commit with descriptive message (include untracked files list)
7. **Push to GitHub immediately**
8. Monitor `gh run list` for build status
9. Verify Telegram notification sent

**See build failure protocols:** [.devkit/docs/build-failure-protocols.md](.devkit/docs/build-failure-protocols.md)

## QUALITY ASSURANCE

### Library Validation Protocol
**MANDATORY Steps (except in `/handle-issues` workflow):**
1. **MAXIMUM RESOLUTION TESTING:** Test ALL IIIF parameters - users MUST get highest quality
2. Download 10 different pages using HIGHEST resolution found
3. **CLAUDE MUST INSPECT:** File size, PDF structure, visual content verification
4. **USER VALIDATION FOLDER:** Create `.devkit/validation/READY-FOR-USER/` with ONLY final PDFs

**See complete protocol:** [.devkit/docs/library-validation-protocol.md](.devkit/docs/library-validation-protocol.md)

### Deep Issue Analysis - Critical Lessons from v1.4.192
**CRITICAL PRINCIPLE: If users report problems after fixes, PROBLEMS EXIST**

**MANDATORY Multi-Layer Validation:**
1. **Manifest Loading Test** - Basic functionality 
2. **Download Processing Test** - Full user workflow simulation
3. **Production Environment Test** - Electron-specific issues
4. **User Experience Test** - Complete end-to-end validation

**ULTRATHINK AGENT DEPLOYMENT RULES:**
- **ALWAYS deploy when user reports problems after "fixes"**
- **NEVER trust superficial testing** - dig into actual user experience
- **FOCUS on complete user workflow** - manifest → download → completion

### File Organization - Zero Root Clutter
**MANDATORY Structure:**
```
.devkit/
├── validation/     # PDF validation files ONLY
├── testing/        # Test scripts ONLY  
├── scripts/        # Utility scripts ONLY
├── docs/           # Documentation ONLY
├── reports/        # Generated reports ONLY
├── tasks/          # Todo management ONLY
└── artifacts/      # Temporary files ONLY
```

**ANTI-ACCUMULATION RULES:**
- **LIMITS:** 200 files max, 200MB max in `.devkit/`
- **LIFECYCLE:** CREATE → USE → DELETE immediately

### Output Discipline - Minimal Verbosity
- **NEVER display:** Raw tool outputs, full file contents, verbose logs
- **ALWAYS summarize:** "Found X changes", "Command successful", specific errors only
- **CRITICAL errors only:** Maximum 3-5 lines when troubleshooting

### Meaningful Logging
**MANDATORY: All logs must answer WHO/WHAT/WHERE/WHEN/WHY/HOW**

**See logging methodology:** [.devkit/docs/logging-methodology.md](.devkit/docs/logging-methodology.md)

## HANDLE-ISSUES COMMAND v5.0

The `/handle-issues` command uses **Multi-Layer Validation with Ultrathink Agents** based on lessons from v1.4.192.

**Key Principles:**
- **User Reports = Truth**: If users report problems after fixes, problems exist
- **Multi-Layer Testing**: Manifest → Download → Production → User Experience  
- **Ultrathink When Needed**: Deploy agents for persistent issues
- **Real Fixes Only**: Version bump only when genuine code fixes exist

**Files and Paths:**
- **Command Script**: `.devkit/commands/handle-issues.sh`
- **Orchestrator**: `.devkit/scripts/orchestrated-issue-resolver.cjs`
- **Reports**: `.devkit/orchestrator/fix-report.json`

## TODO MANAGEMENT COMMANDS
- `/user:todo [task]` - Add todo
- `/user:handle-todos` - Handle first pending  
- `/user:list-todos` - Show all pending
- Completed todos → `.devkit/tasks/COMPLETED.md`

## REFERENCES
- **Development:** `.devkit/docs/development-guide.md`
- **Architecture:** `ARCHITECTURE.md`
- **Testing:** `TESTING.md`
- **Playwright MCP Testing:** `.devkit/docs/playwright-mcp-testing-guide.md`
- **Telegram Bot:** `.devkit/docs/telegram-bot-workflow-documentation.md`
- **Active Todos:** `.devkit/tasks/TODOS.md`
- **Routing Methodology:** `.devkit/docs/routing-methodology.md`
- **Build Failure Protocols:** `.devkit/docs/build-failure-protocols.md`
- **Library Validation:** `.devkit/docs/library-validation-protocol.md`
- **Logging Methodology:** `.devkit/docs/logging-methodology.md`
- **Precommit Enforcement:** `.devkit/docs/precommit-enforcement.md`

## CORE PRINCIPLES
- Do what's asked - nothing more, nothing less
- NEVER create unnecessary files
- ALWAYS prefer editing over creating
- NEVER create docs unless explicitly requested