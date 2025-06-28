#!/bin/bash

# Enhanced Headless Dev Start Script
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 Starting headless development with PID tracking..."

# Clean up any existing processes first
.devkit/tools/kill-dev-headless.sh 2>/dev/null || true

# Create PID directory if needed
mkdir -p .devkit/pids

# Function to cleanup on exit
cleanup() {
    echo "🛑 Cleaning up headless dev processes..."
    .devkit/tools/kill-dev-headless.sh
}

# Set trap for cleanup on script exit
trap cleanup EXIT INT TERM

# Start headless dev server
echo "📦 Building and starting headless development server..."

npm run dev:headless &
DEV_PID=$!
echo "$DEV_PID" > .devkit/pids/dev-headless-main.pid

# Track child processes
sleep 2
pgrep -P "$DEV_PID" > .devkit/pids/dev-headless-children.pid 2>/dev/null || true

echo "✅ Headless development server started with PID: $DEV_PID"
echo "📝 PID files created in .devkit/pids/"

# Wait for the process to finish
wait "$DEV_PID"