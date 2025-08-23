# CLAUDE.md

Electron manuscript downloader - Vue 3 + TypeScript UI, Node.js backend for PDF creation.
**Technologies:** Electron, Vue 3, TypeScript, SCSS, Vite, `electron-store`

## 🚨 ABSOLUTE MANDATORY RULES - NO EXCEPTIONS 🚨

### -1. LIBRARY ROUTING ARCHITECTURE - CRITICAL UNDERSTANDING 🏗️

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

#### 📍 CRITICAL FILES FOR ROUTING

**Detection**: `/src/shared/SharedLibraryDetector.ts`
- URL patterns → Library identifiers
- MUST match routing expectations exactly

**Routing**: `/src/main/services/EnhancedManuscriptDownloaderService.ts` (lines ~2000-2200)  
- Switch case statement routes identifiers to implementations
- MUST use correct loader registration keys

**Individual Loaders**: `/src/main/services/library-loaders/`
- Registered in LoaderRegistry with specific keys
- MUST match routing case statements

**Shared Methods**: `/src/shared/SharedManifestLoaders.ts`
- Alternative implementation for many libraries  
- Often bypassed by routing to individual loaders

#### ⚡ COMMON ROUTING FAILURES (LEARNED FROM ULTRATHINK)

1. **Saint-Omer**: Detected as `'saint_omer'`, routed to `'saint_omer'`, but registered as `'saintomer'` → FAILURE
2. **HHU**: Detected as `'hhu'`, routed to SharedManifest, but should use `HhuLoader` → FAILURE  
3. **ICCU/Monte-Cassino**: Detected as `'iccu'`, routed to `'monte_cassino'`, but registered as `'montecassino'` → FAILURE
4. **Toronto**: Detected as `'toronto'`, routed to SharedManifest, but should use `TorontoLoader` → FAILURE

#### 🛠️ ROUTING FIX METHODOLOGY

**Step 1: Identify the routing path**
```bash
# Find detection logic
grep -n "library_name" src/shared/SharedLibraryDetector.ts

# Find routing logic  
grep -n "case 'library_name'" src/main/services/EnhancedManuscriptDownloaderService.ts

# Find loader registration
grep -rn "library_name" src/main/services/library-loaders/
```

**Step 2: Check for implementation mismatch**
- Does a `LibraryLoader.ts` exist?
- Does a `getLibraryManifest()` method exist in SharedManifestLoaders?
- Which one should be used? (Usually individual loader is more comprehensive)

**Step 3: Align the identifiers**
- Detection output MUST match routing case
- Routing case MUST match loader registration key
- All three MUST use identical string identifiers

#### 🏛️ ROME LIBRARY SPECIFIC WARNING  
- **TWO IMPLEMENTATIONS EXIST:** RomeLoader.ts AND SharedManifestLoaders.getRomeManifest()
- **ROUTING COLLISION RISK:** Rome manuscripts vs ICCU catalog references both use similar identifiers
- **CRITICAL DISTINCTION:** `digitale.bnc.roma.sbn.it` (genuine Rome) vs `manus.iccu.sbn.it` (catalog)
- **SharedManifestLoaders PATH:** src/shared/SharedManifestLoaders.ts (getRomeManifest, discoverRomePageCount)
- **RomeLoader PATH:** src/main/services/library-loaders/RomeLoader.ts

### -0.5. ROUTING DEBUGGING METHODOLOGY 🔍

**BEFORE making ANY routing changes, ALWAYS:**

#### 🧪 Diagnosis Phase
```bash
# 1. Identify current routing path
echo "Testing: https://example.com/manuscript" | node -e "
const detector = require('./src/shared/SharedLibraryDetector.ts');
const input = require('fs').readFileSync(0, 'utf8').trim();
console.log('Detected:', detector.detectLibrary(input));
"

# 2. Check if loader exists
ls src/main/services/library-loaders/*Loader.ts | grep -i library_name

# 3. Check SharedManifestLoaders method
grep -n "getLibraryManifest\|library_name" src/shared/SharedManifestLoaders.ts

# 4. Verify registration
grep -rn "library_name" src/main/services/library-loaders/ | grep "register\|export"
```

#### 🎯 Testing Phase (MANDATORY before committing)
```bash
# Test individual components
bun test-routing-component.ts  # Create for specific library

# Test URL detection
bun test-url-detection.ts      # Verify detection returns expected ID

# Test loader registration  
bun test-loader-registry.ts    # Verify loader is properly registered

# Test full routing path
bun test-full-routing.ts       # End-to-end routing validation
```

