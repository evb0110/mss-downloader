# Library Validation Protocol - Complete Guide

## Mandatory Steps (except in `/handle-issues` workflow)

1. **MAXIMUM RESOLUTION TESTING:** Test ALL IIIF parameters (full/full, full/max, full/2000, full/4000) - users MUST get highest quality
2. Download 10 different pages using HIGHEST resolution found
3. Verify DIFFERENT manuscript content on each page (not stuck on page 1)
4. Merge to PDF and validate with poppler

## Claude Must Inspect Before Showing User

**MANDATORY verification:**
- File size with `ls -la` (0-byte = failure)
- PDF structure with `pdfimages -list`
- Visual content with `pdfimages -png` + Read tool
- DIFFERENT pages (no duplicates)
- NO "Preview non disponibile" or auth errors
- Rate result: ["failed", "something not ok", "ok"]

## User Validation Folder

- **Create SINGLE clean:** `.devkit/validation/READY-FOR-USER/` with ONLY final PDFs
- **VERSION BUMP:** User saying "bump" or "approved" IS the approval - execute full workflow immediately

## Auto-Split Configuration - Critical for Large Manuscripts

**MANDATORY: All libraries MUST be included in auto-split logic to prevent download failures**

**Location:** `src/main/services/EnhancedDownloadQueue.ts` lines 1354-1403

### When adding a new library:
1. Add library name to `estimatedSizeLibraries` array (line 1356-1363)
2. Add page size estimation in `avgPageSizeMB` calculation (lines 1368-1403)
3. Use realistic estimates based on library's typical resolution:
   - High-res archives (Parker, Roman Archive): 2.0-2.2 MB/page
   - Major libraries (BL, LoC, Bodleian): 1.2-1.5 MB/page  
   - Standard IIIF libraries: 0.6-1.0 MB/page
   - Mobile/compressed: 0.3-0.5 MB/page

### Why this matters:
- Without auto-split: Downloads fail for manuscripts > 300MB
- Users see: 800MB single downloads that crash (Mac) or 1.5MB incomplete files (Windows)
- With auto-split: Large manuscripts split into 30MB chunks that download reliably

**Common mistake:** Forgetting to add new libraries causes catastrophic download failures