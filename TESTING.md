# Testing Framework

This testing framework is designed for comprehensive validation of complex applications, with three distinct levels of guidance that can be applied across different project types.

## 1. Universal Testing Principles

These principles apply to any testing scenario - web applications, Node.js services, mobile apps, or desktop applications.

### Core Testing Philosophy
- **Verify, Don't Assume**: Always confirm that UI interactions and operations succeeded before proceeding
- **Systematic Validation**: Test one component/feature at a time with complete isolation between tests
- **Evidence-Based Testing**: Use screenshots, logs, and external validation tools to confirm results
- **Robust Error Handling**: Test both expected success paths and failure scenarios comprehensively

### Screenshot Strategy
- **Timestamped Screenshots**: Use ISO timestamps in filenames for precise debugging chronology
- **State Analysis**: Capture screenshots before/after critical operations to analyze state changes
- **Failure Documentation**: Always screenshot failure states with full context visible
- **Progress Monitoring**: Take periodic screenshots during long-running operations

### Test Autonomy Principles
- **Self-Healing Tests**: When operations fail, investigate and adapt rather than blindly retrying
- **Source Code Investigation**: When UI interactions fail, examine the actual implementation to understand why
- **Dynamic Problem Solving**: Use available debugging tools and evidence to modify test approach in real-time
- **Comprehensive Validation**: Don't just test happy paths - validate edge cases and error conditions

### Selector Strategy (Universal)
- **Stable Selectors**: Use data attributes, IDs, and CSS classes rather than text-based selectors
- **Hierarchy Awareness**: Understand component structure to select elements reliably
- **Fallback Strategies**: Have multiple selector approaches for critical elements
- **Cross-Platform Consistency**: Use selectors that work across different environments

## 2. Electron-Specific Testing

These practices are specific to Electron applications with their unique multi-process architecture.

### Electron Test Environment Setup
```bash
# Headless mode for CI/automated testing
npm run test:e2e

# Headed mode for debugging (only when needed)
npm run test:e2e:headed

# Debug mode with full DevTools access
npm run test:e2e:debug
```

### Electron Architecture Considerations
- **Process Communication**: Test IPC communication between main/renderer processes
- **Build Environment**: Always test against built versions, not dev server for production validation
- **Platform-Specific Issues**: Test builds on target platforms (macOS entitlements, Windows signing, etc.)
- **Native Integration**: Validate file system access, native dialogs, and OS-specific features

### Electron Headless Configuration
```typescript
// Configure Electron for headless testing
const electronApp = await electron.launch({
  args: [path.join(__dirname, '../../../dist/main/main.js'), '--headless'],
  env: { NODE_ENV: 'test' }
});

// Main process headless setup
const isHeadless = process.argv.includes('--headless') || process.env.NODE_ENV === 'test';
const mainWindow = new BrowserWindow({
  show: !isHeadless,
  ...(isHeadless && {
    x: -2000, y: -2000,
    skipTaskbar: true
  })
});
```

### Electron-Specific Testing Patterns
- **Build Validation**: Test distribution builds, not just development versions
- **State Persistence**: Validate `electron-store` and other persistence mechanisms
- **Security Configuration**: Test preload scripts, context isolation, and security policies
- **Update Mechanisms**: Validate auto-updater functionality if implemented

## 3. Project-Specific Testing (MSS Downloader)

These are the specific testing requirements for the manuscript downloader functionality.

### Manuscript Library Testing Protocol
```bash
# 1. Validate library URL patterns and manifest accessibility
curl -s "https://library-domain.com/iiif/manuscript-id/manifest.json" | head -20

# 2. Test manifest structure and image URL extraction
curl -s "https://manifest-url" | jq '.sequences[0].canvases[0].images[0].resource."@id"'

# 3. Verify manuscript count and structure
curl -s "https://manifest-url" | jq '.sequences[0].canvases | length'
```

### Download Validation Strategy
- **Auto-split Testing**: Configure 30MB thresholds and verify manuscripts split correctly
- **Progress Tracking**: Confirm real numerical progress (not stuck at 0%)
- **Queue Management**: Test start/pause/resume/stop with multiple manuscripts
- **PDF Validation**: Use poppler utilities (`pdfinfo`) to verify downloaded PDFs

### Library-Specific Testing Requirements
```typescript
// Test each supported library systematically
const testLibraries = [
  { name: 'Gallica (BnF)', url: 'https://gallica.bnf.fr/ark:/12148/...' },
  { name: 'e-codices (Unifr)', url: 'https://www.e-codices.ch/en/...' },
  { name: 'Vatican Library', url: 'https://digi.vatlib.it/view/...' },
  // ... etc
];

// Validation criteria for each library
for (const library of testLibraries) {
  // 1. Manifest loading success
  // 2. Proper display name extraction
  // 3. Page count accuracy
  // 4. Download initiation capability
}
```

### Critical Test Coverage Areas
- **Download Engine**: Real progress tracking with ETA calculations
- **Auto-split Functionality**: Large manuscripts properly divided at configured thresholds
- **Queue Persistence**: State maintained across application restarts
- **Error Recovery**: Proper handling of network failures, captcha requirements, server errors
- **File System Operations**: PDF creation, cache management, download folder access
- **UI State Management**: Settings persistence, progress updates, error display

### Performance Testing
- **Concurrent Downloads**: Validate multiple simultaneous downloads with configured concurrency
- **Large Manuscript Handling**: Test auto-split behavior with 1000+ page manuscripts
- **Memory Management**: Monitor memory usage during extended download sessions
- **Cache Efficiency**: Validate image caching and cleanup functionality

### Regression Testing
```bash
# Comprehensive test suite for all supported libraries
npm run test:e2e

# Specific library validation
npx playwright test tests/e2e/library-manifest-test.spec.ts

# Download functionality validation
npx playwright test tests/e2e/download-validation-test.spec.ts
```

This three-tier testing framework ensures comprehensive coverage while maintaining reusability across different project types and technical stacks.