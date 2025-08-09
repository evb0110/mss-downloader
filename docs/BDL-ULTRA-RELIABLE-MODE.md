# BDL Ultra-Reliable Download Mode

## Overview

The **Ultra-Reliable BDL Mode** is a specialized download system designed specifically for Biblioteca Digitale Lombarda (BDL) manuscripts that ensures 100% page download success, even if it takes hours or days. This mode was created to address the issue of random blank pages appearing in PDFs due to geo-blocking, proxy failures, or server issues.

## Key Features

### 1. **Unlimited Retries with Smart Backoff**
- Default: **Unlimited retries** (-1 setting)
- Exponential backoff starting from 1 second up to 5 minutes
- After 20 attempts, switches to 1-5 minute random delays
- Prevents server overload while ensuring eventual success

### 2. **Intelligent Proxy Rotation**
- 6 different proxy servers with health monitoring
- Automatic health checks every 5 attempts
- Tracks success rates and response times
- Automatically switches to best-performing proxy
- Resets unhealthy proxies after all fail

### 3. **Quality Waterfall Strategy**
- Tries multiple quality levels: max → full → 4096 → 2048 → 1024 → 512 → 256
- Automatically falls back to lower quality if higher fails
- Ensures at least some version of the page is downloaded

### 4. **Post-Download Verification**
- After initial download, verifies all pages
- Checks minimum file size (default: 10KB)
- Re-downloads any pages that are:
  - Missing (null)
  - Too small (likely blank/error pages)
  - Failed during initial download

### 5. **Persistent Retry Queue**
- Saves failed pages to disk
- Survives application restarts
- Continues retrying from where it left off
- Clears automatically after successful completion

### 6. **Proxy Health Monitoring**
- Tests proxy servers before use
- Tracks average response times
- Marks proxies as unhealthy after 3 consecutive failures
- Prefers recently successful proxies

## Configuration Settings

All settings are configurable via the ConfigService:

```javascript
{
    // Enable/disable ultra-reliable mode for BDL
    bdlUltraReliableMode: true,
    
    // Maximum retries (-1 = unlimited)
    bdlMaxRetries: -1,
    
    // Minimum valid image size in bytes
    bdlMinVerificationSize: 10240, // 10KB
    
    // Enable proxy health checking
    bdlProxyHealthCheck: true,
    
    // Enable post-download verification
    bdlPostVerification: true,
    
    // Enable persistent retry queue
    bdlPersistentQueue: true
}
```

## How It Works

### Phase 1: Initial Download
1. Attempts direct download with quality fallback
2. If geo-blocked, tries each proxy server
3. Uses exponential backoff between attempts
4. Saves progress to persistent queue

### Phase 2: Post-Verification
1. Scans all downloaded images
2. Identifies failed or small pages
3. Re-downloads problematic pages with ultra-reliable settings
4. Continues until all pages are valid

### Phase 3: Recovery
1. Processes any items in retry queue
2. Replaces blank pages with recovered versions
3. Clears retry queue for the manuscript

## User Benefits

- **100% Success Rate**: Will keep trying until all pages are downloaded
- **No Manual Intervention**: Fully automated recovery
- **Resume Capability**: Can continue after app restart
- **Flexible Timing**: User can let it run overnight or longer
- **Quality Assurance**: Verifies every page is valid

## Technical Details

### Retry Delays
- Attempts 1-10: 1s → 2s → 4s → 8s → 16s → 32s → 64s → 128s → 256s → 300s
- Attempts 11-20: 300s with jitter (150-300s)
- Attempts 21+: Random 60-300s (1-5 minutes)

### Proxy Servers Used
1. api.allorigins.win
2. cors-anywhere.herokuapp.com
3. proxy.cors.sh
4. corsproxy.io
5. api.codetabs.com
6. thingproxy.freeboard.io

### File Storage
- Retry queue: `~/Library/Application Support/mss-downloader/bdl-retry-queue.json` (macOS)
- Or: `%APPDATA%/mss-downloader/bdl-retry-queue.json` (Windows)

## Monitoring Progress

The system provides detailed logging:
- Every attempt is logged with attempt number
- Every 50 attempts shows extended statistics
- Proxy health status is reported
- Recovery of failed pages is highlighted
- Final success/failure clearly indicated

## Example Log Output

```
[BDL Ultra] Attempt 1 for page 42
[BDL Ultra] Quality /full/max/ failed: timeout
[BDL Ultra] Trying quality level 1 (/full/full/)
[BDL Ultra] Waiting 2000ms before retry 2...
[BDL Ultra] Running proxy health checks...
[BDL Ultra] Using proxy api.allorigins.win
[BDL Ultra] SUCCESS: Page 42 via proxy (458392 bytes)
🔍 [BDL] Starting post-download verification and recovery...
[BDL Ultra] Re-downloading failed page 15...
[BDL Ultra] Page 88 too small (3421 bytes), re-downloading...
✅ [BDL] Recovered 3 previously failed pages
```

## Troubleshooting

### If downloads are still failing:
1. Check your internet connection
2. Verify proxies aren't blocked in your region
3. Try at different times (server may be overloaded)
4. Check the retry queue file for persistent issues

### To reset the retry queue:
```javascript
// In console or debug
ultraBDLService.clearRetryQueue();
```

### To check retry queue status:
```javascript
const status = ultraBDLService.getQueueStatus();
console.log(`${status.size} pages in retry queue`);
```

## Performance Considerations

- **Bandwidth**: Uses significant bandwidth with retries
- **Time**: Can take hours for problematic manuscripts
- **Storage**: Keeps failed pages in memory and disk
- **CPU**: Minimal CPU usage, mostly waiting

## Best Practices

1. **Start downloads before leaving**: Let it run overnight
2. **Don't interrupt**: Allow it to complete fully
3. **Check logs**: Monitor for persistent failures
4. **Use wired connection**: More stable than WiFi
5. **Close other apps**: Reduce network competition

## Future Improvements

- Smart scheduling (detect low-traffic times)
- Multiple proxy chains
- Distributed downloading across multiple IPs
- Machine learning for optimal retry patterns
- Automatic VPN switching for geo-blocks