# GitHub Issue Comments for Version 1.4.62

## Issue #15 - Munich Library
Fixed in version 1.4.62! 🎉

Added full support for Munich Digital Collections (Digitale Sammlungen):
- IIIF v2 manifest parsing
- High-resolution image downloads  
- Successfully tested with 726-page manuscript
- URL pattern: `https://www.digitale-sammlungen.de/en/view/[manuscript-id]`

Please update to version 1.4.62 and test with your Munich manuscripts.

## Issue #13 - Grenoble  
Tested and confirmed working in version 1.4.62. The library successfully downloads 40 pages. SSL certificate warnings don't affect functionality.

## Issue #12 - Catalonia
Tested and confirmed working in version 1.4.62. Successfully downloads 812 pages without timeouts.

## Issue #11 - BNE
Tested and confirmed working in version 1.4.62. PDF raw access works correctly for 100 pages.

## Issue #10 - Zurich
Already fixed in previous versions. Now correctly discovers all 407 pages (was only showing 11). Advanced block discovery finds all manuscript segments.

## Issue #9 - BDL
Tested and confirmed working in version 1.4.62. Successfully downloads 304 pages via IIIF.

## Issue #6 - Bordeaux
Tested and confirmed working in version 1.4.62. DZI tile technology correctly processes 195 pages.

## Issue #5 - Florence
Fixed in version 1.4.62! 🎉

Added 30-second timeout protection to prevent infinite loops during compound object detection. This should resolve the "reply was never sent" errors.

Please update to version 1.4.62 and test again.

## Issue #4 - Morgan Library  
Fixed in version 1.4.62! 🎉

- Fixed redirect handling for 301/302 responses
- Enhanced error messages for better debugging
- Should resolve the "imagesByPriority is not defined" error

Please update to version 1.4.62 and test with Morgan Library manuscripts.

## Issue #3 - Verona
Unfortunately, this appears to be a network/geo-blocking issue. As you mentioned, the site only opens through VPN ("сайт открывается только через впн"). 

This is not something that can be fixed in the application code. You'll need to use a VPN to access Verona manuscripts.

## Issue #2 - Graz
Tested successfully in version 1.4.62 - downloaded 644 pages without issues. If you're still experiencing problems, it may be specific to certain manuscripts or network conditions. Please try again with version 1.4.62 and let me know if the issue persists with specific URLs.