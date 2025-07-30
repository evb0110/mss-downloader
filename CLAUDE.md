# CLAUDE.md

## 🚨 CRITICAL LESSONS FROM v1.4.49 FAILURE - READ FIRST 🚨

**THE PROBLEM**: In v1.4.49, we claimed to fix all issues but NONE were actually fixed because:
1. Test scripts were isolated implementations, not production code
2. We tested with "known good" URLs instead of actual failing user URLs  
3. We never reproduced the user errors before claiming fixes
4. Superficial changes were made without finding root causes

**MANDATORY RULES TO PREVENT RECURRENCE**:
- **ALWAYS test with production code** - Import actual src/ files, no isolated scripts
- **ALWAYS use exact user URLs** - Copy from issues character-by-character
- **ALWAYS reproduce errors first** - See the failure before claiming a fix
- **ALWAYS fix root causes** - Debug to find WHY it fails, not just THAT it fails

---

Electron manuscript downloader - Vue 3 + TypeScript UI, Node.js backend for PDF creation.

**Technologies:** Electron, Vue 3, TypeScript, SCSS, Vite, `electron-store`

**Agents management**
- User can specify how many additional agents you can spawn, if not specified by user, spawn default of 5 agents. 
- By default they can work in parallel. 
- You should split phases of you work into parts and assign these parts to different agents. 
- You should orchestrate their work cleverly. 
- If an agent's findings are large, they can write them into files in any subfolder of `./devkit`. 
- You can spawn agents as many times as you want, just don't overcome the limit of parallel. 
- Agents have same permissions as main process.
- NB! Each agent should work silently, not bloating terminal with any output. 

## Code Quality
- **Tool Output Suppression**: NEVER display raw tool outputs. Always summarize:
  - Git diffs: "Found X changes in Y files" + specific action taken
  - Search results: "Found N matches" + direct action without showing results  
  - File contents: Only show specific lines being edited, never full files
  - Command outputs: "Command completed successfully" or specific error summary
  - Exception: Only show critical error details (max 3-5 lines) if needed for troubleshooting

## MANDATORY RULES

### 0. Process Management (CRITICAL - PREVENTS KILLALL VIOLATIONS)
- **KILLALL ABSOLUTELY FORBIDDEN:** Never use `killall electron`, `killall node`, or any broad process termination commands
- **PID-SAFE ONLY:** Always use PID-safe commands like `npm run test:e2e:kill` when available
- **EXPLICIT USER PERMISSION:** ALL process termination requires explicit user request and approval
- **NO AUTOMATIC CLEANUP:** Never automatically terminate processes for "cleanup" purposes
- **DEVELOPMENT SERVERS:** Only start when explicitly requested by user

### 1. Commit strategy
- DO NOT USE `git add .` or similar!
- User may start several jobs in parallel, so you should track all your changes and commit and push only them. User is smart enough not to start conflicting jobs
- **CRITICAL BUG**: Bash tool may fail in certain contexts. If Bash commands return errors, create a Node.js script (.cjs file) to execute git commands using `child_process.execSync()` and run it via Bash tool as fallback
- **TELEGRAM BOT DELIVERY VERIFICATION**: After every version bump, verify that GitHub Actions build succeeded and telegram bot notifications were sent to users. If build failed, immediately fix and ensure users receive the changelog.

### 2. Version Bump Automation (FIXED CONTRADICTION)
**VALIDATION TRIGGERS** for version bump consideration:
- Bug fixes affecting app functionality
- New features or improvements 
- Library additions/fixes
- Performance improvements, error message improvements
- When user says "bump"

**EXPLICIT USER APPROVAL ALWAYS REQUIRED:** Never bump version automatically, even with trigger conditions

**EXCEPTION: /handle-issues AUTONOMOUS WORKFLOW:** The `/handle-issues` command is AUTONOMOUS and does NOT require user approval for version bumps. It validates programmatically and seeks approval from GitHub issue authors instead. ALL issue comments must be in Russian.
- Telegram bot should send changelog message for every build. It should contain non-technical summary of all fixes and additions after last build: Libraries added, new url patterns for downloads etc. It should be concise, but user should understand from it all the new functionality.

### CRITICAL TELEGRAM BOT CHANGELOG REQUIREMENTS:
**MUST AVOID**: Generic descriptions like "Bug fixes and stability improvements", "New features and library support"
**MUST PROVIDE**: Specific user-facing benefits:
- "Added [Library Name] manuscript downloads"  
- "Fixed [Library Name] hanging downloads for large manuscripts"
- "Improved download progress monitoring shows real-time status"
- "Enhanced authentication handling prevents error pages"

