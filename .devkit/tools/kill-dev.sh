#!/bin/bash

# Enhanced Dev Kill Script with comprehensive cleanup
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "🛑 Stopping development processes..."

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
    for pid_file in .devkit/pids/dev-*.pid; do
        if [[ -f "$pid_file" ]]; then
            while IFS= read -r pid; do
                [[ -n "$pid" ]] && safe_kill "$pid"
            done < "$pid_file"
            rm -f "$pid_file"
        fi
    done
fi

# Kill legacy PID files
for legacy_pid in .dev-pid .dev-headless-pid; do
    if [[ -f "$legacy_pid" ]]; then
        pid=$(cat "$legacy_pid" 2>/dev/null || echo "")
        [[ -n "$pid" ]] && safe_kill "$pid"
        rm -f "$legacy_pid"
    fi
done

# Clean up any remaining project processes
echo "🧹 Cleaning up remaining processes..."
project_pids=$(pgrep -f "$(basename "$PROJECT_ROOT").*electron|electron.*$(basename "$PROJECT_ROOT")" 2>/dev/null || true)
for pid in $project_pids; do
    safe_kill "$pid"
done

# Clean up concurrently processes
concurrently_pids=$(pgrep -f "concurrently.*MAIN.*RENDERER" 2>/dev/null || true)
for pid in $concurrently_pids; do
    safe_kill "$pid"
done

echo "✅ Development processes stopped"