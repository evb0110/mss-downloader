#!/bin/bash

# Enhanced Test Kill Script with comprehensive cleanup
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "🛑 Stopping test processes..."

# Function to safely kill a process
safe_kill() {
    local pid=$1
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
        echo "  Stopping process $pid"
        kill -TERM "$pid" 2>/dev/null || true
        sleep 1
        
        # Force kill if still running
        if kill -0 "$pid" 2>/dev/null; then
            echo "  Force stopping process $pid"
            kill -9 "$pid" 2>/dev/null || true
        fi
    fi
}

# Kill processes from PID files
if [[ -d ".devkit/pids" ]]; then
    for pid_file in .devkit/pids/test-*.pid; do
        if [[ -f "$pid_file" ]]; then
            while IFS= read -r pid; do
                [[ -n "$pid" ]] && safe_kill "$pid"
            done < "$pid_file"
            rm -f "$pid_file"
        fi
    done
fi

# Kill legacy PID files
if [[ -f ".test-pid" ]]; then
    pid=$(cat ".test-pid" 2>/dev/null || echo "")
    [[ -n "$pid" ]] && safe_kill "$pid"
    rm -f ".test-pid"
fi

# Clean up any remaining test-related processes
echo "🧹 Cleaning up remaining test processes..."

# Kill playwright processes
playwright_pids=$(pgrep -f "playwright" 2>/dev/null || true)
for pid in $playwright_pids; do
    safe_kill "$pid"
done

# Kill test electron instances
test_electron_pids=$(pgrep -f "electron.*test|test.*electron" 2>/dev/null || true)
for pid in $test_electron_pids; do
    safe_kill "$pid"
done

# Kill MSS downloader test instances
project_name="$(basename "$PROJECT_ROOT")"
project_test_pids=$(pgrep -f "$project_name.*electron.*test|test.*electron.*$project_name" 2>/dev/null || true)
for pid in $project_test_pids; do
    safe_kill "$pid"
done

# Clean up temp test directories
echo "🗑️ Cleaning up test temp directories..."
find /var/folders -name "*electron-test*" -type d -exec rm -rf {} + 2>/dev/null || true

echo "✅ Test processes stopped and cleaned up"