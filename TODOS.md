# TODOs

## Pending Tasks

- ✅ **HIGH PRIORITY: Fix Telegram bot changelog message** - RESOLVED: Bot now sends actual version-specific changelog instead of generic multi-platform marketing text. Removed hardcoded promotional content and now shows real changes from VERSION commits. Message format streamlined to focus on actual improvements.

- **Rewrite Telegram bot using TypeScript and ES modules** - Before implementing the rewrite, write comprehensive tests to ensure the transition goes smoothly without breaking user experience. The bot needs to maintain all current functionality while moving to modern TypeScript/ES modules architecture.

- **HIGH PRIORITY: Fix Playwright/Electron multiple instances and headed mode issue** - Last time Playwright was run headlessly, it bloated dock with multiple Electron instances. User asked to fix it but headed mode was restored. Need extensive investigation reading docs to ensure: 1) Never start Electron in headed mode, 2) Never have more than one Electron running, 3) Proper cleanup of all instances after tests.


- Fix NYPL calculation hanging: https://digitalcollections.nypl.org/items/89620130-9eeb-013d-0806-0242ac110002 - Manifest loads successfully but hangs on calculation stage

- **CRITICAL: Fix Orleans persistent hanging issue**: https://mediatheques.orleans.fr/recherche/viewnotice/clef/OUVRAGESDEPSEUDOISIDORE--PSEUDOISIDORE----28/id/746238/tri/%2A/expressionRecherche/Ouvrages+de+Pseudo+Isidore - Manifest loads but then hangs indefinitely. **ALREADY REPORTED AS FIXED TWICE** - need deep investigation and alternative approaches. User permits spending significant resources to solve this definitively.

## Completed Tasks

- ✅ **Fix Morgan Library low resolution issue** - RESOLVED in v1.2.2: https://www.themorgan.org/collection/lindau-gospels/thumbs - Updated regex patterns to recognize styled image format and convert to high-resolution versions. Current implementation downloads images that are 5.6x larger than styled thumbnails (209KB vs 37KB). Verified working correctly.

- ✅ **University of Graz library support** - ALREADY IMPLEMENTED in v1.1.2: Fix for https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538 fetch failure. Added Graz to size estimation bypass list and fixed pageview URL ID conversion. Both titleinfo and pageview URLs now work correctly.

- ✅ **Stanford Parker Library support** - ALREADY IMPLEMENTED: Full IIIF support for https://parker.stanford.edu/parker/catalog/ URLs. Tested 3 sample URLs (410, 596, 306 pages). E2E tests passing. 22 URLs should work with existing implementation.

<!-- Completed todos moved to TODOS-COMPLETED.md -->