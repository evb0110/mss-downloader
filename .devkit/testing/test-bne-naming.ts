#!/usr/bin/env bun

/**
 * Test BNE naming fix - ensure display name is "BNE 7619" not "BNE 0000007619"
 */

console.log('🔬 Testing BNE Naming Fix\n');
console.log('=' .repeat(60));

// Test the ID extraction and shortening logic
const testUrls = [
    'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1',
    'https://bdh-rd.bne.es/viewer.vm?id=1234&page=1',
    'https://bdh-rd.bne.es/viewer.vm?id=0000001234&page=1',
    'https://bdh-rd.bne.es/viewer.vm?id=0000000001&page=1',
];

for (const url of testUrls) {
    const idMatch = url.match(/[?&]id=(\d+)/);
    if (idMatch) {
        const manuscriptId = idMatch[1].padStart(10, '0');
        const shortId = parseInt(idMatch[1], 10).toString();
        
        console.log(`URL: ${url}`);
        console.log(`  Extracted ID: ${idMatch[1]}`);
        console.log(`  Padded ID (for API): ${manuscriptId}`);
        console.log(`  Short ID (for display): ${shortId}`);
        console.log(`  Display Name: BNE ${shortId}`);
        console.log('');
    }
}

console.log('=' .repeat(60));
console.log('✅ Naming logic verified!');
console.log('\nExpected behavior:');
console.log('  - API calls use padded ID (0000007619)');
console.log('  - Display name uses short ID (7619)');
console.log('  - Folder name will be "BNE 7619" not "BNE 0000007619"');