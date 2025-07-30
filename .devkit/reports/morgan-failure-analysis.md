# Morgan Library Failure Analysis - v1.4.48

## Issue Summary

**Error**: `ReferenceError: imagesByPriority is not defined`  
**URL**: `https://www.themorgan.org/collection/lindau-gospels/thumbs`  
**Location**: Production build of mss-downloader v1.4.48

## Root Cause Analysis

### 1. **Variable Scope Issue in Production Build**

The `imagesByPriority` variable is properly declared in `SharedManifestLoaders.js` at line 1125:

```javascript
// Main Morgan format - prioritize high-resolution images
const imagesByPriority = {
    0: [], // ZIF ultra-high resolution
    1: [], // High-res facsimile
    2: [], // Direct full-size
    3: [], // Styled images
    4: [], // Legacy facsimile
    5: []  // Other direct references
};
```

However, the error suggests this variable is being accessed before declaration or outside its scope in the production build.

### 2. **Code Structure Analysis**

The `processMorganHTML` method has the following structure:

```javascript
async processMorganHTML(html, url, baseUrl, manuscriptId, displayName, images) {
    if (url.includes('ica.themorgan.org')) {
        // ICA format handling (lines 1071-1122)
        // ... code for ICA format ...
    } else {
        // Main Morgan format (lines 1123-1259)
        const imagesByPriority = {  // LINE 1125 - Declaration
            // ... priority levels ...
        };
        
        // Multiple code blocks that use imagesByPriority:
        // - Line 1144: imagesByPriority[0].push(zifUrl);
        // - Line 1175: imagesByPriority[0].push(fullImgUrl);
        // - Line 1187: if (imagesByPriority[0].length >= 10) break;
        // - Lines 1214, 1229, 1237, 1244: Adding to various priority levels
        // - Lines 1249-1253: Selecting images by priority
    }
    // ... rest of method
}
```

### 3. **Potential Failure Points**

#### A. **Transpilation/Bundling Issue**

The production build might be transforming the code in a way that breaks the variable scope. Possible causes:

1. **Variable hoisting issue**: The bundler might be hoisting parts of the code incorrectly
2. **Block scope problem**: The `const` declaration inside the `else` block might be handled differently in production
3. **Async/await transformation**: The bundler's handling of async functions might affect variable scope

#### B. **Race Condition with Async Code**

Between lines 1149-1195, there's a try-catch block with async operations:

```javascript
try {
    // ... facsimile ASP URL processing ...
    for (let pageId = 1; pageId <= 20; pageId++) {
        // ... async operations ...
        imagesByPriority[0].push(fullImgUrl);  // LINE 1175
    }
} catch (error) {
    // ... error handling ...
}
```

If the bundler is incorrectly handling the async operations, `imagesByPriority` might be accessed before it's properly initialized.

#### C. **Conditional Code Execution**

The variable is only declared when `!url.includes('ica.themorgan.org')`. If there's any code path that tries to access `imagesByPriority` outside this condition, it would cause the error.

### 4. **Why Tests Pass but Production Fails**

1. **Test Environment**: Tests run the code directly in Node.js without bundling/transpilation
2. **Production Build**: The Electron app uses webpack/vite bundling which transforms the code
3. **Different Execution Context**: Electron's renderer/main process separation might affect variable scope

### 5. **Specific Line Analysis**

Looking at the error context and code structure, the most likely failure points are:

1. **Line 1175** (inside async facsimile processing)
2. **Line 1187** (break condition check)
3. **Lines 1249-1253** (priority selection loop)

## Recommended Fixes

### Fix 1: **Move Variable Declaration to Method Scope**

```javascript
async processMorganHTML(html, url, baseUrl, manuscriptId, displayName, images) {
    // Declare at method level to ensure it's always available
    let imagesByPriority = null;
    
    if (url.includes('ica.themorgan.org')) {
        // ICA format handling
        // ... existing code ...
    } else {
        // Initialize for main Morgan format
        imagesByPriority = {
            0: [], // ZIF ultra-high resolution
            1: [], // High-res facsimile
            2: [], // Direct full-size
            3: [], // Styled images
            4: [], // Legacy facsimile
            5: []  // Other direct references
        };
        
        // ... rest of existing code ...
    }
}
```

### Fix 2: **Add Defensive Checks**

```javascript
// Before each use of imagesByPriority, add a check:
if (imagesByPriority && imagesByPriority[0]) {
    imagesByPriority[0].push(zifUrl);
}
```

### Fix 3: **Refactor to Avoid Complex Nesting**

Extract the Morgan main format handling into a separate method:

```javascript
async processMorganMainFormat(html, baseUrl, manuscriptId, images) {
    const imagesByPriority = {
        // ... priority levels ...
    };
    
    // ... all the logic that uses imagesByPriority ...
    
    return imagesByPriority;
}
```

### Fix 4: **Ensure Proper Bundler Configuration**

Check the webpack/vite configuration to ensure:
1. Proper handling of `const` declarations in block scope
2. Correct async/await transpilation
3. No aggressive code splitting that might break variable scope

## Testing Recommendations

1. **Test with Production Build**: Run the test script against the bundled code, not just the source
2. **Add Scope Tests**: Create tests that specifically check variable accessibility
3. **Electron Integration Test**: Test within actual Electron environment
4. **Bundle Analysis**: Analyze the bundled output to see how the code is transformed

## Conclusion

The `imagesByPriority is not defined` error is most likely caused by a bundling/transpilation issue where the variable declaration inside the `else` block is not properly handled in the production build. The fix should focus on ensuring the variable is always properly scoped and initialized before use.