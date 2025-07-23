# Project TODOs

## High Priority Issues

### 1. Library Search Bar Not Visible
**Task:** FIX: Library search component not rendering in localhost
**Issue:** Code is implemented but user reports search bar is not showing up in the application
**Status:** Pending
**Priority:** High

**Investigation needed:**
- Check if development server needs restart
- Verify component is being rendered properly  
- Test search functionality works as expected
- Confirm no JavaScript errors are preventing render

### 2. Verify Search Bar Functionality
**Task:** FIX: Ensure library search bar is properly rendered and functional
**Issue:** Need to complete proper testing and verification of search implementation
**Status:** Pending
**Priority:** High

### 3. Library of Congress Download Stuck Issue
**Task:** DEBUG: Library of Congress stuck download issue - https://www.loc.gov/item/2010414164/
**Issue:** Library of Congress got stuck in the middle, couldn't finish downloading files
**Status:** Pending
**Priority:** High
**URL:** https://www.loc.gov/item/2010414164/

**Investigation needed:**
- Analyze why download process gets stuck mid-way
- Devise intelligent debugging approach for validation
- Test with specific manuscript URL provided
- Implement robust error handling and retry mechanisms

### 4. Florence CDM Timeout Issue
**Task:** FIX: Florence CDM timeout issue - https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/
**Issue:** connect ETIMEDOUT 193.240.184.109:443
**Status:** Pending
**Priority:** High

### 5. Grenoble DNS Resolution Error
**Task:** FIX: Grenoble DNS resolution error - https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom
**Issue:** getaddrinfo ENOTFOUND pagella.bm-grenoble.fr
**Status:** Pending
**Priority:** High

### 6. MDC Catalonia Timeout Issue
**Task:** FIX: MDC Catalonia timeout issue - https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1
**Issue:** connect ETIMEDOUT 193.240.184.109:443
**Status:** Pending
**Priority:** High

### 7. BNE Spain Hanging on Calculation
**Task:** FIX: BNE Spain hanging on calculation - https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1
**Issue:** висит на калькуляции (hangs on calculation)
**Status:** Pending
**Priority:** High

### 8. NBM Italy Undefined Error
**Task:** FIX: NBM Italy undefined error - https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15
**Issue:** Cannot read properties of undefined (reading 'replace')
**Status:** Pending
**Priority:** High

### 9. BDL DNS Resolution Error
**Task:** FIX: BDL DNS resolution error - https://www.bdl.servizirl.it/vufind/Record/BDL-OGGETTO-3903
**Issue:** getaddrinfo ENOTFOUND www.bdl.servizirl.it
**Status:** Pending
**Priority:** High

### 10. Vienna Manuscripta Hanging Midway
**Task:** FIX: Vienna Manuscripta hanging midway - https://manuscripta.at/diglit/AT5000-71/0001
**Issue:** по-прежнему висит на середине, видимо, блок с их стороны (still hangs midway, apparently blocked on their side)
**Status:** Pending
**Priority:** High

### 11. University of Graz Timeout
**Task:** FIX: University of Graz timeout - https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688
**Issue:** University of Graz request timed out. Large manuscripts may take longer to load
**Status:** Pending
**Priority:** High

---

## Notes

- Library search implementation exists in code but needs verification
- Version 1.4.19 was released prematurely without proper testing
- Need to ensure all features work before marking as complete
- Development environment is clean and organized
- Belgica KBR remains documented as unsupported (requires complex implementation)