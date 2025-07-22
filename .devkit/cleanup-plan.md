# .devkit Cleanup Plan

## Files/Folders to KEEP:

### Standard Subdirectories:
- `.devkit/docs/` - All documentation files
- `.devkit/reports/` - All validation and analysis reports
- `.devkit/tools/` - Reusable tools and scripts
- `.devkit/tasks/` - Task management files
- `.devkit/analysis/` - Analysis results
- `.devkit/scripts/` - Reusable scripts
- `.devkit/artefacts/` - Project artifacts

### Important Files:
- `.devkit/run-validation.js` - Core validation runner
- `.devkit/validation-downloads.js` - Validation download utility
- `.devkit/validation-summary.md` - Validation summary report

## Files/Folders to DELETE:

### Test Scripts (One-off library tests):
- `test-bdl-api.cjs`
- `test-bdl-fix.cjs`
- `test-fixed-libraries.cjs`
- `test-verona.cjs`
- `test-vienna-direct.cjs`
- `test-vienna-fallback.cjs`
- `test-vienna-fix.cjs`
- `test-vienna-only.js`
- `test-vienna-simple.cjs`
- `test-vienna-validation.js`
- `test-vienna.js`
- `test-graz-*.cjs/js` (all graz test files)
- `test-toronto.cjs`
- `test-wolfenbuettel.cjs`
- `test-enhanced-retry.js`
- `test-arm64-simulation.cjs`
- `test-verona-direct.cjs`

### Validation Scripts (One-off validations):
- `validate-bdl-full.cjs`
- `validate-vienna-comprehensive.cjs`
- `validate-graz-*.js/cjs` (all graz validate files)
- `validate-enhanced-graz.js`
- `validate-verona.js`

### Temporary Validation Folders:
- `library-validation/` - One-off validation folder
- `validation-downloads/` - Temporary download folder
- `validation-results/` - Old validation results
- `validation-final/` - Old final validation
- `validation-current/` - Old current validation
- `validation-artifacts/` - Old artifacts
- `validation-check/` - Temporary check folder
- `validation/` - Old validation folder
- `validation-rouen-fix/` - Specific library fix folder
- `VIENNA-VALIDATION-FINAL/` - Specific library validation
- `bdl-validation/` - Specific library validation
- `bdl-test-images/` - Test images for specific library
- `florence-testing/` - Specific library testing
- `graz-enhanced-validation/` - Specific library validation
- `graz-validation-2025-07-21/` - Date-specific validation
- `graz-validation-pdfs/` - Specific library PDFs
- `grenoble-resolution-test/` - Specific library test

### Other Temporary Folders:
- `test-files/` - Generic test files
- `test-images/` - Generic test images
- `test-output/` - Test output folder
- `test-outputs/` - Another test output folder
- `test-scripts/` - Temporary test scripts
- `tests/` - Generic tests folder
- `pdf-images-output/` - Temporary PDF output
- `pdf-inspection/` - Temporary inspection folder
- `pids/` - Process ID folder (likely empty/outdated)

### Hidden Files:
- All `.DS_Store` files throughout the directory

## Execution Summary:
- **Total test-*.* files to delete:** 21
- **Total validate-*.* files to delete:** 5
- **Total temporary folders to delete:** 27
- **Keeping:** 7 standard subdirectories + 3 important files