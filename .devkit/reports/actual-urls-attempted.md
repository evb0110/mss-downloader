# Actual URLs Attempted - Log Analysis Report

## Summary

Analyzed 9 log files from `/Users/e.barsky/Desktop/To/` to extract attempted download URLs and patterns.

Key finding: **NO PDF creation messages found in any log files**, despite many successful manifest loads and image downloads.

## Libraries and URLs Attempted

### 1. Düsseldorf (digital.ulb.hhu.de)
**URLs attempted:**
- `https://digital.ulb.hhu.de/ms/content/titleinfo/7674176` (3 attempts)
- `https://digital.ulb.hhu.de/ms/content/pageview/7674177` (2 attempts) 
- `https://digital.ulb.hhu.de/i3f/v20/7674176/manifest` (2 attempts)

**Status:** "Starting manifest load" logged but NO subsequent PDF creation

### 2. Vallicelliana
**URLs attempted:**
- `https://omnes.dbseret.com/vallicelliana/iiif/IT-RM0281_D5/manifest` (1 attempt)
- `https://jmms.iccu.sbn.it/jmms/metadata/VFdGblZHVmpZU0F0SUVsRFExVV8_/b2FpOnd3dy5pbnRlcm5ldGN1bHR1cmFsZS5zYm4uaXQvVGVjYToyMDpOVDAwMDA6TjpDTk1EMDAwMDI4MTkxMw__/manifest.json` (successful manifest load, image downloads started)

**Status:** Manifest loaded successfully, images downloaded, but NO PDF creation

### 3. ContentDM
**URLs attempted:**
- `https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/` (3 attempts)

**Status:** "Starting manifest load" but NO subsequent activity

### 4. Grenoble (pagella.bm-grenoble.fr)
**URLs attempted:**
- `https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom` (2 attempts)

**Status:** "Starting manifest load" but NO subsequent activity

### 5. Library of Congress (LOC)
**URLs attempted:**
- `https://www.loc.gov/item/2021667775/` (3 separate sessions)

**Status:** Full successful download sequence:
- Manifest loaded successfully (446 pages)
- Multiple images downloaded with buffer sizes (2-3MB each)
- BUT no PDF creation message found

### 6. Morgan Library
**URLs attempted:**
- `https://www.themorgan.org/sites/default/files/images/collection/76874v_0004_0005.jpg` (2 attempts)
- `https://host.themorgan.org/facsimile/m1/default.asp?id=1&width=100%25&height=100%25&iframe=true` (2 attempts)

**Status:** 
- First URL: 404 Not Found errors
- Second URL: "Starting manifest load" but no further activity

### 7. Verona (nuovabibliotecamanoscritta.it)
**URLs attempted:**
- `https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15`

**Status:** Error - "Cannot read properties of undefined (reading 'replace')"

### 8. University of Graz
**URLs attempted:**
- `https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688`
- `https://unipub.uni-graz.at/i3f/v20/5892688/manifest`

**Status:** Connection timeout after 90 seconds, server not responding

### 9. Other Libraries
- BDL Lombardia: `https://www.bdl.servizirl.it/vufind/Record/BDL-OGGETTO-3903`
- KBR Belgium: `https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415`
- ICCU Manus: Various URLs including search results and detail pages

## Patterns Observed

### Downloads That Started But Had No PDF Output:
1. **LOC downloads** - Complete download sequence with multiple images (2-3MB each) successfully downloaded, but no PDF creation logged
2. **Vallicelliana** - Manifest loaded, images started downloading, but no PDF creation
3. **Most other libraries** - Only got to "Starting manifest load" phase

### Error Patterns:
1. **Verona** - Consistent "Cannot read properties of undefined" errors
2. **Graz** - Consistent timeout errors (90 seconds)
3. **Morgan** - 404 errors for direct image URLs

### Missing Final Steps:
The logs show successful:
- Manifest loading
- Image downloading (with file sizes)
- Buffer downloads

But completely missing:
- PDF creation messages
- Merge operations
- Final output notifications

## Conclusion

Users are attempting to download from multiple libraries, and while manifest loading and image downloading appear to work for some (especially LOC), the final PDF creation step is either:
1. Not happening at all
2. Not being logged properly
3. Failing silently without error messages

This suggests a critical issue in the PDF creation/merge phase of the application that needs investigation.