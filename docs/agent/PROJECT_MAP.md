# PROJECT MAP

Repository orientation for Agent Mode. Paths relative to repo root.

Core services and loaders:
- src/main/services/EnhancedManuscriptDownloaderService.ts — central orchestrator, supported libraries list, routing, fetch stack
- src/main/services/library-loaders/ — per-library loaders (e.g., CodicesLoader.ts)
- src/shared/SharedManifestLoaders.ts — shared helpers and some library implementations
- src/main/services/*Logger*.ts — logging utilities and enhanced metrics

Build and config:
- package.json — version, scripts, changelog summary array, electron-builder config
- esbuild.main.config.js — main process bundle
- vite.config / vite.worker.config.ts — renderer/workers build

UI:
- src/renderer/components/ — Vue components
- src/renderer/translations/ — i18n strings, search works across name/description/example

Release artifacts:
- release/ — electron-builder output

Conventions:
- Always bump version in package.json when user-facing change (patterns, supported list, loaders)
- Supported libraries live in EnhancedManuscriptDownloaderService.SUPPORTED_LIBRARIES
- Library detection: EnhancedManuscriptDownloaderService.detectLibrary()
- Use --no-pager with git in terminal commands; avoid interactive flows

