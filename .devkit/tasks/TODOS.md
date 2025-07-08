# Project TODOs

## High Priority Library Fixes

### 1. BNE Library Hanging on Calculation
**URL:** https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1  
**Issue:** System hangs during page calculation phase  
**Status:** Pending  
**Priority:** High  

### 2. Internet Culturale Incomplete Downloads
**URL:** https://dam.iccu.sbn.it/mol_46/containers/avQYk0e/manifest  
**Issue:** Only downloading 2 pages instead of full manuscript  
**Status:** Pending  
**Priority:** High  

### 3. Verona Library Request Timeout
**URL:** https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15  
**Issue:** Getting timeout during manuscript loading  
**Error:** `Error invoking remote method 'parse-manuscript-url': Error: Failed to load Verona manuscript: Request timeout`  
**Status:** Pending  
**Priority:** High  

### 4. MDC Catalonia Fetch Failed
**URL:** https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1  
**Issue:** Network request is failing during manuscript loading  
**Error:** `Error invoking remote method 'parse-manuscript-url': Error: Failed to load MDC Catalonia manuscript: fetch failed`  
**Status:** Pending  
**Priority:** High  

### 5. Belgica KBR Image Pattern Detection
**URL:** https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415  
**Issue:** System cannot detect image URLs, may need updated viewer system support  
**Error:** `Error invoking remote method 'parse-manuscript-url': Error: Failed to load Belgica KBR manuscript: Could not find any working image patterns for this manuscript. The document may have access restrictions or use an unsupported viewer system.`  
**Status:** Pending  
**Priority:** High  

### 6. Rouen Library Page Count Determination
**URL:** https://www.rotomagus.fr/ark:/12148/btv1b10052442z/f1.item.zoom  
**Issue:** Cannot determine total pages in manuscript  
**Error:** `Error invoking remote method 'parse-manuscript-url': Error: Failed to load Rouen manuscript: Could not determine page count for Rouen manuscript`  
**Status:** Pending  
**Priority:** High  

### 7. Grenoble Library IIIF Manifest Loading
**URL:** https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom  
**Issue:** IIIF manifest fetch is failing  
**Error:** `Error invoking remote method 'parse-manuscript-url': Error: Failed to load Grenoble manuscript: Failed to load IIIF manifest: fetch failed`  
**Status:** Pending  
**Priority:** High  

## Medium Priority Enhancements

### 8. University of Toronto Library Support
**URL:** https://collections.library.utoronto.ca/view/fisher2:F6521  
**Issue:** Currently unsupported library, needs full implementation  
**Error:** `Error invoking remote method 'parse-manuscript-url': Error: Unsupported library for URL: https://collections.library.utoronto.ca/view/fisher2:F6521`  
**Status:** Pending  
**Priority:** Medium  

### 9. Karlsruhe Library Resolution Enhancement
**Current Issue:** Downloading low resolution images  
**Enhancement:** Investigate higher resolution options:
- IIIF manifest: https://digital.blb-karlsruhe.de/i3f/v20/192435/manifest  
- Direct access: https://digital.blb-karlsruhe.de/blbhs/content/pageview/221207  
**Status:** Pending  
**Priority:** Medium  

## Process Tasks

### 10. Validation Protocol Execution
**Task:** Run comprehensive validation protocol for all fixed libraries  
**Requirements:**
- Test maximum resolution for each library
- Create validation PDFs with 10+ pages
- Verify content quality according to CLAUDE.md requirements
- Ensure no duplicate pages or error content
**Status:** Pending  
**Priority:** High  

### 11. Version Bump After Fixes
**Task:** Version bump after all library fixes are completed and validated  
**Process:**
- Wait for user approval after validation
- Update package.json version
- Commit changes with detailed changelog
- Push to GitHub to trigger build and telegram notifications
**Status:** Pending  
**Priority:** Low  

---

## Notes

- All tasks require thorough testing before completion
- Maximum resolution testing is mandatory for each library fix
- User validation required before version bump
- Follow CLAUDE.md validation protocol strictly