# Project TODOs

## Medium Priority Enhancements

### 1. Library Search Bar with Fuzzy Search
**Task:** Add a search bar with fuzzy search to the supported libraries popup
**Issue:** There are already too many libraries in the supported popup, making it hard to find the needed ones
**Requirements:**
- Implement fuzzy search functionality to filter libraries
- Add search bar UI element in the popup
- Allow users to quickly find libraries by name or partial matches
**Status:** Pending
**Priority:** Medium

### 2. University of Toronto Library Support
**URL:** https://collections.library.utoronto.ca/view/fisher2:F6521  
**Issue:** Currently unsupported library, needs full implementation  
**Error:** `Error invoking remote method 'parse-manuscript-url': Error: Unsupported library for URL: https://collections.library.utoronto.ca/view/fisher2:F6521`  
**Status:** Pending  
**Priority:** Medium  

### 3. Karlsruhe Library Resolution Enhancement
**Current Issue:** Downloading low resolution images  
**Enhancement:** Investigate higher resolution options:
- IIIF manifest: https://digital.blb-karlsruhe.de/i3f/v20/192435/manifest  
- Direct access: https://digital.blb-karlsruhe.de/blbhs/content/pageview/221207  
**Status:** Pending  
**Priority:** Medium  

---

## Notes

- All high-priority tasks have been completed in VERSION-1.4.14
- Focus now shifts to medium-priority enhancements
- Belgica KBR requires complex implementation (documented as unsupported)