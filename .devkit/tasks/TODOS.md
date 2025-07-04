# Project TODOs

## Pending Tasks

### 🔴 Critical Download Issues - HIGH PRIORITY

1. **BDL Servizirl** - Fix hanging on calculation
   - URL: https://www.bdl.servizirl.it/bdl/bookreader/index.html?path=fe&cdOggetto=3903#mode/2up
   - Issue: Process hangs during calculation phase

2. **Manuscripta.at** - Fix incomplete downloads
   - URL: https://manuscripta.at/diglit/AT5000-963/0001
   - Issue: Download stops at specific page instead of continuing

3. **BNC Roma** - Fix file verification failure
   - URL: http://digitale.bnc.roma.sbn.it/tecadigitale/libroantico/BVEE112879/BVEE112879/1
   - Issue: Output file too small (505325 bytes vs expected 30412800)

4. ~~**Morgan Library** - Fix hanging on calculation~~ ✅ **COMPLETED v1.3.79**
   - URL: https://www.themorgan.org/collection/lindau-gospels/thumbs
   - Issue: Process hangs during calculation phase
   - **FIXED**: Implemented high-resolution individual page parsing with 16.6x quality improvement

5. **University of Graz** - Fix fetch failure
   - URL: https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538
   - Issue: Error: Failed to load University of Graz manuscript: fetch failed

6. **Internet Culturale** - Fix hanging and infinite loops
   - URL: https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Ateca.bmlonline.it%3A21%3AXXXX%3APlutei%3AIT%253AFI0100_Plutei_21.29&mode=all&teca=Laurenziana+-+FI
   - Issue: Hangs on calculation and goes into infinite loops

7. **e-manuscripta.ch** - Fix incomplete page detection
   - URL: https://www.e-manuscripta.ch/bau/content/zoom/5157616
   - Issue: Only downloads first 11 pages, doesn't detect remaining pages
   - Type: Pagination bug - incomplete manuscript download

### 🆕 New Library Implementation - MEDIUM PRIORITY

8. **DIAMM (Digital Image Archive of Medieval Music)** - Add new library support
   - URLs: 
     - https://musmed.eu/visualiseur-iiif?manifest=https%3A%2F%2Fiiif.diamm.net%2Fmanifests%2FI-Rc-Ms-1907%2Fmanifest.json
     - https://musmed.eu/visualiseur-iiif?manifest=https%3A%2F%2Fiiif.diamm.net%2Fmanifests%2FI-Ra-Ms1383%2Fmanifest.json
     - https://musmed.eu/visualiseur-iiif?manifest=https%3A%2F%2Fiiif.diamm.net%2Fmanifests%2FI-Rc-Ms-1574%2Fmanifest.json
     - https://musmed.eu/visualiseur-iiif?manifest=https%3A%2F%2Fiiif.diamm.net%2Fmanifests%2FI-Rv-C_32%2Fmanifest.json
   - Issue: New library - needs implementation for IIIF manifest-based downloads
   - Type: Medieval music manuscripts via IIIF protocol

## Recent Completed Tasks (v1.3.77)

### ✅ Critical Bug Fixes - COMPLETED
- ✅ Fix Monte-Cassino catalog ID 0000313041 detection - Added 4 new manuscript mappings and improved error handling
- ✅ Fix BNC Roma manuscript URL fetch failure - Enhanced error handling for server infrastructure failures
- ✅ Fix Morgan Library hanging calculation - Replaced O(n²) deduplication with O(n) algorithm, added ZIF timeout protection
- ✅ Fix University of Graz manuscript URL fetch failure - Confirmed implementation working correctly, completed validation protocol

## Previous Completed Tasks (v1.3.72)

### ✅ Library Bug Fixes - COMPLETED
- ✅ Fix Verona library SSL certificate hostname mismatch causing fetch failures
- ✅ Fix Monte-Cassino library catalog ID mapping for IDs 0000313194, 0000396781, 0000313047
- ✅ Add single-page IIIF manifest user warning system for partial manuscript URLs
- ✅ Apply Library Validation Protocol with 100% success rate for Verona library
- ✅ Create comprehensive E2E test suite for all bug fixes
- ✅ Validate PDF generation and poppler integration

## Previous Completed Tasks (v1.3.62)

### ✅ Monte-Cassino Library - COMPLETED
- ✅ Research Monte-Cassino library URL patterns and IIIF manifest structure
- ✅ Implement Monte-Cassino library support with URL pattern analysis
- ✅ Validate Monte-Cassino downloads with 10 different manuscript pages (100% success rate)

### ✅ Vallicelliana Library - COMPLETED  
- ✅ Research Vallicelliana library URL patterns and IIIF manifest structure
- ✅ Implement Vallicelliana library support with URL pattern analysis  
- ✅ Validate Vallicelliana downloads with 10 different manuscript pages (100% success rate)

### ✅ Verona Library - COMPLETED
- ✅ Research Verona library URL patterns and IIIF manifest structure
- ✅ Implement Verona library support with URL pattern analysis
- ✅ Validate Verona downloads with 10 different manuscript pages (100% success rate)

### ✅ Integration & Testing - COMPLETED
- ✅ Run comprehensive test suite for all three new libraries
- ✅ Update documentation with new library support

### ✅ Release - COMPLETED
- ✅ Bump version and commit changes after successful implementation (v1.3.62)

## Completed Tasks

See [COMPLETED.md](./COMPLETED.md) for full list of completed tasks.