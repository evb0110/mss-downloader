# CLAUDE.md

Electron manuscript downloader - Vue 3 + TypeScript UI, Node.js backend for PDF creation.

**Technologies:** Electron, Vue 3, TypeScript, SCSS, Vite, `electron-store`

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

**NOT for:** Documentation, telegram bot fixes (any telegram bot changes - commit and push silently without version bump), code refactoring without behavior changes

**Process:** IMMEDIATELY when all problems are solved (no user approval needed):
1. Bump patch version in package.json
2. Commit all changes with descriptive message  
3. Push to GitHub main (triggers auto-build & notifications)

### 2. Library Validation Protocol  
When adding/fixing libraries, **MANDATORY validation:**
1. Download up to 10 different manuscript pages from manifest URLs (or all available if fewer)
2. Verify each contains real manuscript/book content (not "Preview non disponibile")
3. Confirm all pages show different manuscript content (not stuck on page 1)
4. If validation fails, apply all skills to fix; if unfixable, implement other tasks and report to user
5. Merge to PDF and test validity with poppler

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

## TODO Management
Use global Claude Code commands:
- `/user:todo [task]` - Add todo
- `/user:handle-todos` - Handle first pending
- `/user:list-todos` - Show all pending

## References
- **Development Guide:** `.devkit/docs/development-guide.md`
- **Architecture:** `ARCHITECTURE.md`
- **Testing:** `TESTING.md`
- **Todos**: `.devkit/tasks/TODOS.md`