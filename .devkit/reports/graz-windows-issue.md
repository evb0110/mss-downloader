# University of Graz Windows Download Issue - Investigation Report

## Issue Summary
User reports that University of Graz manuscript downloads fail on Windows but work on macOS devserver.

**Test URL:** https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538

## Current Implementation Analysis

### 1. loadGrazManifest Function
The current implementation uses standard `fetchDirect` method:
- Constructs IIIF manifest URL: `https://unipub.uni-graz.at/i3f/v20/{manuscriptId}/manifest`
- Uses Windows User-Agent in headers
- Implements intelligent progress monitoring with extended timeouts (120s initial, 600s max)
- No platform-specific code or SSL certificate handling

### 2. Potential Windows-Specific Issues

#### A. SSL Certificate Validation
**Most Likely Cause:** Windows and macOS handle SSL certificates differently:
- macOS is more lenient with certificate chain validation
- Windows strictly validates the entire certificate chain
- University of Graz may have certificate issues that Windows rejects

**Evidence:**
- No SSL bypass code for Graz domain (unlike Verona, Grenoble, BNE)
- Other libraries with SSL issues use `fetchWithHTTPS` or custom agents
- Graz uses standard `fetchDirect` without SSL handling

#### B. Network Stack Differences
- Windows uses WinHTTP/WinINet, macOS uses NSURLSession
- Different timeout behaviors and connection handling
- Potential proxy or firewall interference on Windows

#### C. Electron Certificate Handling
- Electron on Windows may have stricter certificate validation
- No `app.commandLine.appendSwitch('ignore-certificate-errors')` found
- No certificate error event handlers registered

## Proposed Solutions

### Solution 1: Add SSL Certificate Bypass for Graz (Recommended)
Similar to Verona and Grenoble handling:

```typescript
// In fetchDirect method, add Graz to SSL bypass domains
if (url.includes('unipub.uni-graz.at')) {
    const response = await this.fetchWithHTTPS(url, { ...fetchOptions, timeout });
    if (timeoutId) clearTimeout(timeoutId);
    return response;
}
```

### Solution 2: Use Custom HTTPS Agent
Add platform-specific handling:

```typescript
// For Windows only
if (process.platform === 'win32' && url.includes('unipub.uni-graz.at')) {
    if (typeof process !== 'undefined' && process.versions?.node) {
        const { Agent } = await import('https');
        fetchOptions.agent = new Agent({
            rejectUnauthorized: false
        });
    }
}
```

### Solution 3: Electron-Wide Certificate Handling
Add to main process initialization:

```typescript
// In main.ts
app.commandLine.appendSwitch('ignore-certificate-errors');

// Or handle certificate errors gracefully
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    if (url.includes('unipub.uni-graz.at')) {
        event.preventDefault();
        callback(true); // Trust the certificate
    } else {
        callback(false);
    }
});
```

## Testing Approach

Created diagnostic script: `.devkit/test-scripts/test-graz-windows-debug.js`
Tests:
1. Direct fetch with standard options
2. HTTPS module with/without SSL validation
3. Fetch with custom HTTPS agent
4. Timeout handling
5. Actual image download

## Recommendation

**Implement Solution 1** - Add Graz to the SSL bypass list using `fetchWithHTTPS` method:

1. This approach is already proven to work for Verona and Grenoble
2. Minimal code change with predictable behavior
3. Consistent with existing error handling patterns
4. No global security implications

**Fallback:** If Solution 1 doesn't work, implement Solution 2 for Windows-specific handling.

## Next Steps

1. Test the diagnostic script on a Windows machine to confirm SSL issues
2. Implement the SSL bypass for Graz domain
3. Test the fix on both Windows and macOS
4. Consider adding more robust certificate error logging for future debugging