**SEMANTIC PARSING REQUIRED**: Convert technical descriptions to user benefits:
- "Implement intelligent download progress monitoring" → "Improved download reliability with real-time progress tracking"
- "Fix University of Graz timeouts" → "Fixed University of Graz loading timeouts for large manuscripts"  
- "Add Rome BNC libroantico support" → "Added Rome BNC libroantico collection manuscript downloads"

**PATTERN ANALYSIS**: Parse commit descriptions semantically, not just pattern matching
**LIBRARY FOCUS**: Emphasize which libraries were added/fixed and what functionality improved

**VERSION BUMP BUILD FAILURE PROTOCOL**:
- If version bump commit fails due to TypeScript/lint errors, the telegram bot will NOT send notifications
- GitHub Actions only triggers builds when version changes AND build succeeds
- **CRITICAL FIX PROCESS:**
  1. Fix all TypeScript/lint errors immediately
  2. Do NOT increment version again - fix errors in same version
  3. After build succeeds, verify telegram bot sent notifications
  4. If bot still didn't send (due to no version change detected), create new version with same user-facing changelog messages
  5. **MANDATORY:** Always ensure end users receive the changelog via telegram bot

**NOT for:** Documentation, telegram bot fixes (any telegram bot changes - commit and push silently without version bump), code refactoring without behavior changes

**Process:** After validation protocol completion:
1. WAIT for mandatory user validation of PDF files
2. **CRITICAL: NEVER BUMP VERSION WITHOUT EXPLICIT USER APPROVAL**
3. Only after user explicitly approves validation: Bump patch version in package.json
4. **MANDATORY TODO CLEANUP:** Move all completed todos to `.devkit/tasks/COMPLETED.md` file
5. **MANDATORY PRE-PUSH CHECKS:** Run lint and build commands to ensure code quality
6. Commit all changes with descriptive message  
7. Push to GitHub main (triggers auto-build & notifications)
8. **MANDATORY POST-PUSH VERIFICATION:** Wait and verify that GitHub Actions build completed successfully

**MANDATORY USER APPROVAL SYSTEM:**
- **ALWAYS REQUIRED:** User must explicitly approve before ANY version bump
- **NO AUTOMATIC BUMPS:** Never bump version automatically, regardless of keywords
- **EXPLICIT APPROVAL ONLY:** User must say "approved", "proceed", "bump version", or similar explicit confirmation
- **WAIT FOR CONFIRMATION:** Always present validation results and wait for user response before proceeding

### 2. Library Validation Protocol (IF NOT IN /handle-issues command!)
When adding/fixing libraries, **IF NOT IN /handle-issues command! MANDATORY validation:**
1. **MANDATORY MAXIMUM RESOLUTION TESTING:** Test multiple IIIF parameters (full/full, full/max, full/2000, full/4000, etc.) to find the largest possible image resolution. Compare file sizes, dimensions, and quality. This is ABSOLUTELY CRITICAL - users must get the highest quality available.
2. PDFs should be created using test scripts with implemented library logic, not with devserver or actual app
3. Download 10 different manuscript pages from manifest URLs (or all available if fewer) using the HIGHEST RESOLUTION found
4. Verify each contains real manuscript/book content (not "Preview non disponibile" or likewise placeholders)
5. Confirm all pages show different manuscript content (not stuck on page 1)
6. If validation fails, apply all skills to fix; if unfixable, implement other tasks and report to user
7. Merge to PDF and test validity with poppler
8. Library validation must pass (100% success rate)
9. **MANDATORY PDF CONTENT INSPECTION BY CLAUDE:** Before presenting any PDFs to user, Claude MUST personally inspect every PDF using pdfimages + Read tools to verify:
   - **FILE SIZE CHECK:** First check file size with `ls -la` - any 0-byte files indicate complete failure
   - **PDF STRUCTURE:** Use `pdfimages -list` to verify PDF contains actual images
   - **VISUAL CONTENT:** Extract and visually inspect actual images using `pdfimages -png` + Read tool
   - Correct manuscript content (not wrong manuscripts or error pages)
   - Multiple pages when expected (not single page when multi-page required)
   - **DIFFERENT PAGES:** Each page must show DIFFERENT manuscript content - NEVER duplicate the same page multiple times
   - **CONTENT COMPARISON:** Extract and visually compare multiple pages to ensure they are genuinely different manuscripts pages
   - High resolution images (verify actual pixel dimensions using pdfimages -list)
   - No "Preview non disponibile" or authentication errors
   - Real manuscript content matching the expected library/collection
   - Claude should give rating to the result, which should be one of ["failed", "something not ok", "ok"]
   - If it is "failed", claude should iterate the same fixing process until as many times as needed
   - If it is "something not ok", it should iterate 3 more times to try and make it "ok"
   - **NEVER CREATE FAKE MULTI-PAGE PDFs:** Do not duplicate single pages to create artificial multi-page PDFs
   - **CRITICAL:** If ANY PDF is 0 bytes or fails inspection, FIX the issue before presenting to user
   - Only after proper validation for every file, claude can present them to the user
