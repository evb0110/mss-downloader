const fs = require('fs');
const path = require('path');

console.log('Testing pdf-lib bundling in main.js...\n');

const mainJsPath = path.join(__dirname, '../../dist/main/main.js');

if (!fs.existsSync(mainJsPath)) {
  console.error('❌ dist/main/main.js not found. Run "npm run build" first.');
  process.exit(1);
}

const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

// Check for pdf-lib code patterns
const pdfLibPatterns = [
  'PDFDocument',
  'PDFPage',
  'PDFFont',
  'rgb(',
  'embedJpg',
  'embedPng',
  'addPage',
  'drawImage'
];

let foundPatterns = 0;
console.log('Checking for pdf-lib patterns:');

pdfLibPatterns.forEach(pattern => {
  if (mainJsContent.includes(pattern)) {
    console.log(`✅ Found: ${pattern}`);
    foundPatterns++;
  } else {
    console.log(`❌ Missing: ${pattern}`);
  }
});

console.log(`\nFound ${foundPatterns}/${pdfLibPatterns.length} pdf-lib patterns`);

// Check file size
const stats = fs.statSync(mainJsPath);
const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
console.log(`\nBundled file size: ${fileSizeMB} MB`);

if (fileSizeMB > 5) {
  console.warn('⚠️  Warning: Bundled file is larger than expected (>5MB)');
} else {
  console.log('✅ File size is reasonable');
}

// Check that pdf-lib is not imported as external module
if (mainJsContent.includes('require("pdf-lib")') || mainJsContent.includes('require(\'pdf-lib\')')) {
  console.error('\n❌ ERROR: pdf-lib is still being required as external module!');
  process.exit(1);
} else {
  console.log('\n✅ pdf-lib is bundled (not external)');
}

console.log('\n✅ pdf-lib bundling test passed!');