# Agent README

Purpose: This folder equips Agent Mode with the minimum context and repeatable steps to work autonomously in this repo (mss-downloader) without re-discovery.

Read order for fast onboarding:
1) PROJECT_MAP.md — Where things live (key paths, naming conventions)
2) CHECKLISTS.md — Quick actions (add URL pattern, add library, release)
3) PLAYBOOKS.md — Detailed procedures with gotchas and guardrails

Absolute rules (Agent Mode):
- Work on main by default. Commit and push frequently with clear messages.
- When adding URL patterns, immediately update Supported Libraries entry and bump patch version.
- Never read files via shell cat; use the code-reading tools when needed (but prefer direct paths).
- Avoid interactive commands and paged output; use --no-pager for git, non-interactive gh commands.
- No secrets in plain text. If needed, store in env vars and never echo.

Common package scripts:
- npm run typecheck:silent   # non-blocking typecheck
- npm run build              # production build
- npm run dist               # build + electron-builder

Release policy:
- Patch version for loader patterns, docs, small fixes
- Minor for notable features or multiple libraries
- Always push tag and create GitHub release notes

Linked issue etiquette:
- Reference issues in commit body with "Refs #<id>"
- Comment on issue with changes and examples when user-facing