#### 📝 Documentation Phase
```typescript
// ALWAYS document routing decisions in code
case 'library_name':
    // ROUTING: library_name → LibraryLoader (registered as 'library_name')
    // WHY: Individual loader has advanced features vs SharedManifest basic implementation
    // TESTED: 2024-XX-XX with manuscripts: MS123, MS456  
    manifest = await this.loadLibraryManifest('library_name', originalUrl);
    break;
```

#### 🚨 ROUTING VALIDATION CHECKLIST
- [ ] Detection output matches routing case string exactly
- [ ] Routing case matches loader registration key exactly  
- [ ] Loader exists and is properly registered
- [ ] Test with real manuscript URLs (minimum 2 different manuscripts)
- [ ] Document routing decision with reasoning
- [ ] Verify no regressions in related libraries (especially Rome/ICCU/Monte-Cassino)

#### 🛡️ ROME/ICCU/MONTE-CASSINO COLLISION PREVENTION
**NEVER change routing for these libraries without testing ALL THREE:**
- Rome: `http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/BNCR_Ms_SESS_0062`
- ICCU: `https://manus.iccu.sbn.it/cnmd/0000313047`  
- Monte-Cassino: Direct OMNES IIIF manuscripts

**These three libraries have complex interdependencies that can create cascading failures.**

#### 🎓 ULTRATHINK LESSONS LEARNED (v1.4.230-231)

**Critical Discoveries from 10 Ultrathink Agents:**
1. **60% of failures** were "Two Implementations Bug" routing issues
2. **Routing identifier mismatches** are the #1 cause of "loader not available" errors  
3. **Rome/ICCU/Monte-Cassino** form a triad with dangerous routing collision potential
4. **Individual loaders** are usually more comprehensive than SharedManifestLoaders methods
5. **URL pattern support** varies widely between implementations (IIIF vs web parsing)

**Specific Pattern Failures:**
- `'saint_omer'` → `'saintomer'` (underscore mismatch)
- `'toronto'` → SharedManifest instead of TorontoLoader  
- `'hhu'` → SharedManifest instead of HhuLoader
- `'monte_cassino'` → `'montecassino'` (underscore collision with Rome)
- `'arca'` → IIIF vs web parsing dual system routing

**Success Patterns:**
- **Individual Loader First**: Route to dedicated loaders when they exist
- **Identifier Consistency**: Keep detection → routing → registration identical
- **Fallback Strategies**: IIIF-first with web parsing fallback (IRHT model)
- **Clear Error Messages**: Distinguish between "not found" vs "routing failure"

#### 🚨 ROUTING EMERGENCY RESPONSE PROTOCOL

**If you break routing and need immediate fix:**

1. **IDENTIFY SCOPE**: Which libraries are affected?
2. **ROLLBACK STRATEGY**: Can you revert to last working state?
3. **ISOLATION**: Fix one library at a time, test independently  
4. **VALIDATION**: Test ALL interdependent libraries (Rome/ICCU/Monte-Cassino)
5. **DOCUMENTATION**: Update CLAUDE.md with new patterns discovered

**Emergency Test URLs (ALWAYS test these after routing changes):**
```bash
# Rome library (genuine Rome manuscripts)
http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1

# ICCU catalog (routes to Monte Cassino)  
https://manus.iccu.sbn.it/cnmd/0000313047

# Monte Cassino direct IIIF
# (Test with actual OMNES URLs when server accessible)

# Saint-Omer (routing identifier test)
https://bibliotheque-numerique.bibliotheque-agglo-stomer.fr/viewer/22581/

# Toronto (individual loader test)  
https://collections.library.utoronto.ca/view/fisher2:F6521

# HHU (IIIF pattern support test)
https://digital.ulb.hhu.de/i3f/v20/7674176/manifest
```

### -2. LIBRARY REQUESTS = IMMEDIATE IMPLEMENTATION - NO DEFERRALS EVER 🚀
- **WHEN USER REQUESTS LIBRARY:** Implement NOW, not "in future versions"
- **FORBIDDEN RESPONSES:** "Принято к рассмотрению", "Will be added later", "Documented for consideration"
- **REQUIRED RESPONSE:** Create loader → Test → Deploy → "✅ Implemented in v1.4.XXX"
- **TIME LIMIT:** 1-2 hours maximum from request to deployment
- **NO EXCUSES:** Complex library = still implement basic version NOW
- **USER EXPECTATION:** When they request, they expect immediate action, not promises

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

