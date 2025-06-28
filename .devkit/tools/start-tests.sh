#!/bin/bash

# Enhanced Test Start Script with robust PID management
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "🧪 Starting E2E tests with PID tracking..."

# Clean up any existing test processes first
.devkit/tools/kill-tests.sh 2>/dev/null || true

# Create PID directory if needed
mkdir -p .devkit/pids

# Function to cleanup on exit
cleanup() {
    echo "🛑 Cleaning up test processes..."
    .devkit/tools/kill-tests.sh
}

# Set trap for cleanup on script exit
trap cleanup EXIT INT TERM

# Build first
echo "📦 Building project for tests..."
npm run build

# Start tests with PID tracking
echo "🧪 Starting Playwright tests..."

npx playwright test &
TEST_PID=$!
echo "$TEST_PID" > .devkit/pids/test-main.pid

# Track child processes
sleep 3
pgrep -P "$TEST_PID" > .devkit/pids/test-children.pid 2>/dev/null || true

# Track any electron processes that get spawned
sleep 2
pgrep -f "electron.*test|test.*electron" > .devkit/pids/test-electron.pid 2>/dev/null || true

echo "✅ Tests started with PID: $TEST_PID"
echo "📝 PID files created in .devkit/pids/"

# Wait for the process to finish
wait "$TEST_PID"