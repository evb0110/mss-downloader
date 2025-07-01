#!/bin/bash

# Fix Validation Test Suite Runner
# Executes comprehensive tests for all recent bug fixes

set -e

echo "🧪 Starting Fix Validation Test Suite..."
echo "============================================"

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check if poppler is installed
if ! command -v pdfinfo &> /dev/null; then
    echo "❌ Poppler not found. Installing..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install poppler
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get update && sudo apt-get install -y poppler-utils
    else
        echo "⚠️  Please install poppler-utils manually for PDF validation"
    fi
fi

# Ensure app is built
echo "🔨 Building application..."
npm run build

# Create test results directory
mkdir -p test-results/fix-validation

echo "🚀 Running Fix Validation Tests..."
echo "=================================="

# Run Verona SSL Fix Tests
echo "1️⃣ Testing Verona SSL Fix..."
npx playwright test tests/e2e/verona-ssl-fix-validation.spec.ts \
    --reporter=list \
    --output test-results/fix-validation/verona-ssl

if [ $? -eq 0 ]; then
    echo "✅ Verona SSL Fix tests PASSED"
else
    echo "❌ Verona SSL Fix tests FAILED"
    exit 1
fi

# Run Monte Cassino Catalog Handling Tests
echo ""
echo "2️⃣ Testing Monte Cassino Catalog Handling..."
npx playwright test tests/e2e/monte-cassino-catalog-handling.spec.ts \
    --reporter=list \
    --output test-results/fix-validation/monte-cassino

if [ $? -eq 0 ]; then
    echo "✅ Monte Cassino Catalog Handling tests PASSED"
else
    echo "❌ Monte Cassino Catalog Handling tests FAILED"
    exit 1
fi

# Run IIIF Single Page Warning Tests
echo ""
echo "3️⃣ Testing IIIF Single Page Warning System..."
npx playwright test tests/e2e/iiif-single-page-warning.spec.ts \
    --reporter=list \
    --output test-results/fix-validation/iiif-warnings

if [ $? -eq 0 ]; then
    echo "✅ IIIF Single Page Warning tests PASSED"
else
    echo "❌ IIIF Single Page Warning tests FAILED"
    exit 1
fi

echo ""
echo "🎉 ALL FIX VALIDATION TESTS PASSED!"
echo "=================================="
echo ""
echo "📊 Test Summary:"
echo "  ✅ Verona SSL Fix Validation"
echo "  ✅ Monte Cassino Catalog Handling"
echo "  ✅ IIIF Single Page Warning System"
echo ""
echo "📁 Test results saved to: test-results/fix-validation/"
echo ""
echo "🔍 For detailed logs, check:"
echo "  - test-results/fix-validation/verona-ssl/"
echo "  - test-results/fix-validation/monte-cassino/"
echo "  - test-results/fix-validation/iiif-warnings/"
echo ""
echo "🚀 All bug fixes are validated and working correctly!"