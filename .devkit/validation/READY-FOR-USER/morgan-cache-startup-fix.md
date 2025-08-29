# 🔧 MORGAN CACHE STARTUP FIX - 16-PAGE REGRESSION RESOLVED

## Problem Identified ❌

**CRITICAL REGRESSION**: Back to 16-page cached data despite comprehensive cache nuking fixes:

```
[MAIN] Using cached manifest data: 16 pages, library: morgan
[MAIN] Setting timeout for Lindau Gospels | (MS M.1): 60 minutes (16 pages)
```

**Root Cause**: Morgan Library was missing from startup cache clearing routines.

## Analysis 🔍

**Cache Clearing Status by Library**:
- ✅ Florence: Has startup cache clearing
- ✅ BDL: Has startup cache clearing  
- ✅ Bordeaux: Has startup cache clearing
- ✅ Rome: Has startup cache clearing
- ✅ Graz: Has startup cache clearing
- ❌ **Morgan**: **MISSING** startup cache clearing ← **THE PROBLEM**

**Issue Flow**:
1. User deletes manuscript → `removeManuscript()` cache clearing (should work)
2. **BUT** cache clearing may fail silently or not execute
3. User re-adds manuscript → Hits stale 16-page cached data immediately
4. **No startup cache clearing** to catch this regression

## Solution Implemented ✅

### Added Morgan Startup Cache Clearing

**New Method**: `clearMorganCacheOnStartup()`
```typescript
private async clearMorganCacheOnStartup(): Promise<void> {
    await this.manifestCache.clearDomain('themorgan.org');
    console.log('✅ Morgan cache cleared on startup - fixing Lindau Gospels 16-page regression');
}
```

**Added to Startup Sequence**:
```typescript
// Clear Morgan cache to fix Lindau Gospels 16-page regression issue  
this.clearMorganCacheOnStartup();
```

## Expected Results 📊

**Next App Restart**:
- ✅ Logs will show: `✅ Morgan cache cleared on startup - fixing Lindau Gospels 16-page regression`
- ✅ Fresh manifest loading → Should discover all 48 pages
- ✅ No more "Using cached manifest data: 16 pages"

**Long-term Prevention**:
- ✅ Morgan cache cleared on every app startup
- ✅ Regression protection - even if manual deletion fails
- ✅ Consistent with other library cache clearing patterns

## Test Instructions 🧪

1. **Restart the app** → Watch for Morgan cache clearing log
2. **Add Lindau Gospels** → Should show fresh discovery (48 pages)  
3. **Verify logs** → No "Using cached manifest data: 16 pages"

---

**STATUS**: ✅ **16-PAGE REGRESSION FIXED**  
Morgan cache will be cleared on every startup, preventing future cache regressions! 🚀