# Library Fixes Implementation Plan

## Overview
This plan addresses the issues with NBM Italy (Verona) and Morgan Library identified in TODOS.md.

## Phase 1: NBM Italy (Verona) Library Fix

### 1.1 Remove Hardcoded Page Limit
**File**: `src/utils/SharedManifestLoaders.ts`
- Remove the hardcoded 10-page limit in `loadVeronaManifest()`
- Implement dynamic manifest fetching from IIIF JSON endpoint

### 1.2 Implement Proper IIIF Manifest Loading
**Implementation Steps**:
1. Construct the IIIF manifest URL: `https://ezida.srv-uf.univr.it/cantaloupe/iiif/2/${encodedPath}/info.json`
2. Fetch the actual manifest to get all available pages
3. Parse the manifest structure to extract all page URLs
4. Handle pagination if the manuscript has multiple sequences

### 1.3 Expand Manuscript Support
**Current State**: Only codice=15 is supported
**Fix**:
1. Research the NBM database structure
2. Implement a more flexible manuscript mapping system
3. Add fallback for unknown codes to attempt direct IIIF access

### 1.4 Add Comprehensive Logging
- Add debug logs for manifest fetching
- Log page detection count
- Log download progress for each page
- Ensure logs are visible in the download process

## Phase 2: Morgan Library Fix

### 2.1 Fix Size Estimation
**File**: `src/services/library-manager.ts`
- Change from 25MB to 5MB per page estimation
- This prevents unnecessary manuscript splitting

### 2.2 Debug Page Detection
**Investigation needed**:
1. Check the regex pattern for extracting page URLs
2. Verify the HTML structure hasn't changed
3. Test with multiple manuscripts to ensure all pages are detected

### 2.3 Add Library Optimization Settings
**File**: `src/services/library-optimization.ts`
- Add Morgan-specific settings:
  ```typescript
  'morgan': {
    maxConcurrentDownloads: 2,
    requestDelay: 500,
    timeoutMultiplier: 1.5,
    maxRetries: 3
  }
  ```

### 2.4 Fix Image Quality Selection
**Investigation**:
1. Debug which priority level is being selected
2. Ensure the quality selection logic properly handles Morgan's .zif format
3. Add logging to track quality selection

## Phase 3: Common Improvements

### 3.1 Enhanced Error Recovery
- Implement retry logic with exponential backoff
- Add specific error handling for timeout scenarios
- Provide clear error messages to users

### 3.2 Progress Reporting
- Implement proper progress callbacks
- Show actual download progress, not just "downloading..."
- Display current page number being downloaded

### 3.3 Testing Protocol
1. Test NBM with manuscript codice=15 (the reported issue)
2. Test NBM with other manuscript codes
3. Test Morgan with Lindau Gospels (the reported issue)
4. Test Morgan with other manuscripts
5. Validate all downloaded PDFs for quality and completeness

## Implementation Order

1. **Quick Wins First**:
   - Fix Morgan size estimation (immediate impact)
   - Add library optimization settings
   
2. **Core Fixes**:
   - Fix NBM dynamic page loading
   - Debug Morgan page detection
   
3. **Enhancements**:
   - Add comprehensive logging
   - Implement progress reporting
   - Expand NBM manuscript support

## Validation Requirements

After each fix:
1. Download test manuscripts from both libraries
2. Verify all pages are detected and downloaded
3. Check image quality (should be high resolution)
4. Validate PDFs with poppler
5. Ensure no hanging or timeout issues
6. Confirm logs are visible and helpful

## Risk Mitigation

- Create backup of current working code
- Test each change incrementally
- Maintain backward compatibility
- Add feature flags if needed for gradual rollout

## Success Criteria

1. NBM downloads all pages (not just 10) without hanging
2. Morgan downloads all pages in high quality without splitting unnecessarily
3. Both libraries show proper progress and logs
4. All test manuscripts pass validation
5. No regression in other libraries

## Additional Fixes from Log Analysis

### Phase 4: Critical Bug Fixes from Logs

#### 4.1 Fix Graz Error Message
**File**: `src/main/services/error-handlers.ts` (or similar)
- Fix the "21 seconds" error message to show actual timeout duration
- The error occurs after 90 seconds but reports 21 seconds

#### 4.2 Add HHU Düsseldorf Error Handling
**Issue**: Silent failure with no error logging
- Add timeout handling for manifest loading stage
- Ensure all manifest parsing errors are caught and logged
- Add progress logging during manifest fetch

#### 4.3 Fix Duplicate Event Logging
**Issue**: Same events logged multiple times
- Review event handler registration
- Ensure download events are only emitted once
- Check for race conditions in concurrent downloads

#### 4.4 Platform-Specific Testing
**Requirement**: Test on Windows specifically
- User logs show Windows platform (win32 x64)
- Network timeouts may behave differently on Windows
- Consider platform-specific timeout adjustments

### Phase 5: Enhanced Logging Implementation

#### 5.1 Progress Logging
- Log every 10 seconds during long operations
- Include bytes downloaded / total expected
- Log each retry attempt with timestamp

#### 5.2 Manifest Parsing Logs
- Log manifest URL before fetch
- Log response size and time taken
- Log number of pages/canvases found
- Log any parsing errors with details

#### 5.3 NBM Italy Specific Logging
- Add log at manifest fetch start
- Log codice mapping resolution
- Log each page URL generated
- Log download progress for each page

## Updated Implementation Order

1. **Critical Quick Fixes**:
   - Fix Graz error message (incorrect "21 seconds")
   - Fix Morgan size estimation
   - Fix duplicate logging
   
2. **Core Library Fixes**:
   - Fix NBM dynamic page loading
   - Add HHU error handling
   - Debug Morgan page detection
   
3. **Logging Enhancements**:
   - Implement comprehensive progress logging
   - Add manifest parsing logs
   - Enhance error messages with actual values
   
4. **Platform Testing**:
   - Test all fixes on Windows
   - Verify timeout behavior
   - Check for platform-specific issues