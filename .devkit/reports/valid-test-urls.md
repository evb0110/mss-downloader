# Valid Test URLs for HHU Düsseldorf and GAMS University of Graz

Generated: 2025-07-28

## HHU Düsseldorf (Heinrich-Heine-Universität)

### URL Patterns
- Standard format: `https://digital.ulb.hhu.de/content/titleinfo/{ID}`
- Manuscript format: `https://digital.ulb.hhu.de/ms/content/titleinfo/{ID}`
- Handschriften format: `https://digital.ub.uni-duesseldorf.de/hs/content/titleinfo/{ID}`
- Alternative domain: `https://digital.ub.uni-duesseldorf.de/content/titleinfo/{ID}`

### Valid Test URLs (Confirmed Working)
1. `https://digital.ulb.hhu.de/ink/content/titleinfo/2310083` - Bonifatius VIII: Liber sextus Decretalium (1476)
2. `https://digital.ulb.hhu.de/ihd/content/titleinfo/10147625` - Oeuvres de Montesquieu (1802)
3. `https://digital.ulb.hhu.de/ulbdsp/periodical/titleinfo/3696736` - Ioannis monachi liber de miraculis (1884)
4. `https://digital.ulb.hhu.de/content/titleinfo/661008` - Basler Chroniken (1915)

### Old Test URLs (No Longer Valid)
- `https://digital.ulb.hhu.de/ms/content/titleinfo/7674176` - Referenced in tests (404)
- `https://digital.ub.uni-duesseldorf.de/content/titleinfo/7938251` - From code comments (404)
- `https://digital.ub.uni-duesseldorf.de/hs/content/titleinfo/259994` - From code comments (404)

### IIIF Manifest Patterns
- Standard: `https://digital.ub.uni-duesseldorf.de/iiif/presentation/v2/{ID}/manifest`
- Handschriften: `https://digital.ub.uni-duesseldorf.de/hs/iiif/presentation/v2/{ID}/manifest`

### Notes
- The library supports both `ulb.hhu.de` and `ub.uni-duesseldorf.de` domains
- Collections include multiple types:
  - `/ms/` - manuscripts
  - `/hs/` - handschriften
  - `/ink/` - incunabula (early printed books)
  - `/ihd/` - historical documents
  - `/ulbdsp/` - special collections
- Uses IIIF v2 manifests with full resolution support
- **Current Implementation Issue**: The SharedManifestLoaders.js implementation only handles `/ms/` and `/hs/` collections, but not `/ink/`, `/ihd/`, or `/ulbdsp/` collections. These additional collection types would need to be added to support the full range of HHU digital materials.

## GAMS University of Graz

### Important Note
There are TWO different Graz systems:
1. **GAMS (gams.uni-graz.at)** - Uses context-based IDs
2. **University Library (unipub.uni-graz.at)** - Uses numeric IDs

### University Library Graz (unipub.uni-graz.at)

#### URL Patterns
- Titleinfo format: `https://unipub.uni-graz.at/obvugrscript/content/titleinfo/{ID}`
- Pageview format: `https://unipub.uni-graz.at/obvugrscript/content/pageview/{ID}`
- IIIF manifest: `https://unipub.uni-graz.at/i3f/v20/{ID}/manifest`

#### Known Valid Test URLs
1. `https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538` - Confirmed working (405 pages)
2. `https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688` - From test files
3. `https://unipub.uni-graz.at/obvugrscript/content/pageview/8224540` - Converts to titleinfo ID 8224538

### GAMS (gams.uni-graz.at) - Context-based System

#### URL Patterns
- Context format: `https://gams.uni-graz.at/context:{CONTEXT_ID}`
- IIIF manifest: `https://gams.uni-graz.at/iiif/context:{CONTEXT_ID}/manifest`

#### Known Context IDs (Not Currently Supported)
1. `https://gams.uni-graz.at/context:rbas.ms.P0008s11` - Test file reference

#### Medieval Cooking Manuscripts (COREMA Collection)
2. `https://gams.uni-graz.at/context:corema.a1`
3. `https://gams.uni-graz.at/context:corema.b1`
4. `https://gams.uni-graz.at/context:corema.b2`
5. `https://gams.uni-graz.at/context:corema.b3`
6. `https://gams.uni-graz.at/context:corema.b4`
7. `https://gams.uni-graz.at/context:corema.br1`
8. `https://gams.uni-graz.at/context:corema.bs1`
9. `https://gams.uni-graz.at/context:corema.db1`
10. `https://gams.uni-graz.at/context:corema.er1`

#### Additional Context IDs Available
- corema.gr1, corema.h2, corema.h3, corema.h4
- corema.ha1, corema.hi1, corema.k1, corema.ka1-ka3
- corema.m1-m11, corema.mi1, corema.n1-n2
- corema.pa1, corema.pr1, corema.sb1-sb3
- corema.st1, corema.ste1, corema.w1-w4
- corema.wo1-wo11, corema.wol1

#### Other Collections
- `https://gams.uni-graz.at/context:glossvibe` - Gloss-ViBe collection
- `https://gams.uni-graz.at/context:derla` - Digital Memory Landscape

### Notes
- GAMS uses a context-based system for organizing collections
- The COREMA collection contains medieval cooking recipe manuscripts
- Server can be slow with large manuscripts (timeout protection recommended)
- Supports IIIF manifests with webcache URLs for high-resolution images

## Testing Recommendations

### For HHU (Currently Limited Support)
```javascript
// These URLs exist but require implementation updates to support:
const testUrlsNeedingSupport = [
    'https://digital.ulb.hhu.de/ink/content/titleinfo/2310083',    // incunabula
    'https://digital.ulb.hhu.de/ihd/content/titleinfo/10147625',   // historical documents
    'https://digital.ulb.hhu.de/content/titleinfo/661008'          // general collection
];

// Only /ms/ and /hs/ collections are currently supported
```

### For University Library Graz (Working)
```javascript
const testUrls = [
    'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
    'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688',
    'https://unipub.uni-graz.at/obvugrscript/content/pageview/8224540'
];
```

### For GAMS (Not Supported)
```javascript
// These context URLs are not supported by current implementation
const gamsUrls = [
    'https://gams.uni-graz.at/context:rbas.ms.P0008s11',
    'https://gams.uni-graz.at/context:corema.a1'
];
```

## Summary of Findings

### HHU Düsseldorf
- Valid manuscript URLs exist on the server
- Current implementation only supports `/ms/` and `/hs/` collection paths
- Additional collection types (`/ink/`, `/ihd/`, `/ulbdsp/`) need implementation support
- IIIF manifests follow the same pattern but need collection-specific base URLs

### University Library Graz (unipub.uni-graz.at)
- **Working perfectly** with current implementation
- Supports both titleinfo and pageview URLs
- Large manuscripts (400+ pages) load successfully
- Uses numeric IDs and standard IIIF manifests

### GAMS (gams.uni-graz.at)
- Uses context-based identifiers (e.g., `context:corema.a1`)
- **Not supported** by current implementation which expects numeric IDs
- Would require a separate implementation to handle context-based URLs

## Implementation Notes

1. **HHU** needs expanded collection support beyond `/ms/` and `/hs/`
2. **University Library Graz** works correctly with existing implementation
3. **GAMS** would need a new implementation to handle context-based identifiers
4. Both Graz systems are different despite similar domain names
5. HHU supports multiple domains that redirect to the same content