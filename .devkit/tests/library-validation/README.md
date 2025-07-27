# Library Validation Test Suite

This directory contains comprehensive test scripts to validate all recent library fixes in the mss-downloader project.

## Purpose

These tests ensure that recent fixes are working correctly before version bump:
- **NBM Italy (Verona)**: Validates that all pages are detected (not just 10)
- **Morgan Library**: Validates that all pages are extracted (not just 16) and high-resolution ZIF files work
- **University of Graz**: Validates timeout handling for slow servers (ETIMEDOUT fix)
- **HHU Düsseldorf**: Validates high-resolution downloads (30+ megapixel) and error handling

## Prerequisites

Make sure you have the following installed:
- Node.js (v14 or higher)
- `poppler-utils` (for PDF validation) - install with: `sudo apt-get install poppler-utils`
- Required npm packages (will be installed from project)

## Running Tests

### Run All Tests (Recommended)
```bash
cd /home/evb/WebstormProjects/mss-downloader/.devkit/tests/library-validation
node run-all-tests.js
```

### Run Individual Tests
```bash
# NBM Verona
node test-nbm-verona.js

# Morgan Library
node test-morgan-library.js

# University of Graz
node test-graz-university.js

# HHU Düsseldorf
node test-hhu-duesseldorf.js
```

## What the Tests Do

Each test script:
1. Loads manuscripts using the actual downloader service code
2. Validates that the expected number of pages are found
3. Downloads sample pages (typically 5-10 per manuscript)
4. Verifies image quality and resolution
5. Checks that pages are unique (not stuck on page 1)
6. Creates validation PDFs
7. Validates PDFs with poppler
8. Generates detailed reports

## Output

Test results are saved in timestamped directories:
```
test-results/
└── 2024-01-20T10-30-45/
    ├── nbm-verona/
    │   ├── Codice_15_LXXXIX841.pdf
    │   ├── Codice_12_CXLV1331.pdf
    │   └── test-report.json
    ├── morgan-library/
    │   ├── Lindau_Gospels.pdf
    │   └── test-report.json
    ├── graz-university/
    │   └── ...
    └── hhu-duesseldorf/
        └── ...
```

## Interpreting Results

### Success Criteria
- ✅ All tests pass
- ✅ Expected page counts are met
- ✅ PDFs are valid
- ✅ High resolution images (check megapixels)
- ✅ Unique pages (not duplicates)
- ✅ No timeout errors (especially for Graz)

### Common Issues
- **Low page count**: The fix for extracting all pages may not be working
- **Timeout errors**: Server is slow and needs extended timeouts
- **Low resolution**: Not using maximum IIIF resolution parameters
- **Duplicate pages**: Parser might be stuck on first page
- **PDF validation fails**: Issue with image format or PDF creation

## Manual Validation

After tests complete:
1. Open the test-results directory
2. Review the generated PDFs
3. Verify manuscript content looks correct
4. Check that multi-page manuscripts have different content on each page
5. Confirm image quality is high (zoom in to check detail)

## Next Steps

If all tests pass:
1. Review the generated PDFs manually
2. Confirm with user that validation passed
3. Proceed with version bump only after user approval

If tests fail:
1. Review error logs in test reports
2. Fix issues in the main codebase
3. Re-run failed tests
4. Once all pass, run full suite again

## Notes

- Tests include delays between requests to be respectful to library servers
- Graz tests use longer timeouts (120s) due to slow server
- Morgan Library tests include ZIF file processing which may be slower
- Some tests download fewer pages to keep runtime reasonable