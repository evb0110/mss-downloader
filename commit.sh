#!/bin/bash
cd /Users/e.barsky/Desktop/Personal/Electron/mss-downloader
git add src/main/services/EnhancedManuscriptDownloaderService.ts package.json
git commit -m "VERSION-1.3.87: Fix library authentication and enhance manuscript download capabilities

- Fixed Belgica KBR authentication errors and session handling
- Enhanced DIAMM library with maximum resolution parameters
- Improved E-Manuscripta Basel multi-block manuscript discovery (19x improvement)
- Added BVPB Spanish heritage library support with high-resolution downloads

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin main