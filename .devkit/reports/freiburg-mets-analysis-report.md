# University of Freiburg METS XML Analysis Report

## Overview
Analysis of METS XML structure for University of Freiburg manuscript digitization (sample: hs360a).

**Test URL:** https://dl.ub.uni-freiburg.de/diglitData/mets/hs360a.xml

## Key Findings

### 1. XML Structure
- **Total XML entries:** 2,171 file references
- **Unique pages:** 434 manuscript pages
- **File groups:** 6 different resolution/purpose groups
- **Success rate:** 100% for image URL construction

### 2. File Groups (by USE attribute)
| Group | Pages | Purpose |
|-------|-------|---------|
| INTROIMAGE | 1 | Cover/intro image |
| MIN | 434 | Minimum resolution |
| MINPLUS | 434 | Small+ resolution |
| DEFAULT | 434 | Standard resolution |
| MAX | 434 | Maximum resolution |
| THUMBS | 434 | Thumbnail images |

### 3. Page Naming Patterns

#### Standard Pages (2,130 entries)
- **Pattern:** `###r` / `###v` (recto/verso)
- **Range:** 001r to 213v
- **Structure:** Zero-padded 3-digit numbers + r/v suffix

#### Special Pages (41 entries)
- **Covers:** `00000Vorderdeckel`, `y_Rueckdeckel`, `z_Ruecken`
- **Endpapers:** `00000Vorderspiegel`, `x_Rueckspiegel`
- **Color chart:** `za_Farbkeil`
- **Blank pages:** `0000a`, `0000b`

### 4. URL Construction Pattern
```
Base URL: https://dl.ub.uni-freiburg.de/diglitData/image/hs360a/
Structure: {baseUrl}{group}/{filename}
Example: https://dl.ub.uni-freiburg.de/diglitData/image/hs360a/default/001r.jpg
```

### 5. Resolution Analysis
- **Recommended group:** `MAX` for highest quality
- **Fallback group:** `DEFAULT` for standard quality
- **File format:** JPG images
- **Size range:** 275KB - 770KB (for DEFAULT group)

## Implementation Recommendations

### 1. METS XML Parsing Strategy
```javascript
// Parse METS XML to extract all page identifiers
const fileGrpRegex = /<mets:fileGrp[^>]*USE="([^"]*)"[^>]*>(.*?)<\/mets:fileGrp>/gs;
const fileRegex = /<mets:file[^>]*ID="([^"]*)"[^>]*>.*?<mets:FLocat[^>]*xlink:href="([^"]*)"[^>]*\/?>.*?<\/mets:file>/gs;
```

### 2. Page Discovery Approach
1. **Fetch METS XML** from `https://dl.ub.uni-freiburg.de/diglitData/mets/{manuscriptId}.xml`
2. **Parse file groups** and prioritize `MAX` group for highest resolution
3. **Extract page identifiers** systematically from METS structure
4. **Handle special pages** separately (covers, endpapers, color charts)
5. **Construct image URLs** using base URL + group + filename pattern

### 3. Quality Optimization
- **Primary:** Use `MAX` file group for maximum resolution
- **Secondary:** Fall back to `DEFAULT` if MAX unavailable
- **Skip:** Avoid `THUMBS` group (low resolution)

### 4. Error Handling
- Validate METS XML availability before processing
- Handle missing pages gracefully
- Implement retry logic for network timeouts
- Filter out placeholder/error pages

## Technical Implementation Notes

### Page Order Logic
- Standard pages follow natural recto/verso sequence
- Special pages should be handled based on manuscript structure
- Use METS logical structure map for proper ordering

### Maximum Resolution Strategy
The MAX file group provides the highest available resolution images, making it ideal for archival-quality downloads.

### Metadata Extraction
METS XML contains rich metadata including:
- Manuscript dating and provenance
- Content descriptions
- Physical structure details
- Language and script information

## Validation Results
- ✅ METS XML successfully parsed
- ✅ All file groups identified
- ✅ Page patterns correctly extracted
- ✅ URL construction verified
- ✅ Image accessibility confirmed
- ✅ Special pages properly categorized

## Next Steps
1. Implement METS XML parser in manuscript downloader service
2. Add University of Freiburg library support
3. Test with multiple manuscript samples
4. Optimize for maximum resolution downloads
5. Handle edge cases and error conditions