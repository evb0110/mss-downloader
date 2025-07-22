# Project TODOs

## High Priority Issues

### 1. Library Search Bar Not Visible
**Task:** DEBUG: Investigate why library search bar is not visible in the UI
**Issue:** Code is implemented but user reports search bar is not showing up in the application
**Status:** In Progress
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
**Task:** DEBUG: This is a tough one, I don't know how to debug and validate, devise a clever way with ultrathink. https://www.loc.gov/item/2010414164/
**Issue:** биб-ка конгресса застряла на середине, не смогла докачать файлы (Library of Congress got stuck in the middle, couldn't finish downloading files)
**Status:** Pending
**Priority:** High
**URL:** https://www.loc.gov/item/2010414164/

**Investigation needed:**
- Analyze why download process gets stuck mid-way
- Devise intelligent debugging approach for validation
- Test with specific manuscript URL provided
- Implement robust error handling and retry mechanisms

---

## Notes

- Library search implementation exists in code but needs verification
- Version 1.4.19 was released prematurely without proper testing
- Need to ensure all features work before marking as complete
- Development environment is clean and organized
- Belgica KBR remains documented as unsupported (requires complex implementation)