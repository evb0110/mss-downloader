# TODOs

## Pending Tasks

- Fix Morgan Library low resolution issue: https://www.themorgan.org/collection/lindau-gospels/thumbs - Downloads low resolution images instead of high resolution. Site shows high quality when zooming, but downloader takes from wrong source.

- Fix NYPL calculation hanging: https://digitalcollections.nypl.org/items/89620130-9eeb-013d-0806-0242ac110002 - Manifest loads successfully but hangs on calculation stage

- **CRITICAL: Fix Orleans persistent hanging issue**: https://mediatheques.orleans.fr/recherche/viewnotice/clef/OUVRAGESDEPSEUDOISIDORE--PSEUDOISIDORE----28/id/746238/tri/%2A/expressionRecherche/Ouvrages+de+Pseudo+Isidore - Manifest loads but then hangs indefinitely. **ALREADY REPORTED AS FIXED TWICE** - need deep investigation and alternative approaches. User permits spending significant resources to solve this definitively.

## Completed Tasks

- ✅ **University of Graz library support** - ALREADY IMPLEMENTED in v1.1.2: Fix for https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538 fetch failure. Added Graz to size estimation bypass list and fixed pageview URL ID conversion. Both titleinfo and pageview URLs now work correctly.

- ✅ **Stanford Parker Library support** - ALREADY IMPLEMENTED: Full IIIF support for https://parker.stanford.edu/parker/catalog/ URLs. Tested 3 sample URLs (410, 596, 306 pages). E2E tests passing. 22 URLs should work with existing implementation.

<!-- Completed todos moved to TODOS-COMPLETED.md -->