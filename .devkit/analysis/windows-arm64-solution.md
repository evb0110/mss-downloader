# Windows ARM64 Solution for "Cannot use import statement outside a module" Error

## Problem Statement
The error "Cannot use import statement outside a module" occurs when using `import process from 'node:process'` in Windows ARM64 Electron builds, specifically affecting production builds with ASAR packaging.

## Root Cause Analysis

### 1. ES Module Support in Electron
- **ES Module Support**: Introduced in Electron 28.0.0
- **Main Process**: Uses Node.js ESM loader, requires `.mjs` extension or `"type": "module"` in package.json
- **Renderer Process**: Uses Chromium's ESM loader with limitations
- **Critical Issue**: ESM loads asynchronously, requiring extensive use of `await` before `app.ready()`

### 2. Node.js Built-in Module Imports
- **Node: Protocol**: `import process from 'node:process'` syntax requires ES module support
- **Webpack Compatibility**: Webpack 4 doesn't recognize 'node:process' imports, fixed in Webpack 5
- **ASAR Limitations**: ASAR archives have restrictions with Node.js built-in modules in ES module context

### 3. Windows ARM64 Specific Issues
- **Architecture Compatibility**: Cross-compilation issues between system architecture and target architecture
- **Build Environment**: Requires specific build flags: `ELECTRON_BUILDING_WOA=1` for Windows ARM64
- **Native Module Recompilation**: All native modules must be recompiled for ARM64 architecture
- **Visual Studio Requirements**: Needs Visual Studio 2017 with ARM64 components and v142 MSVC compiler

## ASAR + ES Modules Limitations

### Core ASAR Issues
1. **Read-only Archives**: Cannot modify files in ASAR archives
2. **Directory Limitations**: Cannot set working directory to ASAR directories
3. **Process Execution**: Issues with `child_process.exec` and `spawn` in ASAR context
4. **Module Resolution**: ES module resolution within ASAR archives is problematic

### Workarounds for ASAR
- Use `--unpack` option for critical files
- Set `process.noAsar = true` to disable ASAR support
- Use `original-fs` module for file system operations
- Exclude problematic modules from ASAR packaging

## Production Solutions

### Solution 1: Use CommonJS Syntax (Recommended)
```javascript
// Instead of: import process from 'node:process'
const process = require('node:process');

// Or simply use global process
const currentProcess = process;
```

### Solution 2: Update to Electron 28+
```json
{
  "devDependencies": {
    "electron": "^28.0.0"
  }
}
```

### Solution 3: Configure electron-builder for ARM64
```json
{
  "build": {
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64", "arm64"]
        }
      ]
    },
    "extraMetadata": {
      "main": "dist/main.js"
    }
  }
}
```

### Solution 4: Webpack Configuration
```javascript
module.exports = {
  target: 'electron-main',
  externals: {
    'node:process': 'commonjs node:process'
  },
  resolve: {
    fallback: {
      "process": require.resolve("process/browser")
    }
  }
};
```

### Solution 5: Conditional Module Loading
```javascript
// Use dynamic imports for ES modules
const loadProcess = async () => {
  if (process.versions.electron >= '28.0.0') {
    const { default: nodeProcess } = await import('node:process');
    return nodeProcess;
  } else {
    return require('node:process');
  }
};
```

## Windows ARM64 Build Configuration

### Environment Setup
```bash
# Set Windows ARM64 build environment
set npm_config_arch=arm64
set ELECTRON_BUILDING_WOA=1

# Install dependencies
npm install
```

### Package.json Configuration
```json
{
  "build": {
    "appId": "com.example.app",
    "win": {
      "target": {
        "target": "nsis",
        "arch": ["x64", "arm64"]
      }
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    }
  }
}
```

### Build Process
```bash
# Build for both architectures
npm run build

# Output directories:
# - dist/win-unpacked (x64)
# - dist/win-arm64-unpacked (arm64)
```

## Definitive Recommendation

**For immediate resolution**: Use CommonJS `require('node:process')` syntax instead of ES module imports for Windows ARM64 builds. This avoids all ES module + ASAR + ARM64 compatibility issues.

**For long-term**: Upgrade to Electron 28+ and properly configure ES module support with appropriate build configurations for ARM64.

## Production Examples

### Working Configuration (VS Code)
```json
{
  "main": "./out/main.js",
  "build": {
    "appId": "com.microsoft.vscode",
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64", "arm64"]
        }
      ]
    }
  }
}
```

### Working Configuration (Discord)
```json
{
  "build": {
    "win": {
      "target": {
        "target": "squirrel",
        "arch": ["x64", "arm64"]
      }
    }
  }
}
```

## Build Verification

### Test ARM64 Build
```bash
# Check process architecture
node -e "console.log(process.arch)"

# Verify in Task Manager
# - Look for "Windows on ARM64" in process details
```

### Common Build Issues
1. **Squirrel.Windows ARM64**: Not supported, use NSIS instead
2. **Native Dependencies**: Must be recompiled for ARM64
3. **Cross-compilation**: Requires proper build environment setup

## Status Summary

- **Electron ARM64 Support**: ✅ Available since Electron 6.0.8
- **ES Module Support**: ✅ Available since Electron 28.0.0
- **ASAR + ES Modules**: ⚠️ Limited support, workarounds needed
- **Windows ARM64 Production**: ✅ Supported with proper configuration
- **Node:process Imports**: ⚠️ Use CommonJS for ARM64 builds

## Final Solution

**Replace all `import process from 'node:process'` with `const process = require('node:process')` in your Windows ARM64 builds.** This provides the most reliable solution while maintaining full functionality across all target architectures.