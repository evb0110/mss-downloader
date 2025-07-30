# Validation Scripts

This directory contains autonomous validation scripts for testing library fixes before version releases.

## v1.4.49 Autonomous Validation

The `v1.4.49-autonomous-validation.js` script performs comprehensive testing of all 5 libraries reported in GitHub issues:

### Libraries Tested

1. **University of Graz** (Issue #2)
   - UniPub URLs: Tests manuscript downloads
   - GAMS URLs: Tests new context-based URL support

2. **Verona NBM** (Issue #3)
   - Tests timeout fixes for large manuscripts
   - Verifies limited page load implementation

3. **Morgan Library** (Issue #4)
   - Tests 301 redirect handling
   - Verifies SharedManifestAdapter integration

4. **Florence ContentDM** (Issue #5)
   - Tests JavaScript error fixes
   - Verifies enhanced retry logic with exponential backoff

5. **Bordeaux** (Issue #6)
   - Tests new library implementation
   - Verifies DZI tile assembly support

### Running the Script

```bash
# From project root
node .devkit/validation-scripts/v1.4.49-autonomous-validation.js
```

### Features

- **Fully Autonomous**: No user interaction required
- **Comprehensive Testing**: Downloads actual manuscript pages
- **PDF Validation**: Uses poppler to verify PDF integrity
- **Duplicate Detection**: Checks that pages are different
- **Detailed Reporting**: Generates both JSON and Markdown reports
- **Error Handling**: Graceful handling of timeouts and failures

### Output

The script creates:
- PDF files for each tested library in `.devkit/validation-results/v1.4.49/`
- `validation.log` - Detailed execution log
- `validation-report.json` - Machine-readable results
- `validation-report.md` - Human-readable markdown report

### Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed

### Requirements

- Node.js
- Electron (installed via npm)
- pdf-lib (for PDF validation)
- poppler-utils (optional, for enhanced PDF validation)

### Test Configuration

Each library test includes:
- URL(s) to test
- Expected number of pages
- Number of pages to download for testing
- Known errors and applied fixes
- Description of the test case

The script automatically:
1. Builds the application
2. Runs Electron tests for each library
3. Downloads manuscript pages
4. Creates PDF files
5. Validates PDFs with poppler
6. Generates comprehensive reports