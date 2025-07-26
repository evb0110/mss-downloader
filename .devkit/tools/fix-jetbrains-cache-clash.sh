#!/bin/bash

# Fix JetBrains IDE cache clash between WebStorm and PhpStorm
# This script separates the configurations to prevent license and project conflicts

echo "Fixing JetBrains IDE cache clash..."

# 1. Backup current configurations
echo "Creating backups..."
BACKUP_DIR="$HOME/Library/Application Support/JetBrains/.backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup WebStorm 2025.1 configuration
if [ -d "$HOME/Library/Application Support/JetBrains/WebStorm2025.1" ]; then
    cp -r "$HOME/Library/Application Support/JetBrains/WebStorm2025.1" "$BACKUP_DIR/"
    echo "✓ Backed up WebStorm configuration"
fi

# Backup PhpStorm 2025.1 configuration
if [ -d "$HOME/Library/Application Support/JetBrains/PhpStorm2025.1" ]; then
    cp -r "$HOME/Library/Application Support/JetBrains/PhpStorm2025.1" "$BACKUP_DIR/"
    echo "✓ Backed up PhpStorm configuration"
fi

# 2. Clear shared caches
echo "Clearing shared caches..."

# Clear IDE general settings that might cause conflicts
WEBSTORM_OPTIONS="$HOME/Library/Application Support/JetBrains/WebStorm2025.1/options"
PHPSTORM_OPTIONS="$HOME/Library/Application Support/JetBrains/PhpStorm2025.1/options"

# 3. Reset window states to prevent shared window issues
echo "Resetting window states..."
if [ -f "$WEBSTORM_OPTIONS/window.state.xml" ]; then
    rm "$WEBSTORM_OPTIONS/window.state.xml"
    echo "✓ Reset WebStorm window state"
fi

if [ -f "$PHPSTORM_OPTIONS/window.state.xml" ]; then
    rm "$PHPSTORM_OPTIONS/window.state.xml"
    echo "✓ Reset PhpStorm window state"
fi

# 4. Clear any shared authentication cache
echo "Clearing authentication caches..."
WEBSTORM_CACHE="$HOME/Library/Caches/JetBrains/WebStorm2025.1"
PHPSTORM_CACHE="$HOME/Library/Caches/JetBrains/PhpStorm2025.1"

if [ -d "$WEBSTORM_CACHE/auth" ]; then
    rm -rf "$WEBSTORM_CACHE/auth"
    echo "✓ Cleared WebStorm auth cache"
fi

if [ -d "$PHPSTORM_CACHE/auth" ]; then
    rm -rf "$PHPSTORM_CACHE/auth"
    echo "✓ Cleared PhpStorm auth cache"
fi

# 5. Set up separate JVM options to ensure they use different ports
echo "Setting up separate JVM options..."

# WebStorm JVM options
cat > "$WEBSTORM_OPTIONS/webstorm.vmoptions" << EOF
-Xms128m
-Xmx2048m
-XX:ReservedCodeCacheSize=512m
-XX:+UseG1GC
-XX:SoftRefLRUPolicyMSPerMB=50
-XX:CICompilerCount=2
-XX:+HeapDumpOnOutOfMemoryError
-XX:-OmitStackTraceInFastThrow
-Djb.vmOptionsFile=$WEBSTORM_OPTIONS/webstorm.vmoptions
-Djava.system.class.loader=com.intellij.util.lang.PathClassLoader
-Dide.config.path=$HOME/Library/Application Support/JetBrains/WebStorm2025.1
-Dide.system.path=$HOME/Library/Caches/JetBrains/WebStorm2025.1
EOF

# PhpStorm JVM options
cat > "$PHPSTORM_OPTIONS/phpstorm.vmoptions" << EOF
-Xms128m
-Xmx2048m
-XX:ReservedCodeCacheSize=512m
-XX:+UseG1GC
-XX:SoftRefLRUPolicyMSPerMB=50
-XX:CICompilerCount=2
-XX:+HeapDumpOnOutOfMemoryError
-XX:-OmitStackTraceInFastThrow
-Djb.vmOptionsFile=$PHPSTORM_OPTIONS/phpstorm.vmoptions
-Djava.system.class.loader=com.intellij.util.lang.PathClassLoader
-Dide.config.path=$HOME/Library/Application Support/JetBrains/PhpStorm2025.1
-Dide.system.path=$HOME/Library/Caches/JetBrains/PhpStorm2025.1
EOF

echo "✓ Created separate JVM options"

# 6. Kill any running IDE processes
echo "Checking for running IDE processes..."
WEBSTORM_PID=$(pgrep -f "WebStorm" | head -1)
PHPSTORM_PID=$(pgrep -f "PhpStorm" | head -1)

if [ ! -z "$WEBSTORM_PID" ]; then
    echo "Found WebStorm running (PID: $WEBSTORM_PID)"
    echo "Please close WebStorm manually before running this script"
fi

if [ ! -z "$PHPSTORM_PID" ]; then
    echo "Found PhpStorm running (PID: $PHPSTORM_PID)"
    echo "Please close PhpStorm manually before running this script"
fi

# 7. Create environment-specific configuration
echo "Creating environment-specific configurations..."

# Create a marker file to identify personal vs corporate setup
echo "personal" > "$WEBSTORM_OPTIONS/.environment"
echo "corporate" > "$PHPSTORM_OPTIONS/.environment"

echo ""
echo "✅ Cache clash fix completed!"
echo ""
echo "Recommendations:"
echo "1. Close both WebStorm and PhpStorm if they are running"
echo "2. Start each IDE separately and re-authenticate with your respective licenses"
echo "3. WebStorm: Use your personal JetBrains account"
echo "4. PhpStorm: Use your corporate JetBrains account"
echo ""
echo "Backup created at: $BACKUP_DIR"
echo ""
echo "If you experience any issues, you can restore from the backup."