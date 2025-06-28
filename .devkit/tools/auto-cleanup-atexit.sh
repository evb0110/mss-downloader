#!/bin/bash

# Auto-cleanup script that runs on shell exit
# Add this to your shell profile for automatic cleanup

cleanup_mss_downloader() {
    local project_root="/Users/e.barsky/Desktop/Personal/Electron/mss-downloader"
    
    if [[ -d "$project_root" ]]; then
        echo "🧹 Auto-cleaning MSS Downloader processes..."
        cd "$project_root"
        .devkit/tools/cleanup-processes.sh >/dev/null 2>&1 || true
    fi
}

# Register cleanup function to run on shell exit
trap cleanup_mss_downloader EXIT

echo "✅ Auto-cleanup for MSS Downloader registered"