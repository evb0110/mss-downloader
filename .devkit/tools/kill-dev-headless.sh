#!/bin/bash

# Enhanced Headless Dev Kill Script
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "🛑 Stopping headless development processes..."

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
    for pid_file in .devkit/pids/dev-headless-*.pid; do
        if [[ -f "$pid_file" ]]; then
            while IFS= read -r pid; do
                [[ -n "$pid" ]] && safe_kill "$pid"
            done < "$pid_file"
            rm -f "$pid_file"
        fi
    done
fi

# Kill legacy PID files
if [[ -f ".dev-headless-pid" ]]; then
    pid=$(cat ".dev-headless-pid" 2>/dev/null || echo "")
    [[ -n "$pid" ]] && safe_kill "$pid"
    rm -f ".dev-headless-pid"
fi

echo "✅ Headless development processes stopped"