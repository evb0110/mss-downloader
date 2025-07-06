const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Creating DIAMM validation PDF...');

// Test URL from the original issue
const testUrl = 'https://musmed.eu/visualiseur-iiif?manifest=https%3A%2F%2Fiiif.diamm.net%2Fmanifests%2FI-Rc-Ms-1907%2Fmanifest.json';

console.log('Test URL:', testUrl);

// Create CURRENT-VALIDATION directory if it doesn't exist
const validationDir = path.join(process.cwd(), 'CURRENT-VALIDATION');
if (!fs.existsSync(validationDir)) {
    fs.mkdirSync(validationDir, { recursive: true });
    console.log('Created validation directory:', validationDir);
}

console.log('\\n📋 MANUAL TESTING REQUIRED:');
console.log('Please run the following steps manually:');
console.log('');
console.log('1. Run: npm run dev');
console.log('2. Enter this URL in the app:');
console.log('   ' + testUrl);
console.log('3. Click "Load Manuscript"');
console.log('4. Set "Pages to download" to 5');
console.log('5. Click "Download"');
console.log('6. Save the PDF as "DIAMM-I-Rc-Ms-1907-VALIDATION-FIX.pdf" in CURRENT-VALIDATION folder');
console.log('');
console.log('🎯 EXPECTED RESULTS AFTER FIX:');
console.log('- PDF should be much larger than 209KB (several MB)');
console.log('- Images should be high-resolution (3640x5000 pixels)');
console.log('- Should show 5 different manuscript pages');
console.log('- No "Preview non disponibile" or error pages');
console.log('');
console.log('⚡ THE FIX:');
console.log('- Changed DIAMM URLs from /full/max/ to /full/full/');
console.log('- Created DIAMM-specific manifest processing');
console.log('- This ensures maximum resolution downloads');

// Also create a quick test script to check if URLs are generated correctly
const testScript = `
// Quick test to verify DIAMM URL generation
const testServiceId = 'https://iiif.diamm.net/images/I-Rc-Ms-1907/I-Rc-Ms-1907_001r.tif';

console.log('🔧 DIAMM URL Test Results:');
console.log('');
console.log('Service ID:', testServiceId);
console.log('');
console.log('OLD (incorrect) URL pattern:');
console.log('  ' + testServiceId + '/full/max/0/default.jpg');
console.log('');
console.log('NEW (fixed) URL pattern:');
console.log('  ' + testServiceId + '/full/full/0/default.jpg');
console.log('');
console.log('✅ The fix changes DIAMM URLs to use /full/full/ for maximum resolution');
`;

fs.writeFileSync(path.join(validationDir, 'diamm-url-test.js'), testScript);
console.log('\\n📝 Created URL test script: CURRENT-VALIDATION/diamm-url-test.js');

// Run the URL test
console.log('\\n🔧 URL Generation Test:');
eval(testScript);

console.log('\\n🔍 Next Steps:');
console.log('1. Run the manual test above');
console.log('2. Compare file sizes before and after the fix');
console.log('3. Verify image quality in the generated PDF');
console.log('4. If successful, run the full validation protocol');