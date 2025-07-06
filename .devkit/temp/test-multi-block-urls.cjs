const { execSync } = require('child_process');

console.log('🔍 Testing E-Manuscripta multi-block URL handling...');

// Test what happens with current implementation
const testUrls = [
    'https://www.e-manuscripta.ch/bau/content/titleinfo/5157222',   // Main titleinfo URL
    'https://www.e-manuscripta.ch/bau/content/thumbview/5157616',  // Block 1 thumbview 
    'https://www.e-manuscripta.ch/bau/content/thumbview/5157228',  // Block 2 thumbview
    'https://www.e-manuscripta.ch/bau/content/thumbview/5157615'   // Block 3 thumbview
];

console.log('Test URLs:');
testUrls.forEach((url, i) => {
    console.log(`${i + 1}. ${url}`);
});

// Test URL pattern matching
const urlPattern = /e-manuscripta\.ch\/([^/]+)\/content\/zoom\/(\d+)/;

console.log('\nURL Pattern Matching Results:');
testUrls.forEach((url, i) => {
    const match = url.match(urlPattern);
    console.log(`${i + 1}. ${url}`);
    console.log(`   Match: ${match ? 'YES' : 'NO'}`);
    if (match) {
        console.log(`   Library: ${match[1]}, ID: ${match[2]}`);
    }
});

console.log('\n🎯 ANALYSIS:');
console.log('❌ Current implementation only handles /content/zoom/ URLs');
console.log('❌ titleinfo and thumbview URLs are not supported');
console.log('✅ Need to extend pattern to handle titleinfo and thumbview URLs');
console.log('✅ Need to implement multi-block aggregation logic');

// Check what library detection returns
console.log('\n📋 Library Detection Test:');
testUrls.forEach((url, i) => {
    let library = 'unknown';
    if (url.includes('e-manuscripta.ch')) library = 'e_manuscripta';
    console.log(`${i + 1}. ${url} -> ${library}`);
});

console.log('\n🔧 PROPOSED SOLUTION:');
console.log('1. Extend URL pattern to handle titleinfo and thumbview URLs');
console.log('2. For titleinfo URLs, fetch HTML and extract all related thumbview URLs');
console.log('3. For thumbview URLs, process individually then aggregate');
console.log('4. Implement block detection and page range parsing');
console.log('5. Merge all blocks into a single manifest');

// Let's identify the URL patterns we need to support
console.log('\n📐 URL PATTERNS TO SUPPORT:');
console.log('• Current: /content/zoom/{id} (supported)');
console.log('• New: /content/titleinfo/{id} (main manuscript page)');
console.log('• New: /content/thumbview/{id} (individual blocks)');

// Create proposed new URL pattern
const newUrlPattern = /e-manuscripta\.ch\/([^/]+)\/content\/(zoom|titleinfo|thumbview)\/(\d+)/;

console.log('\n🔄 NEW URL PATTERN TEST:');
testUrls.forEach((url, i) => {
    const match = url.match(newUrlPattern);
    console.log(`${i + 1}. ${url}`);
    console.log(`   Match: ${match ? 'YES' : 'NO'}`);
    if (match) {
        console.log(`   Library: ${match[1]}, Type: ${match[2]}, ID: ${match[3]}`);
    }
});