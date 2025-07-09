#!/bin/bash

# Convert all PDF negatives in artefacts directory to positives
echo "🔄 Converting all negative PDFs to positives..."

cd "$(dirname "$0")/.."
node "tools/negative-to-positive-converter.cjs" "artefacts"

echo ""
echo "📁 Opening results folder..."
open "artefacts/positive-pdfs"

echo "✅ Conversion complete!"