# TODOs

## Pending Tasks

- Fix NYPL calculation hanging: https://digitalcollections.nypl.org/items/89620130-9eeb-013d-0806-0242ac110002 - Manifest loads successfully but hangs on calculation stage

## Completed Tasks

- ✅ **CRITICAL: Fix Orleans persistent hanging issue** - FIXED in v1.2.6: Definitively resolved Orleans hanging during manifest loading by replacing sequential processing (356+ API calls) with batch processing (8 items per batch), implementing circuit breaker logic, limiting very large manuscripts to 200 pages, and adding 2-second delays between batches. This addresses the root cause of rate limiting that caused indefinite hangs.

- ✅ **HIGH PRIORITY: Fix Playwright/Electron multiple instances and headed mode issue** - FIXED: Implemented comprehensive solution including unique user data directories for each test instance, global process tracking with cleanup hooks, enhanced PID management scripts, and global setup/teardown for Playwright. Tests now run in isolated environments with proper cleanup, eliminating dock bloating from orphaned Electron processes.

- ✅ **Rewrite Telegram bot using TypeScript and ES modules** - COMPLETED: Successfully migrated entire Telegram bot to TypeScript with ES modules. New implementation includes comprehensive test suite, improved type safety, modern async/await patterns, and maintains full compatibility with existing functionality. All tests passing, build process working correctly.

- ✅ **HIGH PRIORITY: Fix Telegram bot changelog message** - RESOLVED: Bot now sends actual version-specific changelog instead of generic multi-platform marketing text. Removed hardcoded promotional content and now shows real changes from VERSION commits. Message format streamlined to focus on actual improvements.

- ✅ **Fix Morgan Library low resolution issue** - RESOLVED in v1.2.2: https://www.themorgan.org/collection/lindau-gospels/thumbs - Updated regex patterns to recognize styled image format and convert to high-resolution versions. Current implementation downloads images that are 5.6x larger than styled thumbnails (209KB vs 37KB). Verified working correctly.

- ✅ **University of Graz library support** - ALREADY IMPLEMENTED in v1.1.2: Fix for https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538 fetch failure. Added Graz to size estimation bypass list and fixed pageview URL ID conversion. Both titleinfo and pageview URLs now work correctly.

- ✅ **Stanford Parker Library support** - ALREADY IMPLEMENTED: Full IIIF support for https://parker.stanford.edu/parker/catalog/ URLs. Tested 3 sample URLs (410, 596, 306 pages). E2E tests passing. 22 URLs should work with existing implementation.

<!-- Completed todos moved to TODOS-COMPLETED.md -->