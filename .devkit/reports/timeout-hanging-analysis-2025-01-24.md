# Timeout Configuration Analysis - Download Hanging Issues
Date: 2025-01-24

## Executive Summary
Downloads appear to "hang" due to excessive timeout configurations. Some libraries can wait up to 9.75 minutes for a single image download attempt, creating the illusion of a frozen application.

## Problem Details

### 1. Base Timeout Configuration
- **Base timeout**: 30 seconds (configurable via settings)
- **STALL_TIMEOUT**: 30 seconds (detects no data transfer, but only in fetchWithHTTPS)
- **Max retries**: Usually 3 attempts

### 2. Libraries with Excessive Timeouts

| Library | Multiplier | Single Attempt | With Progressive Backoff (4 attempts) |
|---------|------------|----------------|--------------------------------------|
| Trinity Cambridge | 4.0x | 120 seconds | 420 seconds (7 minutes) |
| University of Graz | 3.0x | 90 seconds | 585 seconds (9.75 minutes) |
| Rome National Library | 3.0x | 90 seconds | 585 seconds (9.75 minutes) |
| MDC Catalonia | 3.0x | 90 seconds | 585 seconds (9.75 minutes) |
| Grenoble | 2.5x | 75 seconds | 375 seconds (6.25 minutes) |
| BDL (Lombardy) | 2.5x | 75 seconds | 375 seconds (6.25 minutes) |

### 3. Progressive Backoff Calculation
For libraries with `enableProgressiveBackoff: true`:
```
Attempt 1: baseTimeout × libraryMultiplier × 1.0
Attempt 2: baseTimeout × libraryMultiplier × 1.5
Attempt 3: baseTimeout × libraryMultiplier × 2.0
Attempt 4: baseTimeout × libraryMultiplier × 2.5 (capped at 3.0)
```

### 4. Real-World Impact

#### Scenario: Downloading 50 pages from University of Graz
- Best case (all succeed first try): 50 × 90s = 75 minutes
- Worst case (all require retries): 50 × 585s = 487.5 minutes (8+ hours)
- Even if only 10% fail and retry: 45 × 90s + 5 × 585s = 116.25 minutes (nearly 2 hours)

### 5. Stall Detection Limitations
- STALL_TIMEOUT only applies to libraries using `fetchWithHTTPS`:
  - Verona (nuovabibliotecamanoscritta.it, nbm.regione.veneto.it)
  - Grenoble (pagella.bm-grenoble.fr)
  - Graz (unipub.uni-graz.at)
  - MDC Catalonia (mdc.csuc.cat)
- Other libraries use regular `fetch` without stall detection
- Slow but active connections don't trigger stall timeout

## Root Causes

1. **Over-cautious timeout multipliers**: Set too high to avoid false failures
2. **Progressive backoff compounds the problem**: Makes already-long timeouts even longer
3. **No user feedback during waits**: User can't tell if app is frozen or waiting
4. **Stall detection not universal**: Only some libraries benefit from it

## Recommendations

### Immediate Fixes
1. **Reduce timeout multipliers**:
   - Cap maximum multiplier at 2.0x (60 seconds)
   - Most libraries should use 1.2-1.5x (36-45 seconds)
   
2. **Implement universal stall detection**:
   - Add progress monitoring to all download methods
   - Abort if no data received for 30 seconds

3. **Add user feedback**:
   - Show countdown timer during long waits
   - Display "Waiting for server response..." messages
   - Allow user to cancel/skip slow downloads

### Long-term Improvements
1. **Adaptive timeouts**: Track success rates and adjust timeouts dynamically
2. **Parallel retry strategy**: Start retry attempt while first is still pending
3. **User-configurable library timeouts**: Let users adjust per-library settings
4. **Connection pooling**: Reuse connections to reduce handshake delays

## Technical Details

### Current Timeout Flow
```typescript
// LibraryOptimizationService.ts
timeout = baseTimeout * libraryMultiplier * progressiveBackoffMultiplier

// Example: Graz, attempt 3
timeout = 30000ms * 3.0 * 2.0 = 180,000ms (3 minutes)
```

### Proposed Timeout Flow
```typescript
// Cap multipliers and add stall detection
const maxMultiplier = Math.min(libraryMultiplier, 2.0);
const maxBackoff = Math.min(progressiveBackoffMultiplier, 1.5);
timeout = Math.min(baseTimeout * maxMultiplier * maxBackoff, 90000); // 90s max

// Add universal stall detection
const UNIVERSAL_STALL_TIMEOUT = 30000; // 30 seconds
```

## Affected Libraries
Libraries most impacted by hanging issues:
1. University of Graz - Large IIIF manifests, slow server
2. Trinity Cambridge - Extremely slow server response times
3. Rome National Library - Infrastructure instability
4. MDC Catalonia - Network connectivity issues
5. Grenoble - SSL certificate issues compound delays

## Testing Results
- Graz manifest download: Takes 45-90 seconds on average
- Trinity Cambridge images: 30-120 seconds per image
- Rome server: Frequent timeouts require multiple retries
- User perception: App appears frozen after 30-60 seconds of no feedback

## Conclusion
The current timeout configuration prioritizes avoiding false failures over user experience. This results in extremely long wait times that make the application appear frozen. Implementing the recommended changes would significantly improve perceived performance while maintaining reliability.