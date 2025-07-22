# Systematic Fix Plan for 7 Broken Libraries

## 🎯 Priority Fix Order (Easiest to Hardest)

### 1. **BDL Servizirl** - Priority: HIGH
**Issue**: 404 error on manifest fetch
**Error**: `Failed to fetch manifest: 404`
**Test URL**: `https://www.bdl.servizirl.it/vufind/Record/BDL-OGGETTO-3903`

**Fix Strategy**: 
- Investigate new URL format change
- Check if API endpoint has moved
- Update URL extraction logic
- Verify vufind integration is still valid

**Expected Effort**: Low (likely URL pattern fix)

---

### 2. **Vienna Manuscripta** - Priority: HIGH  
**Issue**: No image data found in manifest
**Error**: `Could not find image data`
**Test URL**: `https://manuscripta.at/diglit/AT5000-71/0011`

**Fix Strategy**:
- Check IIIF manifest structure changes
- Verify image URL extraction logic
- Update manifest parsing if format changed
- Test with multiple manuscript IDs

**Expected Effort**: Low-Medium (manifest parsing)

---

### 3. **Verona Biblioteca** - Priority: MEDIUM
**Issue**: SSL certificate verification failure
**Error**: `unable to verify the first certificate`
**Test URL**: `https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15`

**Fix Strategy**:
- Already implemented fetchWithHTTPS - check why still failing
- Investigate SSL certificate chain issues
- Add certificate override or retry logic
- Consider user-agent or header requirements

**Expected Effort**: Medium (SSL handling)

---

### 4. **BNE Spain** - Priority: MEDIUM
**Issue**: SSL certificate verification failure  
**Error**: `unable to verify the first certificate`
**Test URL**: `https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1`

**Fix Strategy**:
- Similar to Verona - SSL certificate chain issues
- Verify fetchWithHTTPS implementation for BNE
- Check if headers/referrer requirements changed
- Test with different user agents

**Expected Effort**: Medium (SSL + possible auth changes)

---

### 5. **Florence (Internet Culturale)** - Priority: MEDIUM
**Issue**: No images found in manifest
**Error**: `No images found in manifest`
**Test URL**: `https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515`

**Fix Strategy**:
- Check ContentDM API changes
- Verify image URL extraction from metadata
- Update manifest parsing for new format
- Test image accessibility after extraction

**Expected Effort**: Medium (API format changes)

---

### 6. **MDC Catalonia** - Priority: LOW
**Issue**: Cannot find IIIF manifest URL
**Error**: `Could not find IIIF manifest URL`
**Test URL**: `https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1`

**Fix Strategy**:
- Investigate page structure changes
- Check if IIIF integration was removed
- Look for alternative download methods
- May require complete reimplementation

**Expected Effort**: High (possible major changes)

---

### 7. **Grenoble** - Priority: LOW
**Issue**: DNS resolution failure
**Error**: `getaddrinfo ENOTFOUND bm-grenoble.mediatheque-numerique.fr`
**Test URL**: `https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom`

**Fix Strategy**:
- DNS pre-resolution already implemented - check why failing
- Verify if domain changed or service discontinued
- Check for redirects or service migration
- May require finding new endpoint or service unavailable

**Expected Effort**: High (possible service discontinuation)

---

## 🔧 Implementation Strategy

### Phase 1: Quick Wins (BDL, Vienna Manuscripta)
- Focus on likely URL/manifest parsing issues
- Should be fixable with code adjustments
- High impact, low effort

### Phase 2: SSL Issues (Verona, BNE Spain)  
- Systematic SSL certificate handling
- May require library-specific workarounds
- Medium effort, medium impact

### Phase 3: Complex Issues (Florence, MDC, Grenoble)
- Deep investigation of service changes
- May require architectural changes or write-offs
- High effort, uncertain outcomes

## 📊 Success Metrics

**Target**: Fix at least 4-5 out of 7 libraries
- Phase 1: 2 libraries (BDL, Vienna) 
- Phase 2: 2 libraries (Verona, BNE)
- Phase 3: 1-2 libraries (best effort)

**Timeline**: ~2-3 hours per library for investigation + fixes