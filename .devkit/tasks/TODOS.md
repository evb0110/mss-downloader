# Project TODOs

## Pending Tasks

1. add library https://www.europeana.eu/en/item/446/CNMD_00000171777

## Completed Tasks

✅ **Fix download timeout issue for large manuscripts - InternetCulturale library (2025-06-27)**
   - **Issue:** 842-page manuscript exceeds 45-minute timeout limit
   - **URL:** https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Awww.internetculturale.sbn.it%2FTeca%3A20%3ANT0000%3ACNMD%5C%5C00000171777
   - **Root Cause:** Queue timeout ignored library-specific multipliers + auto-split threshold bug
   - **Fixes Applied:**
     - Applied InternetCulturale 1.5x timeout multiplier (45min → 67.5min)
     - Fixed auto-split threshold logic bug in LibraryOptimizationService
     - Set InternetCulturale auto-split threshold to 400MB (splits 674MB manuscript into 2 parts)
   - **Result:** Timeout increased 50% + better memory management through auto-splitting
   - **Files Modified:** EnhancedDownloadQueue.ts, LibraryOptimizationService.ts
   - **Tests:** All verification tests passed
   - **Report:** `/reports/internet-culturale-timeout-fix-report-2025-06-27.md`
