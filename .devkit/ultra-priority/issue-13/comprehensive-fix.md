# ULTRA-PRIORITY FIX for Issue #13 - Grenoble URL Concatenation

## ROOT CAUSE ANALYSIS
The error message shows: `getaddrinfo EAI_AGAIN pagella.bm-grenoble.frhttps://pagella.bm-grenoble.fr/...`

This indicates the hostname (`pagella.bm-grenoble.fr`) is being concatenated with the full URL, creating an invalid DNS lookup target.

## PROBLEM LOCATIONS
1. **Main entry point** (`main.ts:499`): Has sanitization but may not catch all cases
2. **EnhancedManuscriptDownloaderService** (`fetchWithHTTPS:1059`): Sanitizes URL but issue persists
3. **SharedManifestLoaders** (`sanitizeUrl:101`): Has sanitization logic

## THE REAL ISSUE
The sanitization happens BUT the malformed URL is somehow bypassing it or being re-created after sanitization.

## SOLUTION STRATEGY
We need to add MULTIPLE layers of defense:

1. **Before ANY URL usage** - Sanitize at entry point
2. **Before DNS resolution** - Validate hostname doesn't contain URL parts
3. **In error handlers** - Detect and fix malformed URLs in error messages
4. **Add logging** - Track where the malformation happens

## CRITICAL FIX POINTS
1. The `fetchWithHTTPS` method at line 1065 creates `new URL(url)` AFTER sanitization
2. But if the URL object creation itself has issues, we need to handle that
3. The hostname extraction at line 1120 needs additional validation

## IMPLEMENTATION PLAN
1. Add defensive URL parsing that catches malformed URLs during URL object creation
2. Add hostname validation BEFORE any DNS operations
3. Add comprehensive logging to track the exact point of failure
4. Test with both normal and malformed URLs