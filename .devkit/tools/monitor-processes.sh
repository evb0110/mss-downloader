#!/bin/bash

# Process Monitor for MSS Downloader
# Helps identify and monitor running electron instances

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT_NAME="$(basename "$PROJECT_ROOT")"

echo "🔍 Process Monitor for $PROJECT_NAME"
echo "=================================="

# Function to show process details
show_processes() {
    local label="$1"
    local pattern="$2"
    local pids=$(pgrep -f "$pattern" 2>/dev/null || true)
    
    if [[ -n "$pids" ]]; then
        echo -e "\n📋 $label:"
        for pid in $pids; do
            echo "  PID $pid: $(ps -p $pid -o command= 2>/dev/null | cut -c1-100)..."
        done
        return 0
    else
        echo -e "\n✅ $label: None found"
        return 1
    fi
}

# Check various process categories
echo -e "\n🔍 Checking for running processes..."

has_processes=false

# 1. Project-specific processes
if show_processes "Project Electron Instances" "$PROJECT_ROOT"; then
    has_processes=true
fi

# 2. General project processes
if show_processes "Project Processes (by name)" "$PROJECT_NAME.*electron|electron.*$PROJECT_NAME"; then
    has_processes=true
fi

# 3. Test processes
if show_processes "Test/Playwright Processes" "playwright.*electron|electron.*test"; then
    has_processes=true
fi

# 4. Temp electron instances
if show_processes "Temp Electron Instances" "/var/folders.*electron.*test"; then
    has_processes=true
fi

# 5. Development processes
if show_processes "Concurrently Processes" "concurrently.*MAIN.*RENDERER"; then
    has_processes=true
fi

# Check PID files
echo -e "\n📂 Checking PID files..."
pid_files_found=false

if [[ -d ".devkit/pids" ]]; then
    for pid_file in .devkit/pids/*.pid; do
        if [[ -f "$pid_file" ]]; then
            pid=$(cat "$pid_file" 2>/dev/null || echo "")
            if [[ -n "$pid" ]]; then
                echo "  $(basename "$pid_file"): PID $pid"
                if kill -0 "$pid" 2>/dev/null; then
                    echo "    ✅ Process is running"
                else
                    echo "    ❌ Process not found (stale PID file)"
                fi
                pid_files_found=true
            fi
        fi
    done
fi

# Check legacy PID files
for legacy_pid in .dev-pid .dev-headless-pid .test-pid; do
    if [[ -f "$legacy_pid" ]]; then
        pid=$(cat "$legacy_pid" 2>/dev/null || echo "")
        if [[ -n "$pid" ]]; then
            echo "  $legacy_pid: PID $pid (legacy)"
            if kill -0 "$pid" 2>/dev/null; then
                echo "    ✅ Process is running"
            else
                echo "    ❌ Process not found (stale PID file)"
            fi
            pid_files_found=true
        fi
    fi
done

if ! $pid_files_found; then
    echo "  ✅ No PID files found"
fi

# Summary and recommendations
echo -e "\n📊 Summary:"
if $has_processes; then
    echo "  ⚠️ Found running processes"
    echo -e "\n💡 To clean up all processes, run:"
    echo "    npm run cleanup"
    echo "    npm run cleanup:all  # For comprehensive cleanup"
else
    echo "  ✅ No project processes found running"
fi

# Resource usage
echo -e "\n💻 Resource Usage:"
total_memory=$(ps aux | grep -E "$PROJECT_NAME|electron.*$PROJECT_ROOT" | grep -v grep | awk '{sum += $6} END {print sum/1024 " MB"}' 2>/dev/null || echo "0 MB")
process_count=$(ps aux | grep -E "$PROJECT_NAME|electron.*$PROJECT_ROOT" | grep -v grep | wc -l)
echo "  Memory used by project processes: $total_memory"
echo "  Total project processes: $process_count"

echo -e "\n✨ Process monitoring completed!"