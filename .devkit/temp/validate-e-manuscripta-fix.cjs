const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Testing e-manuscripta.ch fix...');
console.log('URL: https://www.e-manuscripta.ch/zuzcmi/content/zoom/3229497');
console.log('Expected: 463 pages (not 11)');
console.log('');

// Create a simple test to validate the fix
const testScript = `
const { EnhancedManuscriptDownloaderService } = require('./dist/main/services/EnhancedManuscriptDownloaderService.js');

async function testEManuscriptaFix() {
    try {
        const service = new EnhancedManuscriptDownloaderService();
        const manifest = await service.loadEManuscriptaManifest('https://www.e-manuscripta.ch/zuzcmi/content/zoom/3229497');
        
        console.log('✅ Manifest loaded successfully');
        console.log('📄 Display Name:', manifest.displayName);
        console.log('📊 Total Pages:', manifest.totalPages);
        console.log('🔗 First Page URL:', manifest.pageLinks[0]);
        console.log('🔗 Last Page URL:', manifest.pageLinks[manifest.pageLinks.length - 1]);
        
        if (manifest.totalPages >= 400) {
            console.log('🎉 SUCCESS: Fix appears to be working! Found', manifest.totalPages, 'pages');
            return true;
        } else {
            console.log('❌ FAILURE: Still only finding', manifest.totalPages, 'pages');
            return false;
        }
    } catch (error) {
        console.error('❌ ERROR:', error.message);
        return false;
    }
}

testEManuscriptaFix().then(success => {
    process.exit(success ? 0 : 1);
});
`;

// Write the test script
fs.writeFileSync('.devkit/temp/test-e-manuscripta-direct.js', testScript);

try {
    console.log('📦 Building project...');
    execSync('npm run build:main', { stdio: 'inherit' });
    
    console.log('🧪 Running direct test...');
    const result = execSync('node .devkit/temp/test-e-manuscripta-direct.js', { 
        encoding: 'utf8',
        timeout: 60000
    });
    console.log(result);
    
} catch (error) {
    console.error('Test failed:', error.message);
    if (error.stdout) console.log('STDOUT:', error.stdout);
    if (error.stderr) console.log('STDERR:', error.stderr);
}