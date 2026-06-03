# MSS Downloader Rules

- Discover manuscript URLs from manifests, APIs, or HTML rather than guessing URL patterns.
- Verify library detection, routing, and loader selection together.
- Use dynamic discovery instead of artificial page caps.
- Clear manuscript cache on every deletion path.
- Avoid running Electron directly because the user's app may already hold the single-instance lock.
- When fixing type errors, preserve runtime behavior and adjust types.
- For "bump", stage tracked updates only; for "bump all", include untracked files.
- Implement library requests immediately.
- Treat precommit failure as a full stop.
- Validate libraries at maximum resolution with 10 pages and inspect the result.
- Keep `.devkit/` under 200 files and 200 MB.
