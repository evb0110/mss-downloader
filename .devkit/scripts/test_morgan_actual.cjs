// Test the actual Morgan method to reproduce the error
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// First, create a test script that uses the actual application
const testScript = `
const { app } = require('electron');
const EnhancedManuscriptDownloaderService = require('./dist/main/main.js').EnhancedManuscriptDownloaderService;

async function testMorgan() {
    try {
        console.log('Testing Morgan Library with URL: https://www.themorgan.org/collection/lindau-gospels/thumbs');
        
        const service = new EnhancedManuscriptDownloaderService();
        const manifest = await service.loadMorganManifest('https://www.themorgan.org/collection/lindau-gospels/thumbs');
        
        console.log('Success! Manifest loaded:', {
            totalPages: manifest.totalPages,
            displayName: manifest.displayName
        });
        
    } catch (error) {
        console.error('ERROR:', error.message);
        console.error('Stack:', error.stack);
    }
    
    process.exit(0);
}

app.whenReady().then(() => {
    testMorgan();
});
`;

const testFilePath = path.join(__dirname, 'morgan_test_runner.js');
fs.writeFileSync(testFilePath, testScript);

console.log('Running Morgan test through Electron...');

try {
    const output = execSync(`npx electron ${testFilePath}`, { 
        encoding: 'utf8',
        cwd: path.join(__dirname, '../../')
    });
    console.log('Test output:', output);
} catch (error) {
    console.error('Test failed with error:', error.message);
    if (error.stdout) console.log('stdout:', error.stdout);
    if (error.stderr) console.error('stderr:', error.stderr);
}

// Clean up
fs.unlinkSync(testFilePath);