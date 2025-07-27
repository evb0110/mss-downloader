# Autonomous Validation Scripts

This directory contains programmatic validation scripts for the autonomous issue-fixing workflow.

## Important Notes

- These scripts run WITHOUT user interaction
- All validation is done programmatically
- PDFs are inspected using command-line tools
- No Finder windows are opened
- Results are evaluated automatically

## Validation Requirements

Each validation script must:

1. Test the exact URL from the issue report
2. Download 5-10 pages to verify the fix
3. Check that the specific error is resolved
4. Validate PDF structure with poppler
5. Return clear success/failure status
6. Log all results for review

## Template

See `validation-template.js` for the standard validation script structure.