#!/bin/bash

# Test script for all GitHub issue fixes

echo "==================================="
echo "Testing all GitHub issue fixes"
echo "==================================="
echo

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create validation directory
VALIDATION_DIR="$(dirname "$0")"
mkdir -p "$VALIDATION_DIR/results"

# Test URLs from the issues
declare -A TEST_URLS=(
    ["HHU"]="https://hs.manuscriptorium.com/cs/detail/?callno=HHU_H_1B&pg=41"
    ["GRAZ"]="https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538"
    ["VERONA"]="https://nuovabibliotecamanoscritta.it/Generale/manoscritti/MANOSCRITTO.html?idManoscritto=76251"
    ["MORGAN"]="https://www.themorgan.org/collection/lindau-gospels/thumbs"
)

# Function to test a library
test_library() {
    local name=$1
    local url=$2
    local output_dir="$VALIDATION_DIR/results/$name"
    
    echo -e "${YELLOW}Testing $name...${NC}"
    echo "URL: $url"
    
    # Create library-specific config
    cat > "$output_dir/config.json" <<EOF
{
    "urls": ["$url"],
    "outputDirectory": "$output_dir",
    "skipExisting": false,
    "createSubfolders": false,
    "downloadWorkers": 1,
    "pageWorkers": 5,
    "startPage": 1,
    "endPage": 5,
    "selectedManuscripts": []
}
EOF
    
    echo "Config created at: $output_dir/config.json"
    echo
}

# Create test configs for each library
for library in "${!TEST_URLS[@]}"; do
    mkdir -p "$VALIDATION_DIR/results/$library"
    test_library "$library" "${TEST_URLS[$library]}"
done

# Create a combined test script
cat > "$VALIDATION_DIR/run-validation.js" <<'EOF'
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const libraries = ['HHU', 'GRAZ', 'VERONA', 'MORGAN'];
const resultsDir = path.join(__dirname, 'results');

console.log('Manuscript Downloader - Issue Fixes Validation');
console.log('==============================================\n');

// Check each library config
for (const library of libraries) {
    const configPath = path.join(resultsDir, library, 'config.json');
    if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log(`${library}:`);
        console.log(`  URL: ${config.urls[0]}`);
        console.log(`  Pages: ${config.startPage}-${config.endPage}`);
        console.log(`  Config: ${configPath}`);
    }
}

console.log('\nValidation Instructions:');
console.log('1. Run: npm run dev:headless');
console.log('2. For each library, load its config file');
console.log('3. Start download and wait for completion');
console.log('4. Check the output PDF in the results folder');
console.log('\nExpected Results:');
console.log('- HHU: Should download without "logInfo is not a function" error');
console.log('- GRAZ: Should complete without infinite loading');
console.log('- VERONA: Should complete without ETIMEDOUT errors');
console.log('- MORGAN: Should find and download multiple pages (not just 1)');
EOF

echo -e "${GREEN}Validation setup complete!${NC}"
echo
echo "To run validation:"
echo "1. cd $(pwd)"
echo "2. node .devkit/validation/run-validation.js"
echo "3. Follow the instructions to test each library"
echo
echo "Test configs created in: $VALIDATION_DIR/results/"