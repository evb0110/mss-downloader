const fs = require('fs');
const path = require('path');

// Check the transpiled Morgan method
const transpiledFile = path.join(__dirname, '../../dist/main/services/EnhancedManuscriptDownloaderService.js');

if (!fs.existsSync(transpiledFile)) {
    console.error('Transpiled file not found:', transpiledFile);
    process.exit(1);
}

const content = fs.readFileSync(transpiledFile, 'utf8');

// Find the loadMorganManifest method
const methodStart = content.indexOf('loadMorganManifest');
if (methodStart === -1) {
    console.error('loadMorganManifest not found in transpiled file');
    process.exit(1);
}

// Get a section of the method
const section = content.substring(methodStart - 50, methodStart + 5000);

// Look for imagesByPriority references
const matches = [];
let index = 0;
while ((index = section.indexOf('imagesByPriority', index)) !== -1) {
    const lineStart = section.lastIndexOf('\n', index);
    const lineEnd = section.indexOf('\n', index);
    const line = section.substring(lineStart + 1, lineEnd);
    matches.push({
        position: index,
        line: line.trim().substring(0, 100) // First 100 chars of the line
    });
    index++;
}

console.log('Found', matches.length, 'references to imagesByPriority in transpiled code:');
matches.forEach((match, i) => {
    console.log(`${i + 1}. Position ${match.position}: ${match.line}...`);
});

// Check if there's a declaration
const hasDeclaration = section.includes('const imagesByPriority') || 
                      section.includes('let imagesByPriority') || 
                      section.includes('var imagesByPriority');

console.log('\nHas declaration:', hasDeclaration);

// Look for potential scope issues
console.log('\nChecking for async/await transformation issues...');
const asyncBlocks = section.match(/async[^{]*{|\.then\(/g);
if (asyncBlocks) {
    console.log('Found', asyncBlocks.length, 'async blocks or promises');
}