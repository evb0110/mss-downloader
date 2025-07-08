# Belgica KBR Integration Analysis

## Current State Analysis

### Two Different Approaches Identified

1. **Current Working Implementation (December 2024)**
   - URL Pattern: `https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415`
   - Method: Thumbnail handler API
   - Resolution: 215x256 pixels (~8KB images)
   - Content: Cover/binding images only
   - Status: ✅ Working and deployed

2. **Agent Work (July 2025)**
   - URL Pattern: `https://viewerd.kbr.be/display/.../zoomtiles/...`
   - Method: Tile engine system with browser automation
   - Resolution: 6144×7680 pixels (47 megapixels)
   - Content: High-resolution manuscript pages
   - Status: ⚠️ Requires browser automation integration

## Integration Strategy

### The Missing Link

The agents have correctly identified that:
1. The document URL `https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415` contains a link to `https://uurl.kbr.be/1558106`
2. The UURL page contains a gallery iframe: `https://viewerd.kbr.be/gallery.php?map=A/1/5/8/9/4/8/5/0000-00-00_00/`
3. The gallery page has AjaxZoom configuration for tile-based high-resolution images

### Required Integration

The system needs to:
1. **Detect original document URLs** (`belgica.kbr.be/BELGICA/doc/SYRACUSE/`)
2. **Extract the manuscript chain** (UURL → Gallery → AjaxZoom)
3. **Route to tile engine** if high-resolution is available
4. **Fallback to thumbnail handler** if tile system fails

## Implementation Plan

### Phase 1: URL Detection Enhancement
- Modify library detection to identify both URL patterns
- Route document URLs to manuscript chain extraction
- Route zoomtiles URLs directly to tile engine

### Phase 2: Manuscript Chain Integration
- Use Agent 3's `extractManuscriptChain()` method
- Convert document URLs to tile URLs
- Validate tile accessibility

### Phase 3: Fallback Strategy
- Attempt tile engine first for maximum resolution
- Fall back to thumbnail handler for compatibility
- Provide clear user feedback about quality differences

## Next Steps

1. **Integrate manuscript chain extraction** into URL detection
2. **Test tile engine with original document URL**
3. **Create quality comparison validation**
4. **Implement user choice for quality levels**