# Playwright MCP Testing Guide for Electron App

## Overview

This guide explains how to use Playwright MCP (Model Context Protocol) to interact with the Electron manuscript downloader app for testing, validation, and automated downloads.

## Key Principles

### 1. Electron Single-Instance Lock Limitation
- **NEVER run `npm run dev` or launch Electron directly** - causes single-instance lock conflicts
- **User must launch the app** themselves via normal means (UI or command)
- **Claude connects to running instance** using Playwright MCP tools

### 2. Connection Method
```javascript
// Launch fresh Electron instance
const electronApp = await electron.launch({
    args: ['dist/main/main.js'],
    timeout: 60000,
});

const page = await electronApp.firstWindow();
await page.waitForLoadState('domcontentloaded');
```

## Complete Workflow Example

### Step 1: User Launches App
User runs `npm run dev` or starts app normally. App runs on port 5173.

### Step 2: Claude Connects via MCP
```javascript
const { _electron: electron } = require('playwright');

async function connectAndDownload() {
    let electronApp;
    let page;
    
    try {
        // Connect to fresh Electron instance
        electronApp = await electron.launch({
            args: ['dist/main/main.js'],
            timeout: 60000,
        });
        
        page = await electronApp.firstWindow();
        await page.waitForLoadState('domcontentloaded');
        
        // Wait for full initialization
        await page.waitForTimeout(8000);
        
        // Take screenshot to verify UI
        await page.screenshot({ path: '.devkit/validation/01-app-ui.png' });
        
        // Find and interact with elements
        const urlInput = await page.waitForSelector('textarea', { timeout: 10000 });
        await urlInput.fill('https://example.com/manuscript-url');
        
        const addButton = await page.waitForSelector('button:has-text("Add")', { timeout: 10000 });
        await addButton.click();
        
        // Wait for processing
        await page.waitForTimeout(10000);
        
        // Start download
        const startButton = await page.waitForSelector('button:has-text("Start")', { timeout: 10000 });
        await startButton.click();
        
        // Monitor progress with comprehensive logging
        page.on('console', msg => {
            const text = msg.text();
            const timestamp = new Date().toLocaleTimeString();
            console.log(`[${timestamp}] ${text}`);
            
            // Track specific events
            if (text.includes('[Roman Archive]') || text.includes('completed')) {
                // Handle progress updates
            }
        });
        
        // Wait for completion
        const maxWaitTime = 20 * 60 * 1000; // 20 minutes
        // ... monitoring logic
        
    } catch (error) {
        console.error('Error:', error.message);
        
        if (page) {
            await page.screenshot({ path: '.devkit/validation/error.png' });
        }
    } finally {
        console.log('Keeping app running for continued processing...');
        // Don't close app - let download complete
    }
}
```

## Element Selection Strategies

### Finding Input Fields
```javascript
// Try multiple selectors
let urlInput;
try {
    urlInput = await page.waitForSelector('textarea', { timeout: 10000 });
} catch (e1) {
    try {
        urlInput = await page.waitForSelector('input[type="text"]', { timeout: 5000 });
    } catch (e2) {
        urlInput = await page.waitForSelector('[data-testid="url-input"]', { timeout: 5000 });
    }
}
```

### Finding Buttons
```javascript
// Text-based selection
let addButton = await page.waitForSelector('button:has-text("Add")', { timeout: 10000 });

// Fallback approaches
try {
    startButton = await page.waitForSelector('button:has-text("Start")', { timeout: 10000 });
} catch (e) {
    const buttons = await page.locator('button').all();
    for (let i = 0; i < buttons.length; i++) {
        const text = await buttons[i].textContent();
        if (text && text.includes('Start')) {
            startButton = buttons[i];
            break;
        }
    }
}
```

## Monitoring and Validation

### Console Log Monitoring
```javascript
let downloadCompleted = false;
let pagesDiscovered = 0;
let progressUpdates = 0;

page.on('console', msg => {
    const text = msg.text();
    const timestamp = new Date().toLocaleTimeString();
    
    console.log(`[${timestamp}] ${text}`);
    
    // Track library-specific activity
    if (text.includes('[Roman Archive]')) {
        downloadStarted = true;
        
        // Extract page count
        const pageMatch = text.match(/(\d+)\s+pages/i);
        if (pageMatch) {
            pagesDiscovered = parseInt(pageMatch[1]);
        }
    }
    
    // Track completion
    if (text.toLowerCase().includes('completed')) {
        downloadCompleted = true;
    }
    
    // Track errors
    if (text.includes('error') || text.includes('404')) {
        console.log(`❌ ERROR: ${text}`);
    }
});
```

### Screenshot Documentation
```javascript
// Initial state
await page.screenshot({ path: '.devkit/validation/01-initial.png' });

// After adding manuscript
await page.screenshot({ path: '.devkit/validation/02-added.png' });

// Progress screenshots
await page.screenshot({ 
    path: `.devkit/validation/progress-${elapsedMinutes}min.png`,
    fullPage: true 
});

// Final state
await page.screenshot({ 
    path: '.devkit/validation/final-complete.png',
    fullPage: true 
});
```

## Validation Criteria

### Success Indicators
- **Download Started**: Console shows library-specific logs
- **Correct Page Count**: Discovered pages match expected (e.g., 383 for Roman Archive)
- **No 404 Errors**: Server-discovered filenames working properly
- **Progress Updates**: Regular download progress messages
- **File Creation**: PDF files appear in Downloads folder

### Failure Indicators
- **Single Instance Errors**: "Another instance is already running"
- **Element Not Found**: Selectors failing to find UI components
- **404 Errors**: Pattern-based filename assumptions failing
- **Timeout**: No progress for extended periods

## File Organization

### Validation Folder Structure
```
.devkit/validation/READY-FOR-USER/
├── 01-app-ui.png              # Initial UI state
├── 02-after-add.png           # After adding manuscript
├── progress-5min.png          # Progress screenshots
├── final-complete-state.png   # Final state
└── error-screenshots/         # Error states
```

### Test Scripts Location
```
.devkit/testing/
├── final-mcp-download.js      # Complete download script
├── mcp-electron-download.js   # Basic connection script
└── download-with-mcp.js       # Alternative approach
```

## Common Issues and Solutions

### Issue: Single Instance Lock
```
Error: Another instance is already running
```
**Solution**: Don't launch Electron from Claude. Let user launch app, then connect.

### Issue: Element Not Found
```
Error: Timeout waiting for selector "textarea"
```
**Solution**: Use multiple selector strategies and longer timeouts.

### Issue: Download Timeout
```
No progress updates for 5+ minutes
```
**Solution**: Check visual completion indicators and take screenshots.

## Best Practices

1. **Always use comprehensive console monitoring** - captures all activity
2. **Take screenshots at key stages** - provides visual confirmation
3. **Use multiple selector strategies** - handles UI variations
4. **Don't close app prematurely** - let downloads complete
5. **Monitor for extended periods** - large manuscripts take time
6. **Validate actual results** - check Downloads folder for PDFs

## Integration with CLAUDE.md

This guide should be referenced in the main project documentation under the "Testing" or "Development" section as the authoritative method for automated testing and validation of the Electron app using Playwright MCP.