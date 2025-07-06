const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Testing E-Manuscripta multi-block detection...');

// Based on the analysis, I need to understand the current behavior
// Let me test with the current implementation first

const testScript = `
const { EnhancedManuscriptDownloaderService } = require('./dist/main/services/EnhancedManuscriptDownloaderService.js');

async function testCurrentImplementation() {
    console.log('🧪 Testing current E-Manuscripta implementation...');
    
    // Test URLs from the issue
    const testUrls = [
        'https://www.e-manuscripta.ch/bau/content/thumbview/5157616',
        'https://www.e-manuscripta.ch/bau/content/thumbview/5157228',
        'https://www.e-manuscripta.ch/bau/content/thumbview/5157615'
    ];
    
    try {
        const service = new EnhancedManuscriptDownloaderService();
        
        for (let i = 0; i < testUrls.length; i++) {
            const url = testUrls[i];
            console.log(\`\\n\${i + 1}. Testing: \${url}\`);
            
            try {
                const manifest = await service.loadEManuscriptaManifest(url);
                console.log('✅ Manifest loaded successfully');
                console.log('📄 Display Name:', manifest.displayName);
                console.log('📊 Total Pages:', manifest.totalPages);
                console.log('🔗 First Page URL:', manifest.pageLinks[0]);
                console.log('🔗 Last Page URL:', manifest.pageLinks[manifest.pageLinks.length - 1]);
                
                // Test if URLs actually work
                console.log('🔍 Testing first URL validity...');
                const testResponse = await fetch(manifest.pageLinks[0]);
                console.log('📊 Response status:', testResponse.status);
                console.log('📋 Content type:', testResponse.headers.get('content-type'));
                
            } catch (error) {
                console.log('❌ Failed to load manifest:', error.message);
            }
        }
        
        console.log('\\n🎯 ANALYSIS:');
        console.log('The current implementation treats each thumbview URL as a separate manuscript.');
        console.log('We need to detect when a manuscript spans multiple blocks and aggregate them.');
        
    } catch (error) {
        console.error('❌ ERROR:', error.message);
        return false;
    }
}

testCurrentImplementation().then(() => {
    console.log('\\n✅ Test completed');
}).catch(error => {
    console.error('❌ Test failed:', error.message);
});
`;

// Write the test script
fs.writeFileSync('.devkit/temp/test-current-implementation.cjs', testScript);

try {
    console.log('📦 Building project...');
    execSync('npm run build:main', { stdio: 'inherit' });
    
    console.log('🧪 Running current implementation test...');
    const result = execSync('node .devkit/temp/test-current-implementation.cjs', { 
        encoding: 'utf8',
        timeout: 120000
    });
    
    console.log(result);
    
} catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stdout) console.log('STDOUT:', error.stdout);
    if (error.stderr) console.log('STDERR:', error.stderr);
}