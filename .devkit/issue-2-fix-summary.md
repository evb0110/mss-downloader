# GitHub Issue #2 Resolution - University of Graz (грац)

## Version: 1.4.93

### Problems Identified and Fixed:

1. **App Crashes on Manifest Errors** ✅
   - Added comprehensive error boundaries in `loadGrazManifest`
   - Added crash recovery logging to persist errors even if app crashes
   - Safe error messages prevent undefined errors from crashing app

2. **Files "Missing" After Download** ✅
   - Files were saved in `Downloads/[manuscript_name]/` subfolder
   - "Reveal Folder" button opened parent Downloads folder
   - Fixed to open the actual manuscript subfolder with `shell.showItemInFolder`

3. **Queue Management Broken** ✅
   - Auto-split caused all parts to download simultaneously
   - Added `activeDownloadCount` to enforce single item processing
   - Queue now properly waits for current download before starting next

4. **Pause/Resume Not Working** ✅
   - Pause didn't actually stop HTTP requests
   - Added proper abort controllers for each download
   - Pause now aborts active downloads and marks items as "paused"

### Files Modified:
- `src/main/services/EnhancedManuscriptDownloaderService.ts` - Error handling
- `src/main/main.ts` - Fixed Reveal Folder functionality
- `src/main/services/EnhancedDownloadQueue.ts` - Queue management fixes
- `package.json` - Version bump to 1.4.93

### Testing:
- Graz manifest loads without crashing
- Test URL: https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688
- Successfully loads 644 pages
- No crash logs generated

### Build Status:
- All TypeScript compilation successful
- Lint errors fixed (removed require imports)
- GitHub Actions build initiated
- Telegram notifications will be sent upon completion

## User Benefits:
- App no longer crashes when loading problematic manuscripts
- Downloads are properly saved and easily found
- Queue behaves predictably with one download at a time
- Pause actually stops downloads immediately

This comprehensive fix addresses all critical issues reported for University of Graz and improves overall app stability for all libraries.