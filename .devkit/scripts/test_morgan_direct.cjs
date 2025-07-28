const fs = require('fs');
const path = require('path');

// Read the source file to analyze the issue
const sourceFile = path.join(__dirname, '../../src/main/services/EnhancedManuscriptDownloaderService.ts');
const sourceCode = fs.readFileSync(sourceFile, 'utf8');

// Find the loadMorganManifest method
const methodStart = sourceCode.indexOf('async loadMorganManifest');
const methodEnd = sourceCode.indexOf('\n    }', methodStart + 5000); // Look for the closing brace

if (methodStart === -1) {
    console.error('Could not find loadMorganManifest method');
    process.exit(1);
}

const methodCode = sourceCode.substring(methodStart, methodEnd + 6);

// Check if imagesByPriority is properly scoped
const declarationIndex = methodCode.indexOf('const imagesByPriority');
const usageIndices = [];
let searchIndex = 0;

while ((searchIndex = methodCode.indexOf('imagesByPriority', searchIndex)) !== -1) {
    if (searchIndex !== declarationIndex) {
        usageIndices.push(searchIndex);
    }
    searchIndex += 1;
}

console.log('Method analysis:');
console.log('- Declaration at position:', declarationIndex);
console.log('- Number of usages:', usageIndices.length);

// Check for scope issues
const ifIcaStart = methodCode.indexOf('if (morganUrl.includes(\'ica.themorgan.org\'))');
const elseStart = methodCode.indexOf('} else {', ifIcaStart);
const elseEnd = methodCode.lastIndexOf('}', methodCode.indexOf('// Try to extract title'));

console.log('\nScope analysis:');
console.log('- imagesByPriority declared at:', declarationIndex);
console.log('- if (ica) block starts at:', ifIcaStart);
console.log('- else block starts at:', elseStart);

// Check if any usage is outside the proper scope
let scopeIssues = false;
for (const usage of usageIndices) {
    const lineStart = methodCode.lastIndexOf('\n', usage);
    const lineEnd = methodCode.indexOf('\n', usage);
    const line = methodCode.substring(lineStart + 1, lineEnd);
    
    // Check if this usage is in a problematic location
    if (usage < declarationIndex) {
        console.log(`\nERROR: Usage before declaration at position ${usage}:`);
        console.log('  Line:', line.trim());
        scopeIssues = true;
    }
}

if (!scopeIssues) {
    console.log('\nNo obvious scope issues found in the TypeScript source.');
    console.log('\nThe issue might be in the compiled JavaScript. Let me check the build output...');
    
    // Check if there's a transpilation issue
    const distFile = path.join(__dirname, '../../dist/main/services/EnhancedManuscriptDownloaderService.js');
    if (fs.existsSync(distFile)) {
        const distCode = fs.readFileSync(distFile, 'utf8');
        console.log('\nDist file exists, size:', distCode.length, 'bytes');
        
        // Search for the error-prone section in the compiled code
        const morganSection = distCode.indexOf('loadMorganManifest');
        if (morganSection !== -1) {
            console.log('Found loadMorganManifest in compiled code at position:', morganSection);
        }
    } else {
        console.log('\nDist file not found at:', distFile);
    }
}