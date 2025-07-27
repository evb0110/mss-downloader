const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const libraries = ['HHU', 'GRAZ', 'VERONA', 'MORGAN'];
const resultsDir = path.join(__dirname, 'results');

console.log('Manuscript Downloader - Issue Fixes Validation');
console.log('==============================================\n');

// Check each library config
for (const library of libraries) {
    const configPath = path.join(resultsDir, library, 'config.json');
    if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log(`${library}:`);
        console.log(`  URL: ${config.urls[0]}`);
        console.log(`  Pages: ${config.startPage}-${config.endPage}`);
        console.log(`  Config: ${configPath}`);
    }
}

console.log('\nValidation Instructions:');
console.log('1. Run: npm run dev:headless');
console.log('2. For each library, load its config file');
console.log('3. Start download and wait for completion');
console.log('4. Check the output PDF in the results folder');
console.log('\nExpected Results:');
console.log('- HHU: Should download without "logInfo is not a function" error');
console.log('- GRAZ: Should complete without infinite loading');
console.log('- VERONA: Should complete without ETIMEDOUT errors');
console.log('- MORGAN: Should find and download multiple pages (not just 1)');
