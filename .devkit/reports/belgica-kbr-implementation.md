# Belgica KBR Implementation Report

## Summary
Belgica KBR uses a complex multi-layered iframe structure with AJAX-ZOOM viewer that requires authentication and session handling. This is currently not supported and would require significant implementation effort.

## Technical Analysis

### 1. Architecture Overview
- Main URL: `https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415`
- First redirect: `https://uurl.kbr.be/1558106`
- Viewer iframe: `https://viewerd.kbr.be/gallery.php?map=A/1/5/8/9/4/8/5/0000-00-00_00/`
- Uses AJAX-ZOOM commercial viewer with encrypted zoomData parameter

### 2. Challenges Identified

#### a) Authentication Required
- Direct image access returns 403 Forbidden
- Requires session cookies from the viewer page
- May need to maintain session state across requests

#### b) Complex Viewer System
- Uses AJAX-ZOOM with encrypted/encoded configuration
- zoomData parameter: `eNpLtDK0qs60MrROtDKyqi4G8pQKlKyLrYyBDH1HfUN9U30LfUt9EyBpqm9cMAS6YBRvYKAPUgZUlaZknWRlYF1bC1wwuzYSCg,,`
- Map path structure: `A/1/5/8/9/4/8/5/0000-00-00_00/`

#### c) No Direct Image URLs
- Images are loaded dynamically through JavaScript
- No discoverable direct image URL patterns
- Protected by access controls

### 3. Attempted Solutions
- Tried various URL patterns: all returned 403 or 404
- Attempted to decode zoomData: appears to be proprietary encoding
- AJAX-ZOOM endpoints require proper session/authentication

## Recommendation
Belgica KBR requires a full implementation with:
1. Session management and cookie handling
2. JavaScript execution to retrieve dynamic image URLs
3. Possible reverse-engineering of AJAX-ZOOM protocol
4. Authentication flow handling

This is beyond the scope of a simple fix and would require significant development effort similar to implementing a new library from scratch.

## Status
- **Not Implemented** - Requires complex authentication and session handling
- Error message to users is appropriate: "unsupported viewer system"
- Would need dedicated development effort to support