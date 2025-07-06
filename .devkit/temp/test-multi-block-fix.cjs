const { execSync } = require('child_process');
const fs = require('fs');

console.log('🧪 Testing E-Manuscripta multi-block fix...');

// Test script to validate the new implementation
const testScript = `
const { EnhancedManuscriptDownloaderService } = require('./dist/main/services/EnhancedManuscriptDownloaderService.js');

async function testMultiBlockFix() {
    const service = new EnhancedManuscriptDownloaderService();
    
    // Test URLs from the issue
    const testUrls = [
        'https://www.e-manuscripta.ch/bau/content/titleinfo/5157222',   // Main titleinfo URL
        'https://www.e-manuscripta.ch/bau/content/thumbview/5157616',  // Individual block
        'https://www.e-manuscripta.ch/bau/content/thumbview/5157228',  // Individual block
        'https://www.e-manuscripta.ch/bau/content/thumbview/5157615'   // Individual block
    ];
    
    console.log('🔍 Testing URL pattern recognition...');
    
    for (let i = 0; i < testUrls.length; i++) {
        const url = testUrls[i];
        const urlType = url.includes('titleinfo') ? 'titleinfo' : 'thumbview';
        
        console.log(\`\\n\${i + 1}. Testing \${urlType} URL: \${url}\`);
        
        try {
            const manifest = await service.loadEManuscriptaManifest(url);
            
            console.log('✅ Manifest loaded successfully');
            console.log('📄 Display Name:', manifest.displayName);
            console.log('📊 Total Pages:', manifest.totalPages);
            console.log('📚 Library:', manifest.library);
            console.log('🔗 First Page URL:', manifest.pageLinks[0]);
            console.log('🔗 Last Page URL:', manifest.pageLinks[manifest.pageLinks.length - 1]);
            
            // Test a few URLs to make sure they work
            if (manifest.pageLinks.length > 0) {
                console.log('🔍 Testing URL validity...');
                const testCount = Math.min(3, manifest.pageLinks.length);
                for (let j = 0; j < testCount; j++) {
                    try {
                        const response = await fetch(manifest.pageLinks[j]);
                        const contentType = response.headers.get('content-type');
                        console.log(\`  Page \${j + 1}: \${response.status} - \${contentType}\`);
                    } catch (error) {
                        console.log(\`  Page \${j + 1}: Error - \${error.message}\`);
                    }
                }
            }
            
            // Analysis
            if (urlType === 'titleinfo') {
                console.log('🎯 TITLEINFO ANALYSIS:');
                console.log('  - Should aggregate multiple blocks');
                console.log(\`  - Found \${manifest.totalPages} total pages\`);
                console.log(\`  - Display name includes block info: \${manifest.displayName.includes('blocks')}\`);
            } else {
                console.log('🎯 THUMBVIEW ANALYSIS:');
                console.log('  - Should process individual block');
                console.log(\`  - Found \${manifest.totalPages} pages in this block\`);
            }
            
        } catch (error) {
            console.log('❌ Failed to load manifest:', error.message);
        }
    }
}

testMultiBlockFix().then(() => {
    console.log('\\n✅ Multi-block fix test completed');
}).catch(error => {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
});
`;

// Write test script
fs.writeFileSync('.devkit/temp/test-multi-block-direct.cjs', testScript);

try {
    console.log('🧪 Running multi-block fix test...');
    
    const result = execSync('node .devkit/temp/test-multi-block-direct.cjs', {
        encoding: 'utf8',
        timeout: 300000 // 5 minutes
    });
    
    console.log(result);
    
} catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stdout) console.log('STDOUT:', error.stdout);
    if (error.stderr) console.log('STDERR:', error.stderr);
}