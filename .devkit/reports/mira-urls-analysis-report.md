# MIRA URLs Analysis Report

## Testing Results

### ✅ Working URL
- **https://www.mira.ie/105** - Successfully downloads "Stowe Missal" from Royal Irish Academy

### ❌ Blocked URLs  
- **https://www.mira.ie/98** - Blocked by Trinity College Dublin security
- **https://www.mira.ie/107** - Blocked by Trinity College Dublin security
- **https://digitalcollections.tcd.ie/concern/works/2801pk96j** - Direct Trinity College Dublin URL (also blocked)

## Why Only These Two Need CAPTCHA

MIRA (Manuscript, Inscription and Realia Archive) is a portal that displays manuscripts from different Irish institutions. Each MIRA item actually points to a manuscript housed at a specific library:

- **MIRA 105** → Royal Irish Academy → ✅ **Open Access**
- **MIRA 98** → Trinity College Dublin → ❌ **CAPTCHA Protected** 
- **MIRA 107** → Trinity College Dublin → ❌ **CAPTCHA Protected**

**Trinity College Dublin** specifically implemented aggressive anti-bot protection (reCAPTCHA) on their digital collections to prevent automated downloading. This security measure requires human verification before accessing any manuscript.

**Royal Irish Academy** and other institutions use the ISOS (Irish Script on Screen) system which allows programmatic access for research purposes.

## Recommendation

MIRA URLs that point to Trinity College Dublin manuscripts cannot be downloaded automatically due to their security policies. Users should:

1. Use MIRA URLs that point to other institutions (like Royal Irish Academy)
2. For Trinity Dublin manuscripts, download manually through their website
3. Check the institution listed on the MIRA page before attempting automated download

## Status: Fixed ✅

Enhanced error handling now clearly identifies which institution is blocking access and provides specific guidance for each case.