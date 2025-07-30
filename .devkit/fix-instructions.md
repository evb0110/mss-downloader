# Instructions for Fixing All Open Issues

## Overview
You need to fix all open issues found in `.devkit/current-issues.json`.

## Process (WORK CONSECUTIVELY - NO SUBAGENTS)
1. **Analyze Issues**: Read each issue carefully and understand the problem
2. **Implement Fixes**: Make necessary code changes to fix each issue
3. **Test Thoroughly**: Create Node.js validation scripts and PDFs for each fix
4. **Document Changes**: Keep track of what was fixed for each issue

## Important Guidelines
- **CRITICAL: DO NOT USE SUBAGENTS** - Work through all tasks consecutively
- **CRITICAL: NODE.JS TESTING ONLY** - Never run Electron for testing
- Focus on fixing the actual problems, not just symptoms
- Test with real manuscript URLs from the issues using Node.js scripts
- Ensure all fixes are backward compatible
- Create comprehensive Node.js validation for each library

## Testing Requirements
- Use SharedManifestLoaders directly in Node.js (same as Electron main process)
- Import dependencies: `const { SharedManifestLoaders } = require('./src/shared/SharedManifestLoaders.js')`
- Use pdfkit for PDF creation (same library as Electron)
- Use https module for image downloads
- Use fs.promises for file operations
- Validate with poppler using execSync('pdfinfo filename.pdf')

## CRITICAL: NO FINDER/FILE MANAGER OPENING
- **NEVER use shell.openItem, shell.openPath, shell.showItemInFolder**
- **NEVER open file manager or Finder windows**
- **NEVER use commands like `open` (macOS) or `explorer` (Windows)**
- All validation results are saved to files only
- No manual PDF inspection in autonomous workflow

## After Fixing
- Run all Node.js tests
- Create validation PDFs using Node.js scripts
- Prepare non-technical explanations for each issue
- DO NOT bump version until all fixes are confirmed working

## Use Ultra-thinking
For complex issues, use extended thinking to:
- Understand the root cause
- Plan the best solution
- Consider edge cases
- Ensure robust implementation
