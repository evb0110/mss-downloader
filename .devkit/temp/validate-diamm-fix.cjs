const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test the DIAMM fix
const testUrl = 'https://musmed.eu/visualiseur-iiif?manifest=https%3A%2F%2Fiiif.diamm.net%2Fmanifests%2FI-Rc-Ms-1907%2Fmanifest.json';

async function testDiammFix() {
    console.log('🔧 Testing DIAMM fix...');
    console.log('URL:', testUrl);
    
    // Create a simple test to verify the fix
    const testScript = `
const { EnhancedManuscriptDownloaderService } = require('./dist/main/services/EnhancedManuscriptDownloaderService.js');

async function testDiammResolution() {
    console.log('Loading DIAMM manifest...');
    
    try {
        const service = new EnhancedManuscriptDownloaderService();
        const manifest = await service.loadManifest('${testUrl}');
        
        console.log('✅ Manifest loaded successfully');
        console.log('Library:', manifest.library);
        console.log('Display Name:', manifest.displayName);
        console.log('Total Pages:', manifest.totalPages);
        console.log('First 3 page URLs:');
        
        for (let i = 0; i < Math.min(3, manifest.pageLinks.length); i++) {
            console.log(\`  \${i + 1}. \${manifest.pageLinks[i]}\`);
        }
        
        // Check if URLs use full/full format
        const firstUrl = manifest.pageLinks[0];
        if (firstUrl.includes('/full/full/')) {
            console.log('✅ Using full/full resolution (CORRECT)');
        } else if (firstUrl.includes('/full/max/')) {
            console.log('⚠️  Using full/max resolution (NEEDS FIX)');
        } else {
            console.log('❓ Using unknown resolution format:', firstUrl);
        }
        
    } catch (error) {
        console.error('❌ Error loading manifest:', error.message);
    }
}

testDiammResolution();
`;
    
    // Write test script
    fs.writeFileSync('/tmp/test-diamm-fix.js', testScript);
    
    // Compile TypeScript first
    console.log('Compiling TypeScript...');
    const compileProcess = spawn('npm', ['run', 'build'], {
        cwd: '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader',
        stdio: 'inherit'
    });
    
    compileProcess.on('close', (code) => {
        if (code === 0) {
            console.log('✅ TypeScript compiled successfully');
            
            // Run the test
            console.log('Running test...');
            const testProcess = spawn('node', ['/tmp/test-diamm-fix.js'], {
                cwd: '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader',
                stdio: 'inherit'
            });
            
            testProcess.on('close', (testCode) => {
                if (testCode === 0) {
                    console.log('✅ Test completed successfully');
                } else {
                    console.log('❌ Test failed with code:', testCode);
                }
                
                // Clean up
                fs.unlinkSync('/tmp/test-diamm-fix.js');
            });
        } else {
            console.log('❌ TypeScript compilation failed with code:', code);
        }
    });
}

testDiammFix();