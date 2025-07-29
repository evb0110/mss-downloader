# MSS Downloader - Issue Validation Report

**Date:** 2025-07-29T07:20:45.309Z

**Overall Result:** 0/10 tests passed (0.0%)

## Summary by Issue

### Issue #1 - Düsseldorf (HHU)

**Status:** ❌ FAILING

**Original Problem:** JSON parsing errors

**Test Results:**

- ❌ https://digital.ub.uni-duesseldorf.de/content/titleinfo/7938251
  - Error: HHU manuscript not found: 7938251. Please verify the URL is correct.
- ❌ https://digital.ub.uni-duesseldorf.de/hs/content/titleinfo/259994
  - Error: HHU manuscript not found: 259994. Please verify the URL is correct.

### Issue #2 - University of Graz

**Status:** ❌ FAILING

**Original Problem:** Timeout errors

**Test Results:**

- ❌ https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538
  - Error: Command failed: img2pdf /home/evb/WebstormProjects/mss-downloader/.devkit/validation/issue-2-test/page-001.jpg /home/evb/WebstormProjects/mss-downloader/.devkit/validation/issue-2-test/page-002.jpg /home/evb/WebstormProjects/mss-downloader/.devkit/validation/issue-2-test/page-003.jpg /home/evb/WebstormProjects/mss-downloader/.devkit/validation/issue-2-test/page-004.jpg /home/evb/WebstormProjects/mss-downloader/.devkit/validation/issue-2-test/page-005.jpg -o "/home/evb/WebstormProjects/mss-downloader/.devkit/validation/issue-2-test/issue-2-test.pdf"
/bin/sh: 1: img2pdf: not found

- ❌ https://unipub.uni-graz.at/obvugrscript/content/pageview/8191388
  - Error: Failed to fetch Graz manifest: 404 Not Found

### Issue #3 - Verona NBM

**Status:** ❌ FAILING

**Original Problem:** Large manuscript timeouts

**Test Results:**

- ❌ https://www.nuovabibliotecamanoscritta.it/catalogo/item/padova-biblioteca-universitaria-ms-550
  - Error: Invalid Verona URL - no codice parameter found
- ❌ https://nuovabibliotecamanoscritta.it/catalogo/item/verona-biblioteca-civica-ms-1945
  - Error: Invalid Verona URL - no codice parameter found

### Issue #4 - Morgan Library

**Status:** ❌ FAILING

**Original Problem:** Single page extraction

**Test Results:**

- ❌ https://www.themorgan.org/collection/treasures-of-islamic-manuscript-painting/1
  - Error: No images found on Morgan Library page
- ❌ https://ica.themorgan.org/manuscript/thumbs/142852
  - Error: No images found on Morgan Library page

### Issue #5 - Florence ContentDM

**Status:** ❌ FAILING

**Original Problem:** JavaScript errors and loading

**Test Results:**

- ❌ https://teca.bmlonline.it/digital/collection/plutei/id/272
  - Error: getaddrinfo EAI_AGAIN teca.bmlonline.it
- ❌ https://teca.bmlonline.it/digital/collection/plutei/id/26925
  - Error: getaddrinfo EAI_AGAIN teca.bmlonline.it

