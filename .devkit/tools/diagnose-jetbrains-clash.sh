#!/bin/bash

# Diagnose JetBrains IDE cache clash issues

echo "JetBrains IDE Cache Clash Diagnostic"
echo "===================================="
echo ""

# Check running processes
echo "1. Checking running IDE processes..."
WEBSTORM_PROCS=$(pgrep -fl "WebStorm" 2>/dev/null)
PHPSTORM_PROCS=$(pgrep -fl "PhpStorm" 2>/dev/null)

if [ ! -z "$WEBSTORM_PROCS" ]; then
    echo "⚠️  WebStorm is running:"
    echo "$WEBSTORM_PROCS"
else
    echo "✓ WebStorm is not running"
fi

if [ ! -z "$PHPSTORM_PROCS" ]; then
    echo "⚠️  PhpStorm is running:"
    echo "$PHPSTORM_PROCS"
else
    echo "✓ PhpStorm is not running"
fi

echo ""

# Check license files
echo "2. Checking license configurations..."
WEBSTORM_KEY="$HOME/Library/Application Support/JetBrains/WebStorm2025.1/webstorm.key"
PHPSTORM_KEY="$HOME/Library/Application Support/JetBrains/PhpStorm2025.1/phpstorm.key"

if [ -f "$WEBSTORM_KEY" ]; then
    echo "✓ WebStorm license found"
    # Extract username from license without showing full key
    grep -o '"userName":"[^"]*"' "$WEBSTORM_KEY" 2>/dev/null | head -1
else
    echo "✗ WebStorm license not found"
fi

if [ -f "$PHPSTORM_KEY" ]; then
    echo "✓ PhpStorm license found"
    # Extract username from license without showing full key
    grep -o '"userName":"[^"]*"' "$PHPSTORM_KEY" 2>/dev/null | head -1
else
    echo "✗ PhpStorm license not found"
fi

echo ""

# Check for shared preferences
echo "3. Checking shared preferences..."
PREFS_DIR="$HOME/Library/Preferences"
SHARED_PREFS=$(ls -la "$PREFS_DIR" | grep -E "jetbrains\.(ws|ps)\.(251|csat)\.plist" | wc -l)
echo "Found $SHARED_PREFS JetBrains preference files"

echo ""

# Check recent projects overlap
echo "4. Checking project configurations..."
WEBSTORM_RECENT="$HOME/Library/Application Support/JetBrains/WebStorm2025.1/options/recentProjects.xml"
PHPSTORM_RECENT="$HOME/Library/Application Support/JetBrains/PhpStorm2025.1/options/recentProjects.xml"

if [ -f "$WEBSTORM_RECENT" ] && [ -f "$PHPSTORM_RECENT" ]; then
    # Extract project paths and check for overlap
    WS_PROJECTS=$(grep -o 'path="[^"]*"' "$WEBSTORM_RECENT" 2>/dev/null | cut -d'"' -f2 | sort | uniq)
    PS_PROJECTS=$(grep -o 'path="[^"]*"' "$PHPSTORM_RECENT" 2>/dev/null | cut -d'"' -f2 | sort | uniq)
    
    SHARED_PROJECTS=$(echo "$WS_PROJECTS" | grep -Fx -f <(echo "$PS_PROJECTS") | wc -l)
    
    echo "WebStorm projects: $(echo "$WS_PROJECTS" | wc -l)"
    echo "PhpStorm projects: $(echo "$PS_PROJECTS" | wc -l)"
    echo "Shared projects: $SHARED_PROJECTS"
    
    if [ $SHARED_PROJECTS -gt 0 ]; then
        echo "⚠️  Warning: Found shared projects between IDEs"
    fi
fi

echo ""

# Check for port conflicts
echo "5. Checking for port conflicts..."
WEBSTORM_PORTS=$(lsof -i -P | grep -i webstorm | grep LISTEN 2>/dev/null)
PHPSTORM_PORTS=$(lsof -i -P | grep -i phpstorm | grep LISTEN 2>/dev/null)

if [ ! -z "$WEBSTORM_PORTS" ]; then
    echo "WebStorm listening ports:"
    echo "$WEBSTORM_PORTS"
fi

if [ ! -z "$PHPSTORM_PORTS" ]; then
    echo "PhpStorm listening ports:"
    echo "$PHPSTORM_PORTS"
fi

echo ""

# Check cache sizes
echo "6. Checking cache sizes..."
if [ -d "$HOME/Library/Caches/JetBrains/WebStorm2025.1" ]; then
    WS_CACHE_SIZE=$(du -sh "$HOME/Library/Caches/JetBrains/WebStorm2025.1" 2>/dev/null | cut -f1)
    echo "WebStorm cache: $WS_CACHE_SIZE"
fi

if [ -d "$HOME/Library/Caches/JetBrains/PhpStorm2025.1" ]; then
    PS_CACHE_SIZE=$(du -sh "$HOME/Library/Caches/JetBrains/PhpStorm2025.1" 2>/dev/null | cut -f1)
    echo "PhpStorm cache: $PS_CACHE_SIZE"
fi

echo ""

# Check for JetBrains Toolbox
echo "7. Checking for JetBrains Toolbox..."
if [ -d "/Applications/JetBrains Toolbox.app" ]; then
    echo "⚠️  JetBrains Toolbox is installed"
    echo "   This might be managing IDE instances"
else
    echo "✓ JetBrains Toolbox not found"
fi

echo ""
echo "Diagnostic complete!"
echo ""
echo "Recommendations based on findings:"
echo "1. If both IDEs are running, close them before applying fixes"
echo "2. Run fix-jetbrains-cache-clash.sh to separate configurations"
echo "3. Use prevent-jetbrains-clash.sh to create isolated launchers"
echo "4. Consider using different user accounts for personal/corporate IDEs"