const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Testing Morgan Library fix...');

// Create test script
const testCode = `
// Test Morgan download using library pattern
const MorganLibrary = require('./dist/libraries/morgan.js');
const testUrl = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';

async function testMorgan() {
    try {
        console.log('Testing URL:', testUrl);
        
        const morgan = new MorganLibrary();
        const manifest = await morgan.getManifest(testUrl);
        
        console.log('SUCCESS! Manifest loaded:');
        console.log('- Display name:', manifest.displayName);
        console.log('- Total pages:', manifest.totalPages);
        console.log('- First page URL:', manifest.pageLinks[0]);
        
        return manifest;
    } catch (error) {
        console.error('ERROR:', error.message);
        console.error('Stack:', error.stack);
        throw error;
    }
}

testMorgan().then(() => process.exit(0)).catch(() => process.exit(1));
`;

// First check if the library file exists
const libraryPath = path.join(__dirname, '../../dist/libraries/morgan.js');
if (!fs.existsSync(libraryPath)) {
    console.log('Morgan library not found at:', libraryPath);
    console.log('Trying bundled version...');
    
    // Try using the bundled service directly
    const bundledTestCode = `
    const { app } = require('electron');
    
    // Import from the bundled main file
    const mainExports = require('./dist/main/main.js');
    
    async function testMorgan() {
        try {
            // Try to find the service in the exports
            let service;
            
            // Check various possible export patterns
            if (mainExports.EnhancedManuscriptDownloaderService) {
                service = new mainExports.EnhancedManuscriptDownloaderService();
            } else if (mainExports.default && mainExports.default.EnhancedManuscriptDownloaderService) {
                service = new mainExports.default.EnhancedManuscriptDownloaderService();
            } else {
                // Try to create service instance directly
                const { BrowserWindow } = require('electron');
                
                // Create a hidden window for the service
                const win = new BrowserWindow({ show: false });
                
                // Now try to use the service through IPC or direct instantiation
                console.log('Available exports:', Object.keys(mainExports));
                throw new Error('Could not find EnhancedManuscriptDownloaderService in exports');
            }
            
            console.log('Testing Morgan URL: https://www.themorgan.org/collection/lindau-gospels/thumbs');
            const manifest = await service.loadMorganManifest('https://www.themorgan.org/collection/lindau-gospels/thumbs');
            
            console.log('SUCCESS! Manifest loaded:');
            console.log('- Display name:', manifest.displayName);
            console.log('- Total pages:', manifest.totalPages);
            console.log('- First page URL:', manifest.pageLinks ? manifest.pageLinks[0] : 'No pages');
            
        } catch (error) {
            console.error('ERROR:', error.message);
            console.error('Stack trace:', error.stack);
            process.exit(1);
        }
        
        process.exit(0);
    }
    
    if (app.isReady()) {
        testMorgan();
    } else {
        app.whenReady().then(() => {
            testMorgan();
        });
    }
    `;
    
    testCode = bundledTestCode;
}

// Write test file
const testFile = path.join(__dirname, 'test_morgan_runner.js');
fs.writeFileSync(testFile, testCode);

try {
    // Run with electron
    const output = execSync(`npx electron ${testFile}`, {
        encoding: 'utf8',
        cwd: path.join(__dirname, '../../'),
        stdio: 'pipe'
    });
    
    console.log('\nTest output:');
    console.log(output);
    
} catch (error) {
    console.error('\nTest failed with exit code:', error.status);
    if (error.stdout) console.log('stdout:', error.stdout.toString());
    if (error.stderr) console.error('stderr:', error.stderr.toString());
} finally {
    // Clean up
    if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
    }
}