#!/bin/bash

# Enhanced Dev Start Script with robust PID management
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 Starting development with PID tracking..."

# Clean up any existing processes first
.devkit/tools/kill-dev.sh 2>/dev/null || true

# Create PID directory if needed
mkdir -p .devkit/pids

# Start the dev process with proper PID tracking
echo "📦 Building and starting development server..."

# Function to cleanup on exit
cleanup() {
    echo "🛑 Cleaning up dev processes..."
    .devkit/tools/kill-dev.sh
}

# Set trap for cleanup on script exit
trap cleanup EXIT INT TERM

# Start dev server and track all related PIDs
npm run dev &
DEV_PID=$!
echo "$DEV_PID" > .devkit/pids/dev-main.pid

# Track child processes
sleep 2
pgrep -P "$DEV_PID" > .devkit/pids/dev-children.pid 2>/dev/null || true

echo "✅ Development server started with PID: $DEV_PID"
echo "📝 PID files created in .devkit/pids/"

# Wait for the process to finish
wait "$DEV_PID"