#!/bin/bash

# Advanced Process Cleanup for MSS Downloader
# Prevents orphaned electron instances and provides comprehensive cleanup

set -e

PROJECT_ROOT="/Users/e.barsky/Desktop/Personal/Electron/mss-downloader"
PROJECT_NAME="mss-downloader"

echo "🧹 Starting comprehensive process cleanup for $PROJECT_NAME..."

# Function to safely kill processes
safe_kill() {
    local pid=$1
    local signal=${2:-TERM}
    
    if kill -0 "$pid" 2>/dev/null; then
        echo "  Killing process $pid with signal $signal"
        kill -"$signal" "$pid" 2>/dev/null || true
        sleep 1
        
        # If still running, force kill
        if kill -0 "$pid" 2>/dev/null; then
            echo "  Force killing process $pid"
            kill -9 "$pid" 2>/dev/null || true
        fi
    fi
}

# 1. Clean up PID-tracked processes
echo "📋 Cleaning up PID-tracked processes..."
for pid_file in "$PROJECT_ROOT"/.*.pid; do
    if [[ -f "$pid_file" ]]; then
        pid=$(cat "$pid_file" 2>/dev/null || echo "")
        if [[ -n "$pid" ]] && [[ "$pid" =~ ^[0-9]+$ ]]; then
            echo "  Found PID file: $(basename "$pid_file") -> $pid"
            
            # Kill child processes first
            pkill -P "$pid" 2>/dev/null || true
            sleep 1
            
            # Kill main process
            safe_kill "$pid"
        fi
        rm -f "$pid_file"
        echo "  Removed PID file: $(basename "$pid_file")"
    fi
done

# 2. Clean up all electron instances related to this project
echo "🔍 Finding project-specific electron instances..."

# Find processes by project path
project_pids=$(pgrep -f "$PROJECT_ROOT" 2>/dev/null || true)
if [[ -n "$project_pids" ]]; then
    echo "  Found project processes: $project_pids"
    for pid in $project_pids; do
        safe_kill "$pid"
    done
fi

# Find electron processes with project name
electron_pids=$(pgrep -f "electron.*$PROJECT_NAME|$PROJECT_NAME.*electron" 2>/dev/null || true)
if [[ -n "$electron_pids" ]]; then
    echo "  Found electron processes: $electron_pids"
    for pid in $electron_pids; do
        safe_kill "$pid"
    done
fi

# 3. Clean up playwright/test processes
echo "🎭 Cleaning up playwright/test processes..."
playwright_pids=$(pgrep -f "playwright.*electron|electron.*playwright" 2>/dev/null || true)
if [[ -n "$playwright_pids" ]]; then
    echo "  Found playwright processes: $playwright_pids"
    for pid in $playwright_pids; do
        safe_kill "$pid"
    done
fi

# 4. Clean up any remaining electron helper processes in temp directories
echo "🗂️ Cleaning up temp electron instances..."
temp_electron_pids=$(pgrep -f "/var/folders.*electron.*test" 2>/dev/null || true)
if [[ -n "$temp_electron_pids" ]]; then
    echo "  Found temp electron processes: $temp_electron_pids"
    for pid in $temp_electron_pids; do
        safe_kill "$pid"
    done
fi

# 5. Clean up any zombie node processes
echo "⚰️ Cleaning up zombie node processes..."
zombie_pids=$(ps aux | grep '[Zz]ombie' | grep -E 'node|electron' | awk '{print $2}' || true)
if [[ -n "$zombie_pids" ]]; then
    echo "  Found zombie processes: $zombie_pids"
    for pid in $zombie_pids; do
        safe_kill "$pid" KILL
    done
fi

# 6. Clean up temp directories
echo "🗑️ Cleaning up temporary directories..."
find /var/folders -name "*electron-test*" -type d -exec rm -rf {} + 2>/dev/null || true

# 7. Verification
echo "✅ Verification..."
remaining_processes=$(ps aux | grep -E "$PROJECT_ROOT|$PROJECT_NAME.*electron|electron.*$PROJECT_NAME" | grep -v grep | wc -l)
echo "  Remaining project processes: $remaining_processes"

if [[ "$remaining_processes" -eq 0 ]]; then
    echo "🎉 All processes cleaned up successfully!"
else
    echo "⚠️ Some processes may still be running:"
    ps aux | grep -E "$PROJECT_ROOT|$PROJECT_NAME.*electron|electron.*$PROJECT_NAME" | grep -v grep || true
fi

echo "✨ Process cleanup completed!"