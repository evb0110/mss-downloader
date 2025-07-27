# Handle All GitHub Issues

You need to systematically fix all open GitHub issues for the mss-downloader project.

## FIRST: Check Existing Issues Status
**ALWAYS START BY CHECKING ISSUE RESPONSES:**
```bash
.devkit/tools/check-issue-responses.sh
```

Then for each issue that needs follow-up:
1. If fix was posted but no author response yet AND no follow-up tag exists:
   - Tag the author asking them to test the fix
2. If follow-up tag exists and 3+ days passed with no response:
   - Close the issue with explanation
3. If author responded:
   - Handle based on their feedback

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

## Issue Follow-up Process:
After posting fix comments on issues:

1. **Check for user responses** after 24-48 hours:
   - Use `gh issue view <number> --comments` to check if the author responded
   - Look for comments from the issue author after your fix announcement

2. **If no response from author**:
   - Tag the user with: `@<username>, пожалуйста, проверьте исправление в версии X.X.X и сообщите, работает ли оно.`
   - Wait 3 more days for response

3. **After 3 days of no response**:
   - Close the issue with explanation:
   ```
   Закрываю issue, так как исправление было выпущено в версии X.X.X и не было получено обратной связи в течение 3 дней.
   
   Если проблема всё ещё существует, пожалуйста, откройте новый issue с подробным описанием.
   ```

4. **If user confirms fix works**:
   - Thank them and close the issue:
   ```
   Спасибо за подтверждение! Рад, что проблема решена. Закрываю issue.
   ```

5. **If user reports fix doesn't work**:
   - Investigate further
   - Request additional logs/details
   - Continue working on the fix

## Important Guidelines:
- Focus on fixing root causes, not symptoms
- Create user-friendly Russian explanations
- Ensure all fixes are backward compatible
- Always wait for user confirmation or 3-day timeout before closing issues
- Be polite and helpful in all communications

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