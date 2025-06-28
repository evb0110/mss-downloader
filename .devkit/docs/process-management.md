# Process Management Documentation

## Overview

The MSS Downloader now includes comprehensive process management to prevent orphaned Electron instances and provide better control over development and testing processes.

## Problem Solved

Previously, Electron processes could be left running after development or testing sessions, consuming system resources and potentially causing conflicts. This was due to:

1. Inadequate PID tracking
2. Missing cleanup for child processes
3. No cleanup for test/Playwright processes
4. No handling of process trees

## Solution

### Enhanced PID Management

All development and test processes now use enhanced scripts with:

- **Robust PID tracking**: Tracks main process and all children
- **Automatic cleanup**: Cleanup functions run on script exit
- **Safe termination**: Graceful TERM followed by force KILL if needed
- **Comprehensive coverage**: Handles all process types

### Available Commands

#### Process Control
```bash
# Start development with PID tracking
npm run dev:start

# Stop all development processes
npm run dev:kill

# Start headless development
npm run dev:headless:start

# Stop headless development
npm run dev:headless:kill

# Start tests with PID tracking
npm run test:e2e:start

# Stop all test processes
npm run test:e2e:kill
```

#### Process Monitoring & Cleanup
```bash
# Monitor running processes
npm run ps

# Clean up all project processes
npm run cleanup

# Comprehensive cleanup (all process types)
npm run cleanup:all
```

### Script Locations

All process management scripts are located in `.devkit/tools/`:

- `start-dev.sh` - Enhanced development starter
- `kill-dev.sh` - Development process killer
- `start-dev-headless.sh` - Headless development starter  
- `kill-dev-headless.sh` - Headless process killer
- `start-tests.sh` - Test process starter
- `kill-tests.sh` - Test process killer
- `cleanup-processes.sh` - Comprehensive cleanup
- `monitor-processes.sh` - Process monitoring
- `auto-cleanup-atexit.sh` - Auto-cleanup on shell exit

### PID File Structure

PID files are now organized in `.devkit/pids/`:

```
.devkit/pids/
├── dev-main.pid           # Main development process
├── dev-children.pid       # Development child processes
├── dev-headless-main.pid  # Headless main process
├── test-main.pid          # Test main process
├── test-children.pid      # Test child processes
└── test-electron.pid      # Test electron instances
```

### Features

#### Automatic Cleanup
- All scripts register cleanup functions that run on exit
- Handles SIGINT, SIGTERM, and normal exit
- Cleans up both main processes and children

#### Safe Process Termination
1. Send TERM signal for graceful shutdown
2. Wait 1 second for process to exit
3. Send KILL signal if process still running
4. Remove PID files after cleanup

#### Comprehensive Coverage
- Project-specific electron instances
- Playwright/test processes
- Concurrently processes
- Temp electron instances in `/var/folders`
- Zombie processes

#### Process Monitoring
- Real-time process detection
- Memory usage tracking
- PID file validation
- Stale process identification

## Usage Examples

### Daily Development
```bash
# Start development
npm run dev:start

# When done (or in another terminal)
npm run dev:kill
```

### Testing
```bash
# Start tests
npm run test:e2e:start

# Monitor what's running
npm run ps

# Clean up when done
npm run test:e2e:kill
```

### Emergency Cleanup
```bash
# If processes are stuck
npm run cleanup:all

# Check if anything is still running
npm run ps
```

### Monitoring
```bash
# Check current process status
npm run ps

# Output shows:
# - Running processes by category
# - PID file status
# - Memory usage
# - Cleanup recommendations
```

## Troubleshooting

### If processes won't stop
```bash
# Try comprehensive cleanup
npm run cleanup:all

# If still running, use the nuclear option
.devkit/tools/cleanup-processes.sh
```

### If PID files are stale
```bash
# Monitor will show stale PID files
npm run ps

# Cleanup will remove stale files
npm run cleanup
```

### For automatic cleanup
```bash
# Source the auto-cleanup script in your shell profile
source .devkit/tools/auto-cleanup-atexit.sh
```

## Technical Details

### Process Tree Handling
- Uses `pgrep -P` to find child processes
- Kills children before parents
- Handles deeply nested process trees

### Signal Handling
- TERM signal for graceful shutdown
- KILL signal for forced termination
- Proper exit code handling

### Cross-Platform Compatibility
- Uses portable shell commands
- Handles macOS process management quirks
- Works with different temp directory structures

## Best Practices

1. **Always use PID-safe commands**: Use `npm run dev:start` instead of `npm run dev`
2. **Monitor regularly**: Run `npm run ps` to check for orphaned processes
3. **Clean up after testing**: Use `npm run test:e2e:kill` after test sessions
4. **Use comprehensive cleanup**: Run `npm run cleanup:all` for thorough cleaning

## Migration from Old System

Old commands are still available but deprecated:
- `npm run dev` → Use `npm run dev:start`
- `npm run test:e2e` → Use `npm run test:e2e:start`
- Manual `killall` → Use `npm run cleanup`

The new system is backward compatible but provides much better process management.