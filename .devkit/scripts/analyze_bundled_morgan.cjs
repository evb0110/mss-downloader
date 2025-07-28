const fs = require('fs');
const path = require('path');

const bundledFile = path.join(__dirname, '../../dist/main/main.js');
const content = fs.readFileSync(bundledFile, 'utf8');

// Find loadMorganManifest in bundled code
const morganIndex = content.indexOf('loadMorganManifest');
if (morganIndex === -1) {
    console.error('loadMorganManifest not found in bundled file');
    process.exit(1);
}

// Get surrounding context
const startContext = Math.max(0, morganIndex - 1000);
const endContext = Math.min(content.length, morganIndex + 20000);
const morganSection = content.substring(startContext, endContext);

// Find all imagesByPriority occurrences
const occurrences = [];
let searchIndex = 0;

while ((searchIndex = morganSection.indexOf('imagesByPriority', searchIndex)) !== -1) {
    const before = morganSection.substring(Math.max(0, searchIndex - 50), searchIndex);
    const after = morganSection.substring(searchIndex, Math.min(morganSection.length, searchIndex + 100));
    
    occurrences.push({
        position: searchIndex + startContext,
        context: before + '<<<' + after + '>>>',
        line: before.split('\n').pop() + after.split('\n')[0]
    });
    
    searchIndex++;
}

console.log(`Found ${occurrences.length} occurrences of imagesByPriority near loadMorganManifest\n`);

// Look for the declaration
const declarationIndex = occurrences.findIndex(occ => 
    occ.context.includes('const imagesByPriority') || 
    occ.context.includes('let imagesByPriority') ||
    occ.context.includes('var imagesByPriority')
);

if (declarationIndex !== -1) {
    console.log(`Declaration found at occurrence #${declarationIndex + 1}:`);
    console.log(occurrences[declarationIndex].line);
    console.log('');
}

// Check for any usage before declaration
let issuesFound = false;
for (let i = 0; i < occurrences.length; i++) {
    if (i < declarationIndex || declarationIndex === -1) {
        if (!occurrences[i].context.includes('// Initialize imagesByPriority')) {
            console.log(`WARNING: Usage before declaration at occurrence #${i + 1}:`);
            console.log('Context:', occurrences[i].line);
            issuesFound = true;
        }
    }
}

if (!issuesFound && declarationIndex === -1) {
    console.log('ERROR: No declaration of imagesByPriority found!');
    console.log('\nFirst few occurrences:');
    occurrences.slice(0, 3).forEach((occ, i) => {
        console.log(`${i + 1}. ${occ.line}`);
    });
}

// Check if it's a minification issue
const minifiedPattern = /imagesByPriority/;
const matches = morganSection.match(minifiedPattern);
if (matches) {
    console.log(`\nChecking for variable renaming in bundled code...`);
    // Look for patterns like "r[1].length" which might be the minified version
    const arrayAccessPattern = /(\w+)\[1\]\.length\s*>\s*0/g;
    const arrayMatches = [...morganSection.matchAll(arrayAccessPattern)];
    if (arrayMatches.length > 0) {
        console.log('Found potential minified array access patterns:', arrayMatches.length);
        arrayMatches.slice(0, 3).forEach(match => {
            console.log(`- Variable "${match[1]}" used in pattern: ${match[0]}`);
        });
    }
}