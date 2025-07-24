# Library of Congress Comprehensive Fix Plan

## Issues Identified

1. **Too aggressive concurrency (8)** - May overwhelm LOC servers causing throttling
2. **No progressive backoff** - Doesn't adapt to server issues
3. **No stall detection** - LOC uses regular fetch, not fetchWithHTTPS
4. **No skip logic** - Problematic pages cause long delays
5. **Poor error feedback** - Users can't tell if app is hanging or working
6. **Silent failures** - Failed pages become blank without notification

## Implementation Plan

### 1. Update LOC Optimization Settings
- Reduce concurrent downloads from 8 to 4
- Enable progressive backoff
- Add longer initial timeout for stability

### 2. Implement LOC-Specific Stall Detection
- Add progress monitoring for individual LOC downloads
- Abort if no data received for 30 seconds
- Track download speed and abort if too slow

### 3. Add Skip Logic
- After 2 failed attempts, offer to skip page
- Track patterns of failures (consecutive pages)
- Auto-skip after 3 consecutive failures

### 4. Enhanced Error Handling
- Better error messages for LOC-specific issues
- Track and report failed pages clearly
- Allow retry of failed pages after completion

### 5. User Feedback Improvements
- Show current page being downloaded
- Display retry attempts
- Add "Skip remaining pages" option
- Show failed page summary

### 6. Implement Health Monitoring
- Track success rate during download
- Reduce concurrency if failure rate > 20%
- Increase timeouts if needed

## Code Changes

### LibraryOptimizationService.ts
```typescript
'loc': {
    maxConcurrentDownloads: 4, // Reduced from 8 for stability
    timeoutMultiplier: 1.5, // Increased from 1.2
    enableProgressiveBackoff: true, // Enable adaptive retry delays
    autoSplitThresholdMB: 500, // Split large manuscripts
    optimizationDescription: 'Library of Congress optimizations: 4 concurrent downloads with progressive backoff, stall detection, and skip logic for problematic pages'
},
```

### Enhanced Stall Detection for LOC
- Implement wrapper around fetch for LOC URLs
- Monitor data transfer progress
- Abort on stalls

### Skip Logic Implementation
- Track failed pages per manuscript
- Implement smart skip decisions
- User prompts for manual skip

## Testing Strategy

1. Test with known problematic manuscript
2. Simulate network issues
3. Test skip logic with artificial failures
4. Verify progress reporting accuracy
5. Test with multiple concurrent manuscripts