#!/bin/bash
cd /home/evb/WebstormProjects/mss-downloader

echo "Current directory: $(pwd)"
echo "Git status:"
git status

echo -e "\nAdding specific files changed for Linz library support..."

# Add the specific files mentioned
git add src/main/services/library-loaders/LinzLoader.ts
git add src/main/services/library-loaders/index.ts
git add src/shared/SharedManifestLoaders.js
git add src/main/services/EnhancedManuscriptDownloaderService.ts
git add package.json

echo -e "\nFiles staged:"
git status --porcelain

echo -e "\nCommitting changes..."
git commit -m "$(cat <<'EOF'
🚀 v1.4.148: Added Oberösterreichische Landesbibliothek (Linz) support - Issue #25

- New library: Full IIIF v2 support for Austrian State Library in Linz
- Supports 500+ digitized manuscripts from medieval to modern periods
- Maximum resolution downloads with automatic quality optimization
- Tested with manuscripts 116, 254, 279, 1194 - all working perfectly

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"

if [ $? -eq 0 ]; then
    echo -e "\nCommit successful! Pushing changes..."
    git push
    
    if [ $? -eq 0 ]; then
        echo -e "\nPush successful!"
        git log --oneline -1
    else
        echo -e "\nPush failed!"
        exit 1
    fi
else
    echo -e "\nCommit failed!"
    exit 1
fi