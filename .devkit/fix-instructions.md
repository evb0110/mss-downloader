# Instructions for Fixing All Open Issues

## Overview
You need to fix all open issues found in `.devkit/current-issues.json`.

## Process
1. **Analyze Issues**: Read each issue carefully and understand the problem
2. **Implement Fixes**: Make necessary code changes to fix each issue
3. **Test Thoroughly**: Create test scripts and validation PDFs for each fix
4. **Document Changes**: Keep track of what was fixed for each issue

## Important Guidelines
- Use 3 subagents to work on different aspects in parallel
- Focus on fixing the actual problems, not just symptoms
- Test with real manuscript URLs from the issues
- Ensure all fixes are backward compatible
- Create comprehensive validation for each library

## After Fixing
- Run all tests
- Create validation PDFs
- Prepare non-technical explanations for each issue
- DO NOT bump version until all fixes are confirmed working

## Use Ultra-thinking
For complex issues, use extended thinking to:
- Understand the root cause
- Plan the best solution
- Consider edge cases
- Ensure robust implementation
