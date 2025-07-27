const { execSync } = require('child_process');
const path = require('path');

async function testHHUFix() {
    console.log('Testing HHU Düsseldorf fix...\n');
    
    // First compile the TypeScript
    console.log('Compiling TypeScript...');
    try {
        execSync('npm run build:main:bundled', { 
            cwd: path.join(__dirname, '../..'),
            stdio: 'inherit' 
        });
    } catch (error) {
        console.error('Build failed:', error.message);
        return;
    }
    
    // Now run a simple test using the compiled code
    const testCode = `
const { app } = require('electron');
app.on('ready', async () => {
    try {
        const path = require('path');
        const { EnhancedManuscriptDownloaderService } = require('./dist/main/services/EnhancedManuscriptDownloaderService');
        
        const service = new EnhancedManuscriptDownloaderService();
        const testUrl = 'https://digital.ulb.hhu.de/ms/content/titleinfo/7674176';
        
        console.log('Testing URL:', testUrl);
        const manifest = await service.loadManifest(testUrl);
        
        console.log('\\n✅ SUCCESS! HHU manifest loaded');
        console.log('Title:', manifest.displayName);
        console.log('Pages:', manifest.pageLinks.length);
        console.log('Library:', manifest.library);
        
        process.exit(0);
    } catch (error) {
        console.error('\\n❌ ERROR:', error.message);
        process.exit(1);
    }
});
    `;
    
    // Write test file
    const fs = require('fs');
    const testFile = path.join(__dirname, 'test-hhu-electron.js');
    fs.writeFileSync(testFile, testCode);
    
    // Run with electron
    console.log('\nRunning test with Electron...');
    try {
        execSync(`npx electron ${testFile}`, {
            cwd: path.join(__dirname, '../..'),
            stdio: 'inherit'
        });
        console.log('\n✅ HHU test passed!');
    } catch (error) {
        console.error('\n❌ HHU test failed');
    } finally {
        // Clean up
        fs.unlinkSync(testFile);
    }
}

testHHUFix();