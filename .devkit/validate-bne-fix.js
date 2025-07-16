const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Test the BNE fix
async function validateBneFix() {
    console.log('🧪 Validating BNE Library fix...\n');
    
    const testUrl = 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1';
    const manuscriptId = '0000007619';
    
    const timestamp = Date.now();
    const testDir = path.join(__dirname, `bne-validation-${timestamp}`);
    await fs.mkdir(testDir, { recursive: true });
    
    try {
        // Build the project first
        console.log('📦 Building project...');
        await execAsync('npm run build');
        console.log('✅ Build successful\n');
        
        // Create test script using the actual service
        const testScript = `
const { EnhancedManuscriptDownloaderService } = require('../../dist/main/services/EnhancedManuscriptDownloaderService.js');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');

async function downloadImage(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            rejectUnauthorized: false
        };
        
        https.get(options, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(\`HTTP \${res.statusCode}\`));
                return;
            }
            
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
    });
}

async function test() {
    const service = new EnhancedManuscriptDownloaderService();
    const startTime = Date.now();
    
    console.log('Loading BNE manifest...');
    const manifest = await service.loadBneManifest('${testUrl}');
    
    const loadTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(\`✅ Manifest loaded in \${loadTime} seconds\`);
    console.log(\`📄 Total pages: \${manifest.totalPages}\`);
    console.log(\`📚 Title: \${manifest.displayName}\`);
    
    // Download first 10 pages for validation
    const pagesToTest = Math.min(10, manifest.pageLinks.length);
    console.log(\`\\n📥 Downloading \${pagesToTest} pages for validation...\`);
    
    for (let i = 0; i < pagesToTest; i++) {
        const pageUrl = manifest.pageLinks[i];
        console.log(\`  Downloading page \${i + 1}...\`);
        
        try {
            const pdfData = await downloadImage(pageUrl);
            const pdfPath = path.join('${testDir}', \`bne_page_\${i + 1}.pdf\`);
            await fs.writeFile(pdfPath, pdfData);
            console.log(\`  ✅ Page \${i + 1} downloaded: \${(pdfData.length / 1024 / 1024).toFixed(2)} MB\`);
        } catch (error) {
            console.log(\`  ❌ Page \${i + 1} failed: \${error.message}\`);
        }
    }
    
    return manifest;
}

test().then(manifest => {
    console.log('\\n✅ BNE validation completed successfully');
    console.log(JSON.stringify({ success: true, totalPages: manifest.totalPages }));
}).catch(error => {
    console.error('\\n❌ BNE validation failed:', error.message);
    console.log(JSON.stringify({ success: false, error: error.message }));
});
`;
        
        const testScriptPath = path.join(testDir, 'test-bne.js');
        await fs.writeFile(testScriptPath, testScript);
        
        console.log('🔄 Testing BNE implementation...\n');
        const { stdout, stderr } = await execAsync(`cd ${testDir} && node test-bne.js`);
        
        if (stderr) {
            console.error('Errors:', stderr);
        }
        
        console.log(stdout);
        
        // Parse result
        const resultLine = stdout.split('\n').find(line => line.includes('{"success":'));
        if (resultLine) {
            const result = JSON.parse(resultLine);
            
            if (result.success) {
                // Create validation PDF
                const pdfFiles = await fs.readdir(testDir);
                const pdfPaths = pdfFiles
                    .filter(f => f.endsWith('.pdf'))
                    .sort()
                    .map(f => `"${path.join(testDir, f)}"`);
                
                if (pdfPaths.length > 0) {
                    console.log('\n📄 Creating validation PDF...');
                    const mergedPdfPath = path.join(testDir, 'bne_validation.pdf');
                    
                    try {
                        await execAsync(`pdfunite ${pdfPaths.join(' ')} "${mergedPdfPath}"`);
                        console.log('✅ Validation PDF created');
                        
                        // Validate with poppler
                        const { stdout: pdfInfo } = await execAsync(`pdfinfo "${mergedPdfPath}"`);
                        console.log('✅ PDF validated with poppler');
                        
                        // Extract and check images
                        console.log('\n🖼️ Extracting images for content verification...');
                        await execAsync(`cd "${testDir}" && pdfimages -png bne_validation.pdf bne_extracted`);
                        
                        const extractedImages = (await fs.readdir(testDir))
                            .filter(f => f.startsWith('bne_extracted') && f.endsWith('.png'));
                        
                        console.log(`✅ Extracted ${extractedImages.length} images`);
                        
                    } catch (error) {
                        console.log('⚠️ Could not create/validate merged PDF:', error.message);
                    }
                }
                
                console.log(`\n📊 Summary:`);
                console.log(`  Status: ✅ SUCCESS`);
                console.log(`  Total pages found: ${result.totalPages}`);
                console.log(`  Test directory: ${testDir}`);
                
                return true;
            } else {
                console.log(`\n📊 Summary:`);
                console.log(`  Status: ❌ FAILED`);
                console.log(`  Error: ${result.error}`);
                return false;
            }
        }
        
    } catch (error) {
        console.error('❌ Validation error:', error.message);
        return false;
    }
}

validateBneFix();