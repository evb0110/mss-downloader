Pick and handle the first pending todo from .devkit/tasks/TODOS.md following the complete project workflow.

**Workflow:**
1. **Read** first pending todo from .devkit/tasks/TODOS.md (ONLY select todos WITHOUT ✅ checkmark)
2. **Implement** the task completely
3. **Test** using project-specific test commands when applicable
4. **Report** completion to user
5. **Update** CLAUDE.md with insights/changes if applicable  
6. **Archive** completed todo to .devkit/tasks/TODOS-COMPLETED.md (remove from .devkit/tasks/TODOS.md)

**Critical Requirements:**
- Only mark tasks as completed when ACTUALLY FULLY IMPLEMENTED AND WORKING
- Never mark completed based on code changes alone - verify functionality works
- Use project-specific test commands (e.g., `npm run test:e2e:start`/`npm run test:e2e:kill`)
- Follow project's version bump and deployment workflow

**File Management:**
- Keep .devkit/tasks/TODOS.md clean with only pending tasks
- Archive completed tasks in .devkit/tasks/TODOS-COMPLETED.md organized by version
- Maintain clean separation between pending and completed todos