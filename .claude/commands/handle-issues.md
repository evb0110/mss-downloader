# Handle All GitHub Issues

You need to systematically fix all open GitHub issues for the mss-downloader project.

## Process:

1. **Fetch all open issues** from GitHub
2. **Create a comprehensive TODO list** from the issues
3. **Work on fixes systematically** using agents as needed
4. **Test all fixes** with validation scripts
5. **Bump version** after all fixes are validated
6. **Add non-technical explanations** to each issue in Russian

## Steps to execute:

First, run the issue handling setup:
```bash
.devkit/tools/handle-issues
```

Then, for each issue:
1. Analyze the error and identify root cause
2. Implement the fix in the appropriate library handler
3. Create a test script to validate the fix
4. Save a non-technical explanation to `.devkit/fixes/issue_N_fix.txt`

After all fixes are complete:
1. Run validation for all fixes
2. Create validation PDFs as needed
3. Get user approval for version bump
4. Update package.json version and changelog
5. Commit with descriptive message
6. Push to trigger GitHub Actions build
7. Run post-fix actions to notify users:
```bash
.devkit/tools/post-fix-actions.sh
```

## Important Guidelines:
- Use 3-5 agents in parallel for different aspects
- Focus on fixing root causes, not symptoms
- Test with real manuscript URLs from issues
- Create user-friendly Russian explanations
- Ensure all fixes are backward compatible
- Wait for user confirmation before closing issues

## Issue Format:
Each issue typically contains:
- Error message
- Manuscript URL that failed
- Log files (if attached)
- User comments in Russian

## Fix Description Template:
```
Проблема с [библиотека] была исправлена.

[Описание что было сделано на понятном языке]

Теперь вы можете [что пользователь может делать].
```

Remember: The goal is to fix ALL open issues efficiently and communicate clearly with users about what was fixed.