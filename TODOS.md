# TODOs

## Pending Tasks

- Add support for Stanford Parker Library: https://parker.stanford.edu/parker/catalog/ - Support URLs like https://parker.stanford.edu/parker/catalog/zs345bj2650 (22 URLs provided, similar format)

## Completed Tasks

- Fix Gallica BNF hanging issue: Fixed downloads freezing instead of starting by correcting IIIF URL format from broken `/iiif/{ark}/f{page}/full/max/0/native.jpg` to working `/{ark}/f{page}.highres` format. Updated manifest parsing and binary search fallback logic. Both test URLs now work: https://gallica.bnf.fr/ark:/12148/btv1b8426288h/f1.planchecontact (554 pages) and https://gallica.bnf.fr/ark:/12148/btv1b10033169h/f1.planchecontact (404 pages).

- Fix Internet Culturale slow performance: Optimized Florence manuscripts that were taking ~16 hours to download by adding 90s timeout, Italian-specific headers (Referer, Accept-Language: it-IT), proxy fallback support, and size estimation bypass using 0.8MB average page size. Performance should improve from 16 hours to 30-60 minutes.

- Fix Parker Stanford and Spanish RBME download size limitations: Implemented dynamic download step size optimization with library-specific auto-split thresholds (minimum 500MB for Parker/RBME vs 300MB default), reduced concurrency limits (2 concurrent for Parker/RBME), and added progressive timeout handling with exponential backoff. Added ⚡ Optimized UI badges to show when library-specific optimizations are active.

- Add dynamic download step size optimization: Created LibraryOptimizationService with comprehensive library-specific settings including auto-split thresholds, concurrency limits, timeout multipliers, and progressive backoff. System automatically detects library type and applies optimizations with UI indicators showing when optimizations are active.

- Fix Orléans timeout error: Enhanced timeout handling for Orleans manuscript downloads by increasing timeouts from 15s to 30s, added multiple fallback search strategies (original query, first two words, first word, lowercase variants, partial matches), and added specific handling for "OUVRAGESDEPSEUDOISIDORE--PSEUDOISIDORE" URLs to correctly map to "Ouvrages de Pseudo Isidore" search query. Fixed URL processing to handle complex Orleans manuscript titles properly.

- Fix manifest loading UI issues: Fixed page counter showing incorrect "1 of 0" during manifest loading by showing "Loading manifest..." instead. Fixed Start Queue button showing wrong text like "Resume" when disabled during manifest loading. Enhanced loading state logic to properly handle manifest loading status indicators and button text.

- Fix MIRA/Trinity Dublin access error: Enhanced error handling to distinguish between accessible MIRA items (like /105 pointing to ISOS/RIA) vs blocked ones (like /98, /107 pointing to Trinity Dublin with reCAPTCHA protection). Added detailed error messages identifying the institution and manifest URL causing issues.

- Implement possibility to change order of items either with arrows or with dragging. Only whole items should be moved, not parts. So we should redesign the relation item <-> parts. E.g. now it's extremely bad, that we cannot delete all parts of one item in one go. Button Edit should only belong to the whole item, button delete should belong to both item and part.

- Fix folder creation with special symbols that cannot be opened by some users for this Unicatt link: https://digitallibrary.unicatt.it/veneranda/0b02da8280051c10