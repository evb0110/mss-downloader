const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Test the service implementation directly
const testUrl = 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1';

console.log('Testing MDC Catalonia service implementation...');
console.log('Test URL:', testUrl);

// Create a temporary electron app context for testing
const testScript = `
const { app } = require('electron');
const { EnhancedManuscriptDownloaderService } = require('./src/main/services/EnhancedManuscriptDownloaderService');

async function testMdcCatalonia() {
    try {
        console.log('Creating EnhancedManuscriptDownloaderService instance...');
        const service = new EnhancedManuscriptDownloaderService();
        
        console.log('Testing MDC Catalonia manifest loading...');
        const manifest = await service.loadMdcCataloniaManifest('${testUrl}');
        
        console.log('✅ Manifest loaded successfully');
        console.log('Total pages:', manifest.totalPages);
        console.log('Library:', manifest.library);
        console.log('Display name:', manifest.displayName);
        console.log('First 5 page links:');
        for (let i = 0; i < Math.min(5, manifest.pageLinks.length); i++) {
            console.log(\`  \${i+1}: \${manifest.pageLinks[i]}\`);
        }
        
        // Test downloading a few pages
        console.log('\\n=== Testing Image Download ===');
        const testPages = manifest.pageLinks.slice(0, 3);
        for (let i = 0; i < testPages.length; i++) {
            const pageUrl = testPages[i];
            console.log(\`Testing page \${i+1}: \${pageUrl}\`);
            
            try {
                const response = await service.fetchDirect(pageUrl);
                console.log(\`  Status: \${response.status}\`);
                console.log(\`  Content-Type: \${response.headers.get('content-type')}\`);
                console.log(\`  Content-Length: \${response.headers.get('content-length') || 'unknown'}\`);
                
                if (response.ok) {
                    const buffer = await response.buffer();
                    console.log(\`  Actual size: \${(buffer.length / 1024).toFixed(2)}KB\`);
                } else {
                    console.log(\`  ❌ Failed to download: \${response.status}\`);
                }
            } catch (error) {
                console.log(\`  ❌ Error: \${error.message}\`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log('\\n✅ All tests completed successfully');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Wait for app to be ready
app.whenReady().then(() => {
    testMdcCatalonia();
});
`;

// Write test script to temporary file
const testScriptPath = path.join(__dirname, 'temp-mdc-test.js');
fs.writeFileSync(testScriptPath, testScript);

console.log('\\nRunning Electron test...');

// Run the test with electron
const electron = spawn('npm', ['run', 'electron', '--', testScriptPath], {
    stdio: 'inherit',
    cwd: process.cwd()
});

electron.on('close', (code) => {
    // Clean up
    if (fs.existsSync(testScriptPath)) {
        fs.unlinkSync(testScriptPath);
    }
    
    console.log(\`\\nElectron test completed with code \${code}\`);
    process.exit(code);
});

electron.on('error', (error) => {
    console.error('Failed to start electron:', error);
    process.exit(1);
});