# Logging Methodology - Meaningful Implementation

## Core Principle

**MANDATORY: All logs must answer WHO/WHAT/WHERE/WHEN/WHY/HOW**

**Location:** `src/main/services/EnhancedLogger.ts`

## Bad vs Good Logging Examples

### BAD logging (current state):
```
[INFO] Download started
[INFO] Download completed
```

### GOOD logging (required):
```
[QUEUE] Adding Roman Archive: Lectionarium Novum (383 pages, ~843MB, will split into 28 parts)
[MANIFEST] Roman Archive: Found 383 pages via HTML parsing in 0.4s
[DOWNLOAD] Starting Roman Archive - Part 1/28 (pages 1-14) (~30.1MB)
[PROGRESS] Roman Archive - Part 1/28: 50% (7/14 pages, 15.4MB, 1.2MB/s, ETA 6s)
[ERROR] Roman Archive - Part 2/28: SocketError after 5.2s, retrying (attempt 2/11)
[SUCCESS] Roman Archive - Part 1/28 complete: 30.1MB in 25.3s (1.2MB/s)
[COMPLETE] Roman Archive: 383 pages (841.7MB) in 12m 34s (1.1MB/s, 3 retries)
```

## Required Information in Logs

- Library name and manuscript ID
- Total pages and size
- Chunk information (current/total)
- Progress percentage and speed
- Error details with retry info
- Duration and performance metrics

**Common mistake:** Using console.log('Download started') instead of enhancedLogger