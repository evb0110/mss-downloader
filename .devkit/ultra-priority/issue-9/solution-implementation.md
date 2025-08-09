# BDL Fix Implementation Plan

## Issues Identified:
1. **Duplicate Media IDs**: API returns 304 pages but 2 are duplicates
2. **Hardcoded URL Pattern**: Uses `/cantaloupe//iiif/` with double slash
3. **Not Using API's cantaloupeUrl**: API provides the base URL but code hardcodes it
4. **User Report**: "много пустых страниц при скачивании" (many empty pages when downloading)

## Solution:
1. Deduplicate pages based on idMediaServer
2. Use the cantaloupeUrl from API response
3. Fix the double slash issue
4. Add proper error handling and logging

## Code Changes Required:
- Modify getBDLManifest() method in SharedManifestLoaders.js
- Track seen media IDs to prevent duplicates
- Use dynamic URL construction from API response