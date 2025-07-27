# Manual Test Instructions for Error Handling Fixes

## 1. Graz Timeout Error Message Fix

### Issue
The error message incorrectly showed "21 seconds" when the actual timeout was 90 seconds due to only tracking individual attempt time instead of total time including retries.

### Fix Applied
- Added `overallStartTime` tracking at the beginning of the retry logic
- Updated error message to use `overallStartTime` instead of `attemptStartTime`

### How to Test
1. Start the dev server: `npm run dev:headless`
2. Try loading a Graz manuscript with network issues or use an invalid URL:
   - Valid URL: `https://unipub.uni-graz.at/obvugrhs/content/pageview/8224540`
   - To simulate timeout: Disconnect network or use firewall to block the domain
3. Wait for the timeout error
4. Check that the error message shows the correct total time (should be close to actual elapsed time)

### Expected Result
Error message should show: "University of Graz connection timeout after 5 attempts over X seconds" where X matches the actual elapsed time including all retries and backoff delays.

## 2. HHU Düsseldorf Error Handling Fix

### Issue
- Manifest loading started but no completion or error was logged
- Process hung silently without any error messages

### Fix Applied
- Added comprehensive logging with [HHU] prefix throughout the loading process
- Added 60-second timeout for manifest loading with Promise.race
- Added detailed error messages for different failure scenarios
- Added progress logging for URL parsing, manifest fetching, and page extraction
- Added HHU to IntelligentProgressMonitor with appropriate timeouts

### How to Test
1. Start the dev server: `npm run dev:headless`
2. Test with valid HHU URL:
   - `https://digital.ulb.hhu.de/ms/content/titleinfo/7674176`
3. Monitor console output for [HHU] prefixed logs
4. Test with invalid URLs to verify error handling:
   - Invalid format: `https://digital.ulb.hhu.de/invalid/format`
   - Non-existent ID: `https://digital.ulb.hhu.de/i3f/v20/99999999/manifest`

### Expected Logs
```
[HHU] Starting manifest load from URL: https://digital.ulb.hhu.de/ms/content/titleinfo/7674176
[HHU] Parsing URL to extract manuscript ID...
[HHU] Extracted manuscript ID: 7674176, manifest URL: https://digital.ulb.hhu.de/i3f/v20/7674176/manifest
[HHU] Loading manifest from: https://digital.ulb.hhu.de/i3f/v20/7674176/manifest
[HHU] Manifest fetch completed in XXXms
[HHU] Parsing manifest JSON...
[HHU] Manuscript label: [actual label]
[HHU] Processing XX pages from manuscript
[HHU] Page 1 image URL: [URL]
[HHU] Successfully extracted XX pages in XXXms
```

### Expected Error Messages
- Timeout: "HHU Düsseldorf manifest loading timed out after X seconds. The server may be slow or unresponsive..."
- Invalid URL: "Invalid HHU URL format. Expected formats: /i3f/v20/[ID]/manifest..."
- Connection error: "Cannot connect to HHU Düsseldorf server. Please check your internet connection..."

## Code Changes Summary

### EnhancedManuscriptDownloaderService.ts
1. Line 907: Added `overallStartTime` to track total time from first attempt
2. Line 1040: Updated Graz timeout error to use `overallStartTime`
3. Lines 10016-10165: Complete rewrite of `loadHhuManifest` with:
   - Comprehensive logging at each step
   - 60-second timeout for manifest loading
   - Detailed error messages for different scenarios
   - Progress tracking and duration reporting

### IntelligentProgressMonitor.ts
4. Lines 175-181: Added HHU configuration with 60s initial timeout and 5min max timeout