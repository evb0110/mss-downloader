# Log Analysis Part 3 - Error Summary

Analysis of 3 log files from 2025-07-26:
- mss-downloader-logs-2025-07-26T11-57-49-617Z.json
- mss-downloader-logs-2025-07-26T12-17-53-866Z.json  
- mss-downloader-logs-2025-07-26T12-21-33-236Z.json

## Libraries with Errors

### 1. Morgan Library
**Log Files**: mss-downloader-logs-2025-07-26T12-17-53-866Z.json, mss-downloader-logs-2025-07-26T12-21-33-236Z.json

**Error Type**: 404 Not Found
**Error Count**: 4 occurrences (2 in each log file)

**Failed URLs**:
- https://www.themorgan.org/sites/default/files/images/collection/76874v_0004_0005.jpg/thumbs

**Error Details**:
- Status: 404
- Status Text: "Not Found"
- Response times: 1098ms, 1271ms
- The "/thumbs" suffix appears to be causing 404 errors

### 2. University of Graz
**Log File**: mss-downloader-logs-2025-07-26T12-21-33-236Z.json

**Error Type**: Connection Timeout
**Error Count**: 4 errors (2 timeout errors + 2 download failed errors)

**Failed URL**:
- https://unipub.uni-graz.at/i3f/v20/5892688/manifest

**Error Details**:
- Timeout after 90006ms and 90009ms (90 second timeout limit)
- Error message: "University of Graz connection timeout after 5 attempts over 21 seconds. The server at unipub.uni-graz.at is not responding. This may be due to high server load or network issues."
- Stack trace shows ClientRequest timeout in TLS Socket connection
- Library uses extended timeout (90000ms vs base 30000ms)

### 3. Vallicelliana Library
**Log File**: mss-downloader-logs-2025-07-26T11-57-49-617Z.json

**Error Type**: No actual errors found
**Notes**: 
- 5043 log entries but all are successful operations
- Library uses extended timeout (39000ms vs base 30000ms)
- All image downloads completed successfully
- URLs pattern: jmms.iccu.sbn.it/iiif/2/...

## Summary Statistics

| Library | Error Type | Count | URLs Affected |
|---------|------------|-------|---------------|
| Morgan | 404 Not Found | 4 | 1 unique URL |
| Graz | Connection Timeout | 4 | 1 unique URL |
| Vallicelliana | None | 0 | 0 |

## Key Findings

1. **Morgan Library Issue**: The "/thumbs" suffix in image URLs is causing 404 errors. This appears to be an incorrect URL pattern.

2. **Graz Timeout Issue**: The University of Graz server is experiencing severe connectivity issues, failing even with a 90-second timeout. Multiple retry attempts with exponential backoff still failed.

3. **Vallicelliana Success**: Despite having the most log entries (5043), Vallicelliana had zero errors. The extended timeout of 39 seconds appears sufficient.

4. **Timeout Configuration**: Libraries have different timeout configurations:
   - Base timeout: 30000ms (30 seconds)
   - Vallicelliana: 39000ms (39 seconds)
   - Graz: 90000ms (90 seconds)

## Recommendations

1. **Morgan Library**: Remove or fix the "/thumbs" suffix in image URLs
2. **University of Graz**: Consider implementing:
   - Longer initial delays between retries
   - Alternative server endpoints if available
   - User notification about known server issues
3. **Error Handling**: Add specific error messages for common patterns like 404s on thumbnail URLs