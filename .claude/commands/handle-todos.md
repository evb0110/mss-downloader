Handle all pending todos from TODOS.md following the complete project workflow.
Todos may be very stubborn and notoriously difficult, so you can use any resources to complete them: up to 5 parallel agents, ultrahard thinking, web searches, curl requests, gh on this machine, any zsh commands etc. Don't spare tokens, don't try to make fast, top priority is working app and user satisfaction. The worst thing to do is breaking existing functionality (CRUCIAL!!!)

**Important consideration** Before starting analyze the whole todos list, since some of them may be related, so you should fix or implement them together

**Workflow:**
   take all todos consequently and do the following:
1. **Read** first pending todo from TODOS.md (ONLY select todos WITHOUT ✅ checkmark)
2. **Implement** the task completely
3. **Test** using project-specific lint test commands when applicable
   **Fix** all the problems from testing stage until there are none
4. **Report** completion to user
5. **Update** CLAUDE.md with insights/changes if applicable. Merge this insights with the existing instructions, not to duplicate and make file too large
6. **Archive** completed todo to TODOS-COMPLETED.md (remove from TODOS.md)

**After everything is done:**
7. **Version** bump patch version in package.json
8. **Commit** changes and push to trigger automated builds/notifications
   **Ensure** Users should receive concise and up-to-date changelog in telegram bot. Only non-technical details

**Critical Requirements:**
- Only mark tasks as completed when ACTUALLY FULLY IMPLEMENTED AND WORKING
- Never mark completed based on code changes alone - verify functionality works
- Use project-specific test commands (e.g., `npm run test:e2e:start`/`npm run test:e2e:kill`)
- Follow project's version bump and deployment workflow