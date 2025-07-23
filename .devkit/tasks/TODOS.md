# Project TODOs

## High Priority Issues

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
**Issue:** Error invoking remote method 'parse-manuscript-url': Error: Failed to load Florence manuscript: connect ETIMEDOUT 193.240.184.109:443
**Status:** Pending
**Priority:** High

**Context:**
- Florence library was previously working in v1.4.28
- This appears to be a new manuscript URL that times out
- Server IP 193.240.184.109 is not responding
- May need to investigate if Florence changed their infrastructure

### 5. Grenoble DNS Resolution Error
**Task:** FIX: Grenoble DNS resolution error - https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom
**Issue:** Error invoking remote method 'parse-manuscript-url': Error: getaddrinfo ENOTFOUND pagella.bm-grenoble.fr
**Status:** Pending
**Priority:** High

**Context:**
- Grenoble library was previously working in v1.4.29 with SSL bypass
- DNS is failing to resolve pagella.bm-grenoble.fr domain
- This is a different URL pattern than previously tested
- May need to check if Grenoble changed their domain or if this is a different subdomain

### 6. MDC Catalonia Timeout Issue
**Task:** FIX: MDC Catalonia timeout issue - https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1
**Issue:** Error invoking remote method 'parse-manuscript-url': Error: connect ETIMEDOUT 193.240.184.109:443
**Status:** Pending
**Priority:** High

**Context:**
- MDC Catalonia was previously working in v1.4.27
- This is a different collection (incunableBC) than previously tested
- Same IP timeout as Florence (193.240.184.109) - suggests shared infrastructure issue
- May indicate MDC and Florence share ContentDM hosting that's currently down

### 7. BNE Spain Hanging on Calculation
**Task:** FIX: BNE Spain hanging on calculation - https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1
**Issue:** висит на калькуляции (hangs on calculation)
**Status:** Pending
**Priority:** High

**Context:**
- BNE Spain was previously working in v1.4.25 with SSL bypass
- Application hangs during "calculation" phase
- This suggests the manifest parsing or page calculation logic is stuck
- May be related to changes in BNE's manifest structure or very large manuscripts

### 8. NBM Italy Undefined Error
**Task:** FIX: NBM Italy undefined error - https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15
**Issue:** Cannot read properties of undefined (reading 'replace')
**Status:** Pending
**Priority:** High

**Context:**
- This is a new library (Nuova Biblioteca Manoscritta) not previously implemented
- Error suggests code is trying to call .replace() on undefined value
- Likely occurring during URL parsing or manifest extraction
- Need to implement support for this Italian manuscript library

### 9. BDL DNS Resolution Error
**Task:** FIX: BDL DNS resolution error - https://www.bdl.servizirl.it/vufind/Record/BDL-OGGETTO-3903
**Issue:** Error invoking remote method 'parse-manuscript-url': Error: getaddrinfo ENOTFOUND www.bdl.servizirl.it
**Status:** Pending
**Priority:** High

**Context:**
- BDL was previously working in v1.4.26
- DNS cannot resolve www.bdl.servizirl.it domain
- This is a different URL pattern (vufind/Record) than previously tested
- May indicate BDL changed their infrastructure or this is a different system

### 10. Vienna Manuscripta Hanging Midway
**Task:** FIX: Vienna Manuscripta hanging midway - https://manuscripta.at/diglit/AT5000-71/0001
**Issue:** по-прежнему висит на середине, видимо, блок с их стороны (still hangs midway, apparently blocked on their side)
**Status:** Pending
**Priority:** High

**Context:**
- Vienna Manuscripta was previously working in v1.4.23
- Download process hangs midway through
- User suspects server-side blocking ("блок с их стороны")
- May need to implement rate limiting or different request headers
- Could be anti-bot protection triggered by too many requests

### 11. University of Graz Timeout
**Task:** FIX: University of Graz timeout - https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688
**Issue:** Error invoking remote method 'parse-manuscript-url': Error: University of Graz request timed out. Large manuscripts may take longer to load
**Status:** Pending
**Priority:** High

**Context:**
- Graz was previously working in v1.4.21 with enhanced timeout handling
- Despite previous fixes for ETIMEDOUT, this manuscript still times out
- Message suggests it's a particularly large manuscript
- May need even longer timeouts or different approach for very large manuscripts
- Previous fix used 120s timeout with 5 retry attempts

---

## Notes

- Library search implementation exists in code but needs verification
- Version 1.4.19 was released prematurely without proper testing
- Need to ensure all features work before marking as complete
- Development environment is clean and organized
- Belgica KBR remains documented as unsupported (requires complex implementation)