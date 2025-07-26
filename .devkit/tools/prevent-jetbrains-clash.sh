#!/bin/bash

# Prevent JetBrains IDE cache clash by setting up proper isolation

echo "Setting up JetBrains IDE isolation..."

# Create separate launcher scripts with environment variables
WEBSTORM_LAUNCHER="$HOME/.local/bin/webstorm-personal"
PHPSTORM_LAUNCHER="$HOME/.local/bin/phpstorm-corporate"

mkdir -p "$HOME/.local/bin"

# WebStorm launcher (Personal)
cat > "$WEBSTORM_LAUNCHER" << 'EOF'
#!/bin/bash
# WebStorm Personal Launcher

# Set unique instance ID to prevent sharing
export WEBSTORM_PROPERTIES="$HOME/Library/Application Support/JetBrains/WebStorm2025.1/idea.properties"

# Create properties file if it doesn't exist
mkdir -p "$(dirname "$WEBSTORM_PROPERTIES")"
cat > "$WEBSTORM_PROPERTIES" << PROPS
# WebStorm Personal Instance
idea.config.path=$HOME/Library/Application Support/JetBrains/WebStorm2025.1
idea.system.path=$HOME/Library/Caches/JetBrains/WebStorm2025.1
idea.plugins.path=$HOME/Library/Application Support/JetBrains/WebStorm2025.1/plugins
idea.log.path=$HOME/Library/Logs/JetBrains/WebStorm2025.1
PROPS

# Launch WebStorm
open -a "WebStorm" --args -Didea.properties.file="$WEBSTORM_PROPERTIES"
EOF

# PhpStorm launcher (Corporate)
cat > "$PHPSTORM_LAUNCHER" << 'EOF'
#!/bin/bash
# PhpStorm Corporate Launcher

# Set unique instance ID to prevent sharing
export PHPSTORM_PROPERTIES="$HOME/Library/Application Support/JetBrains/PhpStorm2025.1/idea.properties"

# Create properties file if it doesn't exist
mkdir -p "$(dirname "$PHPSTORM_PROPERTIES")"
cat > "$PHPSTORM_PROPERTIES" << PROPS
# PhpStorm Corporate Instance
idea.config.path=$HOME/Library/Application Support/JetBrains/PhpStorm2025.1
idea.system.path=$HOME/Library/Caches/JetBrains/PhpStorm2025.1
idea.plugins.path=$HOME/Library/Application Support/JetBrains/PhpStorm2025.1/plugins
idea.log.path=$HOME/Library/Logs/JetBrains/PhpStorm2025.1
PROPS

# Launch PhpStorm
open -a "PhpStorm" --args -Didea.properties.file="$PHPSTORM_PROPERTIES"
EOF

chmod +x "$WEBSTORM_LAUNCHER"
chmod +x "$PHPSTORM_LAUNCHER"

echo "✓ Created isolated launcher scripts"
echo ""
echo "Usage:"
echo "  Personal WebStorm: $WEBSTORM_LAUNCHER"
echo "  Corporate PhpStorm: $PHPSTORM_LAUNCHER"
echo ""
echo "You can add these to your shell aliases:"
echo "  alias webstorm='$WEBSTORM_LAUNCHER'"
echo "  alias phpstorm='$PHPSTORM_LAUNCHER'"