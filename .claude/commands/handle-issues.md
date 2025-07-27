# Handle All GitHub Issues

You need to systematically fix all open GitHub issues for the mss-downloader project.

## General:
**TOP PRIORITY**: This is the most important task. You should fix all the bugs, this is not negotiable. We cannot risk.
**TOP PRIORITY**: You should ensure that you don't break anything while fixing these issues. The fixes should be backward compatible.
**Resources** You can use up to 3-5 agents in parallel for different aspects of the same issue, but not for multiple issues at once. You should use ultrathink and ultrathinking agents.


## Process:

1. **Fetch all open issues** from GitHub
2. **Create a comprehensive TODO list** from the issues
3. **Work on fixes systematically** using agents as needed
4. **Don't do them simultaneously** to avoid conflicts
5. **You can use up to 3-5 agents** in parallel for one issue, but not for multiple issues at once
6. **Test all fixes** with validation scripts, but don't start dev server, only the node scripts
7. **Bump version** after all fixes are validated
8. **Add non-technical explanations** in comments to each issue in Russian. They shouldn't be the same for all issues, but should explain what was fixed in simple terms for each issue

## Steps to execute:

First, run the issue handling setup:
```bash
.devkit/tools/handle-issues
```

Then, for each issue:
1. Analyze the error and identify root cause
2. Implement the fix in the appropriate library handler
3. Create a test script to validate the fix. It should use the same code as the main process but run in a test environment.
   - Ensure it uses real manuscript URLs from the issues.
4. Save a non-technical explanation to `.devkit/fixes/issue_N_fix.txt`

After all fixes are complete:
1. Run validation for all fixes
2. Update package.json version and changelog
3. Commit with descriptive message
4. Push to trigger GitHub Actions build
5. Run post-fix actions to notify users:
```bash
.devkit/tools/post-fix-actions.sh
```

## Important Guidelines:
- Focus on fixing root causes, not symptoms
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