### 0.6. FILENAME DISCOVERY - NO PATTERN ASSUMPTIONS
- **NEVER ASSUME FILENAME PATTERNS:** NEVER guess "001r.jp2", "002v.jp2" or ANY filename patterns
- **DISCOVER FROM SOURCE:** Always get actual filenames from manifests, server responses, or directory listings
- **NO SEMANTIC ASSUMPTIONS:** Don't assume "recto/verso", "page1/page2", or any naming conventions
- **SERVER IS AUTHORITY:** Only the server knows what files actually exist - trust server responses only
- **MANIFEST-FIRST APPROACH:** Parse IIIF manifests, JSON responses, HTML listings, or API endpoints for real filenames
- **404 = WRONG APPROACH:** If getting 404s, you're assuming patterns instead of discovering actual files
- **EXAMPLES OF WRONG:** Generating "058r.jp2" because you expect recto/verso pairs
- **EXAMPLES OF RIGHT:** Parsing manifest JSON to get "ms_fragment_a_side1.tiff" as the actual filename

### 1. ELECTRON EXECUTION - ABSOLUTELY FORBIDDEN
- **NEVER RUN ELECTRON DIRECTLY:** Do NOT execute `electron`, `npm run dev`, `npm run dev:headless` or ANY Electron commands
- **USER RUNS THE APP:** The user will run the application themselves when needed
- **NO BACKGROUND PROCESSES:** Never start Electron processes in background or foreground
- **SINGLE INSTANCE LOCK:** Electron has single-instance lock - your processes block user's app!
- **BUILD ONLY:** You may run `npm run build` but NEVER launch the app

### 1.5. ROUTING ARCHITECTURE CHANGES - MANDATORY PROCESS 📋

**NEVER make routing changes without following this process:**

#### 📋 PRE-CHANGE CHECKLIST
```bash
# 1. Document current state
git status && git diff > /tmp/pre-routing-state.diff

# 2. Create test URLs file  
echo "# Test URLs for library_name routing change" > .devkit/testing/routing-test-urls.txt
echo "https://example.com/manuscript1" >> .devkit/testing/routing-test-urls.txt
echo "https://example.com/manuscript2" >> .devkit/testing/routing-test-urls.txt

# 3. Test current behavior
for url in $(cat .devkit/testing/routing-test-urls.txt | grep -v '#'); do
    echo "Testing: $url"
    bun test-current-routing.ts "$url"
done

# 4. Backup current routing logic
cp src/main/services/EnhancedManuscriptDownloaderService.ts \
   .devkit/backup/EnhancedManuscriptDownloaderService.pre-change.ts
```

#### ✅ POST-CHANGE VALIDATION
```bash
# 1. Build test (MUST pass)
npm run build || exit 1

# 2. Test affected library URLs
for url in $(cat .devkit/testing/routing-test-urls.txt | grep -v '#'); do
    echo "POST-CHANGE Testing: $url"
    bun test-new-routing.ts "$url" || exit 1
done

# 3. Test Rome/ICCU/Monte-Cassino triad (MANDATORY)
bun test-rome-triad.ts || exit 1

# 4. Git commit with detailed message
git add -A
git commit -m "🔧 ROUTING: library_name → NewImplementation

CHANGE: Detection 'library_name' now routes to NewLoader instead of SharedManifest
WHY: NewLoader has advanced features vs basic SharedManifest implementation  
TESTED: manuscript1, manuscript2 - both load successfully
VALIDATED: Rome/ICCU/Monte-Cassino triad unaffected

Files modified:
- EnhancedManuscriptDownloaderService.ts (routing case)
- Optional: SharedLibraryDetector.ts (if detection changed)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

#### 🔒 ROLLBACK PROCEDURE (If things break)
```bash
# 1. Immediate rollback
git checkout HEAD~1 -- src/main/services/EnhancedManuscriptDownloaderService.ts

# 2. Test rollback works  
npm run build && bun test-rome-triad.ts

# 3. Analyze what went wrong
git diff HEAD~1 HEAD src/main/services/EnhancedManuscriptDownloaderService.ts

