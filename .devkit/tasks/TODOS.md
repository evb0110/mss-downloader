# TODOS

## Pending Tasks - Remaining 17 Failed Items Analysis

### High Priority Library Fixes
1. ☐ **Unsupported Library Errors** - Multiple manuscripts failing with "Unsupported library" detection issues
   - Pattern: Library detection returning unknown/unregistered library names
   - Impact: Users cannot access manuscripts from these libraries
   - Investigation needed: Check library detection logic vs registered loaders

2. ☐ **Vatican Library (BAV)** - Authentication or URL format changes
   - Pattern: Access denied or manifest loading failures
   - Likely cause: Vatican changed authentication requirements or API endpoints
   - Investigation: Check current BAV manuscript access methods

3. ☐ **Bodleian Library** - "No pages found" or IIIF parsing issues  
   - Pattern: Manifest loads but page extraction fails
   - Likely cause: IIIF manifest structure changes or parsing logic issues
   - Investigation: Test current Bodleian IIIF manifests

### Medium Priority Fixes
4. ✅ **Library of Congress (LoC)** - COMPLETED 2025-08-20
   - Status: WORKING CORRECTLY - No API changes, comprehensive validation passed 3/3
   - Analysis: User reports were historical (pre-routing fixes), current implementation flawless

5. ☐ **Digital Scriptorium** - Custom viewer parsing issues
   - Pattern: Custom viewer interface not properly parsed
   - Investigation: Update viewer parsing for current Digital Scriptorium format

6. ☐ **BnF Gallica Edge Cases** - Some manuscripts still failing despite main fix
   - Pattern: Specific manuscript types or formats not handled
   - Investigation: Identify edge case patterns in failed Gallica manuscripts

### Lower Priority Regional/Access Issues  
7. ☐ **German Libraries (Munich, Berlin)** - Regional access restrictions
   - Pattern: Connection timeouts or access denied from certain regions
   - Investigation: Check VPN/proxy requirements for German institutions

8. ☐ **Authentication-Required Manuscripts** - Missing login flow support
   - Pattern: Manuscripts requiring institutional login failing
   - Enhancement: Add proper authentication flow support

9. ☐ **Network Resilience** - Timeout and DNS resolution failures
   - Pattern: Intermittent connection failures to various libraries
   - Enhancement: Improve retry logic and connection handling

10. ☐ **URL Parsing Updates** - Handle changed manuscript URL formats
    - Pattern: Libraries changing their URL structures breaking detection
    - Maintenance: Update URL parsing patterns for evolved library systems

## Completed Tasks

