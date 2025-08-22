#!/bin/bash

# IMPLEMENT-LIBRARY Command - ALWAYS DO, NEVER DEFER
# This command enforces immediate implementation of requested libraries

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 IMPLEMENT-LIBRARY - IMMEDIATE ACTION PROTOCOL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚡ CORE PRINCIPLE: DO IT NOW, NOT LATER ⚡"
echo ""
echo "When user requests a library addition:"
echo "✅ IMMEDIATELY implement the loader"
echo "✅ IMMEDIATELY test with real manuscripts"
echo "✅ IMMEDIATELY version bump and deploy"
echo ""
echo "FORBIDDEN RESPONSES:"
echo "❌ 'Will be added in future versions'"
echo "❌ 'Accepted for consideration'"
echo "❌ 'Documented for later implementation'"
echo "❌ 'Принято к рассмотрению'"
echo ""

# Implementation workflow enforcer
cat << 'WORKFLOW'

MANDATORY IMPLEMENTATION WORKFLOW:
═══════════════════════════════════════════════════════════════════

1. ANALYZE REQUEST
   - Extract library URL/name from issue
   - Visit library website to understand structure
   - Check if IIIF or custom implementation needed

2. CREATE LOADER (30-60 minutes max)
   - Create src/main/services/library-loaders/LibraryNameLoader.ts
   - Implement manifest discovery logic
   - Add to SharedLibraryDetector.ts
   - Update EnhancedManuscriptDownloaderService.ts routing

3. TEST IMMEDIATELY (10-20 minutes)
   - Download 3 different manuscripts
   - Verify pages are correct
   - Check PDF generation works

4. VERSION BUMP & DEPLOY (5 minutes)
   - Update package.json version
   - Update changelog with "Added [Library Name] support"
   - Commit, push, verify GitHub Actions
   - Confirm Telegram notification sent

5. UPDATE USER (1 minute)
   - Comment on issue: "✅ Implemented in v1.4.XXX"
   - Provide test URLs that work
   - Close issue as completed

TOTAL TIME: ~1-2 hours per library MAX

═══════════════════════════════════════════════════════════════════

WORKFLOW
echo ""
echo "ENFORCEMENT RULES:"
echo "1. If library request in issue → IMPLEMENT NOW"
echo "2. If user says 'add library X' → IMPLEMENT NOW"
echo "3. If manuscript URL doesn't work → FIX NOW"
echo "4. No deferrals, no promises, no 'future versions'"
echo ""
echo "Claude, when you see a library request, execute the workflow above IMMEDIATELY."