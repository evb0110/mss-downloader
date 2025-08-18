# ROME TIMEOUT ISSUE - ROOT CAUSE ANALYSIS

## ULTRATHINK DISCOVERY: Hard-coded Agent Timeout Overriding Rome Settings

### Issue Summary
Rome National Library still hangs at 120 seconds despite implementing fetchDirect fix and setting 90-second timeouts.

### Root Cause Identified
**File:** `/src/main/services/EnhancedManuscriptDownloaderService.ts`
**Lines:** 1632-1642

```typescript
const agent = (url.includes('unipub.uni-graz.at') || url.includes('cdm21059.contentdm.oclc.org') ||
              url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it') ||
              url.includes('digitale.bnc.roma.sbn.it')) ?   // <-- Rome URLs match this condition
    new https.Agent({
        keepAlive: true,
        keepAliveMsecs: 1000,
        maxSockets: 10,
        maxFreeSockets: 5,
        timeout: 120000,          // <-- HARD-CODED 120 seconds for ALL libraries!
        rejectUnauthorized: false
    }) : undefined;
```

### The Conflict
Lines 1663-1664 correctly try to set Rome timeout to 90 seconds:
```typescript
const requestTimeout = (options as any).timeout || (url.includes('unipub.uni-graz.at') ? 120000 :
                    (url.includes('digitale.bnc.roma.sbn.it') ? 90000 : // Rome needs 90 seconds
```

**BUT:** The HTTPS Agent timeout (120000) takes precedence over request timeout settings.

### Why Rome Still Hangs at 120 Seconds
1. Rome URLs (`digitale.bnc.roma.sbn.it`) match the agent condition
2. Agent is created with hard-coded `timeout: 120000` 
3. Agent timeout overrides any request-level timeout configuration
4. Rome requests time out at 120 seconds instead of the intended 90 seconds

### Two Competing Rome Implementations Found
1. **RomeLoader.ts** - Uses `fetchDirect()` with proper 90s timeout
2. **SharedManifestLoaders.ts** - Uses `fetchWithRetry()` with proper 90s timeout  
3. **EnhancedManuscriptDownloaderService.ts** - Uses hard-coded 120s agent timeout (PROBLEM!)

### The Fix Required
The HTTPS Agent timeout should be library-specific, not hard-coded to 120000 for all libraries:

```typescript
// BEFORE (broken):
timeout: 120000,

// AFTER (fixed):
timeout: url.includes('digitale.bnc.roma.sbn.it') ? 90000 : 120000,
```

### Impact
This explains why:
- Simple curl works fine (no agent timeout)
- Our fetchDirect "fix" didn't work (wrong code path)
- Rome consistently times out at exactly 120 seconds
- SharedManifestLoaders has correct 90s timeout but isn't being used for some Rome requests

### Next Steps
1. Fix the hard-coded agent timeout to respect library-specific values
2. Verify which code path (RomeLoader vs SharedManifestLoaders vs EnhancedManuscriptDownloaderService) is actually handling user requests
3. Ensure all Rome code paths use the same timeout values
4. Test with real Rome URL to confirm fix