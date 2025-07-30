#!/bin/bash

# Pre-commit reminder for critical development rules
echo "
🚨 CRITICAL REMINDERS BEFORE COMMIT 🚨

Before committing fixes for user-reported issues, verify:

✓ Used PRODUCTION CODE for testing (not isolated scripts)
✓ Tested EXACT USER URLs (not 'better' alternatives)  
✓ REPRODUCED user errors before fixing
✓ Fixed ROOT CAUSES (not symptoms)
✓ VALIDATED with same URLs that were failing

Remember v1.4.49: We claimed fixes but delivered ZERO.

Press Enter to continue if ALL above are verified..."
read -r

echo "✅ Proceeding with commit. Remember: User trust depends on REAL fixes."