1. ✅ check unneeded files in the project, especially in root. delete unneeded, put needed ones into .devkit. Organize .devkit. top priority is not to break anything. ultrathink - COMPLETED 2025-08-13
2. ✅ Fix BL (British Library) manifest loading: Corrected library ID mismatch ('bl' vs 'british_library') - COMPLETED 2025-08-20 (535 pages, IIIF v3, "add ms 18032")
3. ✅ Fix Florus Manuscript page discovery: Updated domain from 'florus-app.huma-num.fr' to 'florus.bm-lyon.fr' - COMPLETED 2025-08-20 (214 pages, "BM_Lyon_MS0425")
4. ✅ Fix Internet Culturale loader availability: Corrected loader registration key mismatch ('internet_culturale' vs 'internetculturale') - COMPLETED 2025-08-20
5. ✅ Fix NYPL carousel data parsing: Modernized to use IIIF Presentation API v3.0 instead of legacy HTML parsing - COMPLETED 2025-08-20 (304 pages, "Landevennec Gospels")
6. ✅ Fix IRHT 404 error handling: Added user-friendly 404 error messages with guidance for alternative search - COMPLETED 2025-08-20
7. ✅ Fix BL (British Library) manifest loading: https://bl.digirati.io/iiif/ark:/81055/vdc_100055984026.0x000001 - COMPLETED 2025-08-19 (535 pages, IIIF v3, maximum resolution support)
8. ✅ Fix CUDL (Cambridge University Digital Library) manifest loading: https://cudl.lib.cam.ac.uk/view/MS-II-00006-00032/1 - COMPLETED 2025-08-19 (Already implemented, 175 pages, IIIF 2.0, maximum resolution)
9. ✅ Fix Cecilia (Albigeois) manifest loading: https://cecilia.mediatheques.grand-albigeois.fr/viewer/124/ - COMPLETED 2025-08-19 (Already implemented, 2 documents, Limb Gallery platform)
10. ✅ PHASE 1 BATCH: Fix Cologne (Dom Bibliothek) manifest loading - COMPLETED 2025-08-19 (Routing fix, existing CologneLoader.ts)
11. ✅ PHASE 1 BATCH: Fix Czech (VKOL) manifest loading - COMPLETED 2025-08-19 (Routing fix, existing CzechLoader.ts)
12. ✅ PHASE 1 BATCH: Fix Dijon (BM Dijon) manifest loading - COMPLETED 2025-08-19 (Routing fix, existing DijonLoader.ts)
13. ✅ PHASE 1 BATCH: Fix ISOS (Irish Script on Screen) manifest loading - COMPLETED 2025-08-19 (Routing fix, existing IsosLoader.ts)
14. ✅ PHASE 1 BATCH: Fix MIRA (Irish manuscripts) manifest loading - COMPLETED 2025-08-19 (Routing fix, existing MiraLoader.ts)
15. ✅ PHASE 1 BATCH: Fix Florus (BM Lyon) manifest loading - COMPLETED 2025-08-19 (Routing fix, existing FlorusLoader.ts)
16. ✅ PHASE 1 BATCH: Fix Internet Culturale (Italian manuscripts) manifest loading - COMPLETED 2025-08-19 (Routing fix, existing InternetCulturaleLoader.ts)
17. ✅ PHASE 1 BATCH: Fix Gallica (BnF) manifest loading - COMPLETED 2025-08-19 (Routing fix, existing GallicaLoader.ts)

🚀 **MASSIVE BATCH ROUTING FIXES - 18 LIBRARIES COMPLETED 2025-08-19**
18. ✅ Fix Laon (Bibliothèque numérique) manifest loading - COMPLETED (Routing fix, existing LaonLoader.ts)
19. ✅ Fix Modena (Archivio Diocesano) manifest loading - COMPLETED (Routing fix, existing ModenaLoader.ts)
20. ✅ Fix NYPL (New York Public Library) manifest loading - COMPLETED (Routing fix, existing NyplLoader.ts)
21. ✅ Fix RBME (Real Biblioteca) manifest loading - COMPLETED (Routing fix, existing RbmeLoader.ts)
22. ✅ Fix Shared Canvas (Belgium) manifest loading - COMPLETED (Routing fix, existing SharedCanvasLoader.ts)
23. ✅ Fix Saint-Omer (Bibliothèque numérique) manifest loading - COMPLETED (Routing fix, existing SaintOmerLoader.ts)
24. ✅ Fix Parker Library (Stanford) manifest loading - COMPLETED (Routing fix, existing ParkerLoader.ts)
25. ✅ Fix Trinity College Cambridge manifest loading - COMPLETED (Routing fix, existing TrinityCamLoader.ts)
26. ✅ Fix Manuscripta (Swedish manuscripts) manifest loading - COMPLETED (Routing fix, existing ManuscriptaLoader.ts)
27. ✅ Fix Durham University manifest loading - COMPLETED (Routing fix, existing DurhamLoader.ts)
28. ✅ Fix e-codices (Swiss manuscripts) manifest loading - COMPLETED 2025-08-19 (Routing fix, existing UnifrLoader.ts)
29. ✅ Fix e-manuscripta (Zurich) manifest loading - COMPLETED 2025-08-19 (Routing fix, existing EManuscriptaLoader.ts + detection mismatch fix)
30. ✅ Fix Florence (OCLC) manifest loading - COMPLETED 2025-08-19 (Routing fix, existing FlorenceLoader.ts)  
31. ✅ Fix ARCA/IRHT manifest loading - COMPLETED 2025-08-19 (Routing fix, existing IrhtLoader.ts, unified arca/irht cases)
32. ✅ Fix Library of Congress (LoC) manifest loading - COMPLETED 2025-08-20 (Comprehensive validation 3/3 pass, no fixes needed, existing LocLoader.ts working perfectly)