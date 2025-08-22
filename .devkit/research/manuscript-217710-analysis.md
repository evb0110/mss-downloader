# Florence Manuscript 217710 Analysis - Size Limit Investigation

## Executive Summary

**CRITICAL FINDING:** Florence IIIF server has a **strict size limit around 4200px width**. The current implementation uses 6000px width, causing 403 Forbidden errors.

## Target Manuscript Details

- **URL:** https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/217710/rec/2
- **Title:** Calendarium
- **Date:** 801-810 CE
- **Collection:** Plutei (Biblioteca Medicea Laurenziana)
- **Format:** membr. ; 150 x 205 mm ; 99 cc.
- **Identifier:** IT:FI0100_Plutei_16.39

## IIIF Manifest Analysis

### Main Page (217710)
- **Dimensions:** 2068 × 2620 pixels
- **Available Sizes:** 65×82, 129×164, 259×328, 517×655, 1034×1310, 2068×2620
- **Max Area:** 10,836,320 pixels
- **Tile Config:** 512×512 with scale factors 1,2,4,8,16,32

### Related Page (217706) - The Failing URL
- **Dimensions:** 2112 × 2652 pixels  
- **Available Sizes:** 66×83, 132×166, 264×332, 528×663, 1056×1326, 2112×2652
- **Max Area:** 11,202,048 pixels
- **Tile Config:** 512×512 with scale factors 1,2,4,8,16,32

## Size Limit Testing Results

### Page 217706 Testing
- ✅ **2112px** (full resolution) - WORKS
- ✅ **3000px** - WORKS  
- ✅ **4000px** - WORKS
- ✅ **4200px** - WORKS
- ❌ **4300px** - 403 Forbidden
- ❌ **4500px** - 403 Forbidden
- ❌ **5000px** - 403 Forbidden
- ❌ **6000px** - 403 Forbidden (current implementation)

**EXACT LIMIT: Between 4200px and 4300px width**

### Page 217708 Testing  
- ✅ **4000px** - WORKS
- ✅ **4100px** - WORKS  
- ❌ **4150px** - 403 Forbidden
- ❌ **4200px** - 403 Forbidden

**EXACT LIMIT: Between 4100px and 4150px width**

## URL Structure Analysis

**Critical Pattern Discovery:** The manuscript URL structure shows ID transformation:
- Original manuscript URL: `/id/217710` 
- Individual page URLs: `/plutei:217706`, `/plutei:217708`, etc.
- Pattern: The main compound object ID (217710) contains child pages with different IDs

## Current Implementation Problems

### SharedManifestLoaders.ts (Line ~2340)
```typescript
// PROBLEMATIC CODE - Uses 6000px width
url: `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${page.id}/full/6000,/0/default.jpg`,
```

### FlorenceLoader.ts (Line ~180)  
```typescript
// PROBLEMATIC CODE - Uses 6000px width
return `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${page.id}/full/6000,/0/default.jpg`;
```

## Size Limit Variability

**CRITICAL INSIGHT:** Size limits vary by individual page/image, not manuscript:
- Some pages support up to 4200px
- Other pages only support up to 4100px
- No page supports the current 6000px setting

## Comparison with Other Florence Manuscripts

The problem affects **ALL Florence manuscripts** using the current implementation because:
1. All use the same 6000px width parameter
2. Florence IIIF server enforces strict per-image size limits
3. Limits vary by individual image dimensions and server policies

## Recommended Solutions

### Option 1: Conservative Safe Limit (RECOMMENDED)
Use **4000px width** for all Florence manuscripts:
```typescript
url: `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${page.id}/full/4000,/0/default.jpg`
```

**Pros:**
- Works for all tested pages
- Simple implementation
- Prevents 403 errors
- Still provides high resolution (2x larger than native in many cases)

**Cons:** 
- Not the absolute maximum possible for some pages

### Option 2: Dynamic Size Detection
Implement progressive size detection:
1. Try 4200px width
2. If 403, fallback to 4000px
3. If still 403, fallback to full native resolution

**Pros:**
- Maximum resolution when possible
- Graceful fallback

**Cons:**
- More complex implementation
- Additional HTTP requests
- Slower download initialization

### Option 3: Native Resolution Only
Use the IIIF info.json sizes to request full native resolution:
```typescript
url: `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${page.id}/full/full/0/default.jpg`
```

**Pros:**
- Guaranteed to work
- No size limit issues

**Cons:**
- Lower resolution than possible
- May not utilize available upscaling

## Impact Assessment

**Affected Files:**
- `/src/shared/SharedManifestLoaders.ts` - getFlorenceManifest() method
- `/src/main/services/library-loaders/FlorenceLoader.ts` - loadManifest() method

**Affected Users:**
- All Florence manuscript downloads currently fail with 403 errors
- Users see "unfixable" downloads due to systematic size limit violation

## Implementation Priority

**URGENT - HIGH PRIORITY**
This is a systematic failure affecting all Florence manuscripts. Users cannot download any Florence manuscripts with the current implementation.

**Recommended Immediate Action:**
1. Change width parameter from 6000 to 4000 in both files
2. Test with manuscript 217710 to verify fix
3. Version bump with clear changelog about Florence resolution fix

## Test URLs for Validation

After implementing fix, test these specific URLs:
- https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/217710/rec/2
- Various pages: plutei:217706, plutei:217708, plutei:217710

Expected behavior: All pages should download successfully without 403 errors.