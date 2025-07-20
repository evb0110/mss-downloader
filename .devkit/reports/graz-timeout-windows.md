# University of Graz Timeout Issue on Windows x64 - Investigation Report

## Issue Summary
Windows users are experiencing "Request timeout" errors when loading University of Graz manuscripts, despite the same URLs working fine on other platforms.

## Investigation Findings

### 1. Current Implementation Analysis

#### Timeout Configuration
- **Base timeout**: 30 seconds (configService default)
- **Library-specific multiplier**: 2.0x for Graz (= 60 seconds effective timeout)
- **IntelligentProgressMonitor settings for Graz**:
  - Initial timeout: 120 seconds
  - Progress check interval: 30 seconds
  - Maximum timeout: 600 seconds (10 minutes)

#### Current Flow
1. `loadGrazManifest()` creates an IntelligentProgressMonitor with Graz-specific settings
2. The monitor starts with its own AbortController
3. `fetchDirect()` is called with the monitor's signal
4. However, `fetchDirect()` detects it has an external signal and doesn't apply its own timeout
5. This means the 60-second library-specific timeout is NOT being applied

### 2. Test Results

#### Local Test (macOS)
- **IIIF Manifest URL**: `https://unipub.uni-graz.at/i3f/v20/8224538/manifest`
- **Response time**: 743ms
- **Size**: 283KB (289,949 bytes)
- **Status**: Success with 30s timeout

#### Key Observations
1. The manifest is quite large (283KB) which could be problematic on slower connections
2. The manifest contains 405 canvas entries (pages)
3. Response is fast from European/US locations but may be slow from other regions

### 3. Potential Windows-Specific Issues

1. **Network Infrastructure**:
   - Corporate firewalls with stricter timeout policies
   - Windows Defender real-time scanning of HTTPS traffic
   - Different TCP window scaling behavior on Windows

2. **Geographic Latency**:
   - University of Graz servers are in Austria
   - Windows users might be in regions with higher latency

3. **Connection Speed**:
   - 283KB at slow speeds (e.g., 10KB/s) would take 28 seconds
   - Any additional overhead pushes past 30s timeout

### 4. Root Cause

The issue appears to be a **timeout configuration bug** where:
1. The IntelligentProgressMonitor is configured correctly with 120s-600s timeouts
2. But `fetchDirect()` skips applying library-specific timeouts when an external signal is provided
3. This means Graz requests are using the monitor's timeout (120s) but NOT benefiting from progress monitoring during the initial fetch

### 5. Recommended Fixes

#### Immediate Fix (High Priority)
Modify `fetchDirect()` to respect library-specific timeouts even with external signals:

```typescript
async fetchDirect(url: string, options: any = {}, attempt: number = 1): Promise<Response> {
    const library = this.detectLibrary(url) as TLibrary;
    const baseTimeout = configService.get('requestTimeout');
    const timeout = library ? 
        LibraryOptimizationService.getTimeoutForLibrary(baseTimeout, library, attempt) :
        baseTimeout;
    
    // Always apply library-specific timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // If external signal provided, chain it
    if (options.signal) {
        options.signal.addEventListener('abort', () => controller.abort());
    }
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}
```

#### Additional Improvements
1. **Increase Graz base timeout**: Change multiplier from 2.0 to 3.0 (90 seconds)
2. **Add progress streaming**: For large manifests, parse JSON incrementally
3. **Add Windows-specific handling**: Detect Windows platform and add extra timeout buffer
4. **Improve error messages**: Include download progress percentage in timeout errors

### 6. Testing Recommendations

1. Create a Windows test build with increased timeouts
2. Test from various geographic locations using VPN
3. Monitor actual download speeds on Windows machines
4. Add telemetry to track timeout frequency by platform

### 7. Temporary Workaround for Users

Until the fix is deployed, Windows users can:
1. Use a VPN to connect through European servers
2. Temporarily disable Windows Defender real-time protection
3. Try during off-peak hours when servers are less loaded
4. Use smaller manuscripts for testing

## Conclusion

The timeout issue is caused by a configuration bug where library-specific timeout multipliers are not applied when using the IntelligentProgressMonitor. The 283KB manifest size combined with potentially slower connections on Windows pushes past the effective timeout. The fix involves ensuring library-specific timeouts are always applied, regardless of signal source.