10. **MANDATORY validation by user!!!:** Create a single clean folder containing ONLY the final PDF files with clear names (no subfolders, no individual image files, no test files, no logs). Delete all previous validation folders and temporary files. The validation folder should contain exclusively the final PDF files ready for user inspection. **ONLY OPEN FINDER WHEN READY FOR FINAL USER VALIDATION** - do not open finder during development, testing, or intermediate validation steps.
11. You should only ask user's validation when all the tasks and fixes are done and all libraries and manuscripts are ready
12. **WAIT FOR USER APPROVAL:** Do not proceed with version bump until user confirms validation passed
13. After user's approval bump and push
14. Move completed todos to completed.md

### 3. Testing Requirements - CRITICAL UPDATES FROM v1.4.49 FAILURE

**🚨 MANDATORY PRODUCTION CODE TESTING 🚨**
- **NEVER CREATE ISOLATED TEST SCRIPTS** - Always import and use actual production code
- **ALWAYS USE EXACT USER URLs** - Copy character-by-character from issue reports
- **REPRODUCE ERRORS FIRST** - Must see the exact user error before claiming to fix it
- **TEST WITH PRODUCTION CODE** - Create test frameworks that use real src/ files:
  ```javascript
  // ✅ CORRECT - Uses actual production code
  const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');
  const loaders = new SharedManifestLoaders();
  
  // ❌ WRONG - Isolated test implementation
  async function testManifest() { /* custom logic */ }
  ```

**Root Cause Analysis Requirements:**
- Debug with console.log in production code to find exact failure point
- Document WHY the error occurs (e.g., "server URL changed", "SSL cert issue")
- Fix only in production source files, never in test scripts
- Validate fix with same exact user URL that was failing

**Standard Testing Requirements:**
- Write comprehensive test suite for every bug fix
- Include PDF download + poppler validation
- Run tests repeatedly until consistently passing
- Use PID-safe commands: `npm run test:e2e:start`/`npm run test:e2e:kill`

### 4. Pre-Push Quality Gates
**MANDATORY before every push:**
- Run `npm run lint` - must pass with no errors
- Run `npm run build` - must complete successfully
- **CRITICAL:** If any command fails, fix issues before proceeding with commit/push
- **POST-PUSH VERIFICATION:** Monitor GitHub Actions and verify build success
- **BUILD FAILURE PROTOCOL:** If build fails due to TypeScript/lint errors:
  1. Fix all errors immediately
  2. Commit fixes with descriptive message
  3. Push fixes to trigger new build
  4. **CRITICAL:** Ensure changelog reaches users - if version was bumped but build failed, the telegram bot won't send notifications until build succeeds

### 5. File Organization
- Store all reports/analysis in `.devkit/reports/` (create if doesn't exist)
- Use `.devkit/` subfolders for all development files
- Organize reports for readability (by date/library/issue type)
- Never leave temporary files in project root

### 6. Development Context
- Main process: downloading, merging, file operations
- Renderer process: UI configuration, user interaction  
- Show minimal output - current task + small summary only
- **Development Commands (EXPLICIT USER REQUEST REQUIRED):**
  - `npm run dev` - visible window (only when user explicitly requests UI interaction)
  - `npm run dev:headless` - headless mode (only for validation when explicitly requested)
- **DEVELOPMENT SERVER POLICY:** Never automatically start development servers without explicit user permission
- **CRITICAL**: ALWAYS test for maximum possible image resolution when implementing any library - users must get the highest quality available

## TODO Management
Use global Claude Code commands:
- `/user:todo [task]` - Add todo
- `/user:handle-todos` - Handle first pending
- `/user:list-todos` - Show all pending

## References
- **Development Guide:** `.devkit/docs/development-guide.md`
- **Architecture:** `ARCHITECTURE.md`
- **Testing:** `TESTING.md`
- **Telegram Bot Workflows:** `.devkit/docs/telegram-bot-workflow-documentation.md`
- **Todos**: `.devkit/tasks/TODOS.md`