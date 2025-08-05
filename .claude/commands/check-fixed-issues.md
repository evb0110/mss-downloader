# Check and Close Fixed GitHub Issues

This command checks all open GitHub issues for author confirmations of fixes and automatically closes resolved issues.

## Workflow

1. **Fetch all open issues** from GitHub
2. **Analyze comments** to detect:
   - Fix announcements (e.g., "Fixed in version X.X.X")
   - Author responses confirming the fix works
   - Author responses indicating problems persist
3. **Take appropriate action**:
   - **Confirmed fixes**: Close issue with thank you message
   - **No response after 3 days**: Send follow-up request
   - **No response after 7 days**: Close issue automatically
   - **Problem persists**: Keep issue open for further work

## How to Run

```bash
# Ensure gh CLI is installed and authenticated
gh --version || echo "Please install GitHub CLI"

# Run the issue checker
node .devkit/scripts/check-and-close-fixed-issues.cjs
```

## Detection Logic

### Fix Confirmation Keywords
The script looks for these keywords in author responses to confirm fixes:
- Russian: работает, исправлено, спасибо, теперь работает, всё ок, проблема решена, успешно, отлично
- English: works, fixed, thanks, now works, all good, problem solved, successfully, excellent, perfect
- Emojis: ✅, 👍

### Problem Persistence Keywords
These keywords indicate the issue still exists:
- Russian: не работает, всё ещё, ошибка, проблема, не исправлено
- English: not working, still broken, still not, error, problem, not fixed
- Emojis: ❌, 👎

## Data Storage

The script maintains state in `.devkit/data/checked-issues.json`:
- Tracks when follow-ups were sent
- Records last check timestamps
- Prevents duplicate actions

## Example Output

```
🚀 GitHub Issue Fix Checker

🔍 Fetching all open issues...
Found 12 open issues

📋 Processing Issue #2: грац
✅ Author confirmed fix works!
✅ Issue #2 closed successfully

📋 Processing Issue #3: верона  
⏳ Waiting for author response (4 days)
📢 Sending follow-up request
✅ Follow-up sent

📋 Processing Issue #5: Флоренция
🔍 No fix has been posted yet

=============================================================
📊 SUMMARY
=============================================================
Total open issues checked: 12
✅ Issues with confirmed fixes: 2
🔒 Issues closed: 2

Fixed issues:
- #2: грац (v1.4.73)
- #10: Цюрих (v1.4.73)

✅ Check complete!
```

## Automatic Scheduling

To run this check automatically, you can:

1. **Add to package.json scripts**:
```json
"scripts": {
  "check:issues": "node .devkit/scripts/check-and-close-fixed-issues.cjs"
}
```

2. **Create a cron job** (on server):
```bash
# Run daily at 10 AM
0 10 * * * cd /path/to/mss-downloader && npm run check:issues
```

3. **GitHub Actions** (optional):
```yaml
name: Check Fixed Issues
on:
  schedule:
    - cron: '0 10 * * *'
  workflow_dispatch:

jobs:
  check-issues:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm run check:issues
```

## Manual Intervention

The script is designed to be autonomous, but you can:
- Review `.devkit/data/checked-issues.json` to see tracking data
- Manually close issues that the script missed
- Adjust the follow-up timing in the script (currently 3 and 7 days)

## Integration with handle-issues Command

This command complements the `/handle-issues` workflow:
- `/handle-issues`: Fixes bugs and posts solutions
- `/check-fixed-issues`: Monitors responses and closes resolved issues

Run this command regularly to keep the issue tracker clean and ensure authors get proper follow-up.