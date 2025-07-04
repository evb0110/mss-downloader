# CLAUDE.md

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

### 0. Commit strategy
- DO NOT USE `git add .` or similar!
- User may start several jobs in parallel, so you should track all your changes and commit and push only them. User is smart enough not to start conflicting jobs

### 1. Version Bump Automation
**AUTOMATIC BUMP REQUIRED** after any functional change:
- Bug fixes affecting app functionality
- New features or improvements 
- Library additions/fixes
- Performance improvements, error message improvements
- When user says "bump"
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

**NOT for:** Documentation, telegram bot fixes (any telegram bot changes - commit and push silently without version bump), code refactoring without behavior changes

**Process:** After validation protocol completion:
1. WAIT for mandatory user validation of PDF files
2. **CRITICAL: NEVER BUMP VERSION WITHOUT EXPLICIT USER APPROVAL**
3. Only after user explicitly approves validation: Bump patch version in package.json
4. Commit all changes with descriptive message  
5. Push to GitHub main (triggers auto-build & notifications)

**MANDATORY USER APPROVAL SYSTEM:**
- **ALWAYS REQUIRED:** User must explicitly approve before ANY version bump
- **NO AUTOMATIC BUMPS:** Never bump version automatically, regardless of keywords
- **EXPLICIT APPROVAL ONLY:** User must say "approved", "proceed", "bump version", or similar explicit confirmation
- **WAIT FOR CONFIRMATION:** Always present validation results and wait for user response before proceeding

### 2. Library Validation Protocol  
When adding/fixing libraries, **MANDATORY validation:**
1. **MANDATORY MAXIMUM RESOLUTION TESTING:** Test multiple IIIF parameters (full/full, full/max, full/2000, full/4000, etc.) to find the largest possible image resolution. Compare file sizes, dimensions, and quality. This is ABSOLUTELY CRITICAL - users must get the highest quality available.
2. Download up to 10 different manuscript pages from manifest URLs (or all available if fewer) using the HIGHEST RESOLUTION found
3. Verify each contains real manuscript/book content (not "Preview non disponibile" or likewise placeholders)
4. Confirm all pages show different manuscript content (not stuck on page 1)
5. If validation fails, apply all skills to fix; if unfixable, implement other tasks and report to user
6. Merge to PDF and test validity with poppler
7. Library validation must pass (100% success rate)
8. **MANDATORY PDF CONTENT INSPECTION BY CLAUDE:** Before presenting any PDFs to user, Claude MUST personally inspect every PDF using pdfimages + Read tools to verify:
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
   - Only after proper validation for every file, claude can present them to the user
9. **MANDATORY validation by user!!!:** Put all the pdf files with clear names in one folder and open it in finder for user to inspect. All pdfs for current inspection should be in one folder and there should be nothing else in that folder, all the old validation folders shold be deleted. Files shoulde be put BEFORE you ask user for validation
10. **WAIT FOR USER APPROVAL:** Do not proceed with version bump until user confirms validation passed

### 3. Testing Requirements
- Write comprehensive test suite for every bug fix
- Include PDF download + poppler validation
- Run tests repeatedly until consistently passing
- Use PID-safe commands: `npm run test:e2e:start`/`npm run test:e2e:kill`

### 4. File Organization
- Store all reports/analysis in `.devkit/reports/` (create if doesn't exist)
- Use `.devkit/` subfolders for all development files
- Organize reports for readability (by date/library/issue type)
- Never leave temporary files in project root

### 5. Development Context
- Main process: downloading, merging, file operations
- Renderer process: UI configuration, user interaction  
- Show minimal output - current task + small summary only
- Dev server doesn't work correctly for Claude Code
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