# 4. Create detailed issue analysis
echo "ROUTING ROLLBACK ANALYSIS" > .devkit/analysis/routing-failure-$(date +%Y%m%d).md
echo "What we tried to change: ..." >> .devkit/analysis/routing-failure-$(date +%Y%m%d).md
```

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

### 6. AUTO-SPLIT CONFIGURATION - CRITICAL FOR LARGE MANUSCRIPTS
**MANDATORY: All libraries MUST be included in auto-split logic to prevent download failures**

**Location:** `src/main/services/EnhancedDownloadQueue.ts` lines 1354-1403

**When adding a new library:**
1. Add library name to `estimatedSizeLibraries` array (line 1356-1363)
2. Add page size estimation in `avgPageSizeMB` calculation (lines 1368-1403)
3. Use realistic estimates based on library's typical resolution:
   - High-res archives (Parker, Roman Archive): 2.0-2.2 MB/page
   - Major libraries (BL, LoC, Bodleian): 1.2-1.5 MB/page  
   - Standard IIIF libraries: 0.6-1.0 MB/page
   - Mobile/compressed: 0.3-0.5 MB/page

**Why this matters:**
- Without auto-split: Downloads fail for manuscripts > 300MB
- Users see: 800MB single downloads that crash (Mac) or 1.5MB incomplete files (Windows)
- With auto-split: Large manuscripts split into 30MB chunks that download reliably

**Common mistake:** Forgetting to add new libraries causes catastrophic download failures

### 7. FILE ORGANIZATION - ZERO ROOT CLUTTER
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

### 8. PRE-PUSH QUALITY GATES - NO EXCEPTIONS
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

### 9. OUTPUT DISCIPLINE - MINIMAL VERBOSITY
- **NEVER display:** Raw tool outputs, full file contents, verbose logs
- **ALWAYS summarize:** "Found X changes", "Command successful", specific errors only
- **CRITICAL errors only:** Maximum 3-5 lines when troubleshooting

### 10. TELEGRAM CHANGELOG - USER-FACING CLARITY
**MUST provide specific benefits:**
- ✅ "Added Vatican Library manuscript downloads"
- ✅ "Fixed hanging downloads for large Graz manuscripts"
- ❌ "Bug fixes and improvements"
- ❌ "Library support enhancements"

**Parse semantically:** Convert technical → user benefits

### 11. MEANINGFUL LOGGING - NO MORE USELESS MESSAGES
**MANDATORY: All logs must answer WHO/WHAT/WHERE/WHEN/WHY/HOW**

**Location:** `src/main/services/EnhancedLogger.ts`

**BAD logging (current state):**
```
[INFO] Download started
[INFO] Download completed
```

**GOOD logging (required):**
```
[QUEUE] Adding Roman Archive: Lectionarium Novum (383 pages, ~843MB, will split into 28 parts)
[MANIFEST] Roman Archive: Found 383 pages via HTML parsing in 0.4s
[DOWNLOAD] Starting Roman Archive - Part 1/28 (pages 1-14) (~30.1MB)
[PROGRESS] Roman Archive - Part 1/28: 50% (7/14 pages, 15.4MB, 1.2MB/s, ETA 6s)
[ERROR] Roman Archive - Part 2/28: SocketError after 5.2s, retrying (attempt 2/11)
[SUCCESS] Roman Archive - Part 1/28 complete: 30.1MB in 25.3s (1.2MB/s)
[COMPLETE] Roman Archive: 383 pages (841.7MB) in 12m 34s (1.1MB/s, 3 retries)
```

**Required information in logs:**
- Library name and manuscript ID
- Total pages and size
- Chunk information (current/total)
- Progress percentage and speed
- Error details with retry info
- Duration and performance metrics

**Common mistake:** Using console.log('Download started') instead of enhancedLogger

### 12. DEVELOPMENT SERVER POLICY
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
- **Playwright MCP Testing:** `.devkit/docs/playwright-mcp-testing-guide.md`
- **Telegram Bot:** `.devkit/docs/telegram-bot-workflow-documentation.md`
- **Active Todos:** `.devkit/tasks/TODOS.md`
- **Handle-Issues v4:** `.devkit/docs/handle-issues-v4-orchestrated.md`

## Core Principles
- Do what's asked - nothing more, nothing less
- NEVER create unnecessary files
- ALWAYS prefer editing over creating
- NEVER create docs unless explicitly requested