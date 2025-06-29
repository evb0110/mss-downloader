# Project TODOs

## Pending Tasks

1. **Implement intelligent download progress monitoring with timeout detection**

The current University of Graz timeout fix applies a random 2-minute timeout which is incorrect. The logic should be:
- Always wait initial period (2 minutes)
- Set interval checking (30 seconds) to detect if download is progressing or stuck
- If stuck, report to user
- If progressing (even very slowly), continue waiting and inform user that manifest loading takes longer
- Apply similar logic to all manuscripts with adapted timings for those that already wait longer
- Use 5 deeply thinking agents to orchestrate this complex problem
- Apply scraping best practices
- Produce robust and reliable solution with great UX

## Completed Tasks

See [COMPLETED.md](./COMPLETED.md) for full list of completed tasks.