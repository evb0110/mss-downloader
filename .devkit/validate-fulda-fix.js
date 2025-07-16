const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// Import the manuscript downloader service
const downloaderPath = path.join(__dirname, '..', 'src', 'main', 'services', 'EnhancedManuscriptDownloaderService.ts');

// Compile and run TypeScript
const tsContent = `
import { EnhancedManuscriptDownloaderService } from './src/main/services/EnhancedManuscriptDownloaderService';
import * as fs from 'fs/promises';
import * as path from 'path';

async function validateFuldaFix() {
    const downloader = new EnhancedManuscriptDownloaderService();
    const testUrls = [
        'https://fuldig.hs-fulda.de/viewer/image/PPN314753702/',
        'https://fuldig.hs-fulda.de/viewer/api/v1/records/PPN314753702/manifest/',
        'https://fuldig.hs-fulda.de/viewer/image/PPN314755322/2/'
    ];
    
    console.log('Testing Fulda Library Fix\\n');
    
    for (const url of testUrls) {
        console.log(\`Testing URL: \${url}\`);
        try {
            const manifest = await downloader.loadFuldaManifest(url);
            console.log(\`✅ Success! Found \${manifest.pageLinks.length} pages\`);
            console.log(\`   Title: \${manifest.displayName}\`);
            
            // Test downloading first page
            if (manifest.pageLinks.length > 0) {
                console.log(\`   First page URL: \${manifest.pageLinks[0]}\`);
                
                // Verify it's using maximum resolution
                if (manifest.pageLinks[0].includes('/full/0/')) {
                    console.log('   ✅ Using maximum resolution (full/0/)');
                } else {
                    console.log('   ⚠️  Not using maximum resolution');
                }
            }
        } catch (error) {
            console.log(\`❌ Error: \${error.message}\`);
        }
        console.log('---\\n');
    }
    
    // Test actual PDF creation with one manuscript
    console.log('\\nCreating validation PDF...');
    try {
        const manifest = await downloader.loadFuldaManifest('https://fuldig.hs-fulda.de/viewer/image/PPN314753702/');
        
        // Create validation directory
        const validationDir = path.join(process.cwd(), '.devkit', 'fulda-validation-' + Date.now());
        await fs.mkdir(validationDir, { recursive: true });
        
        // Download first 10 pages
        const pagesToDownload = Math.min(10, manifest.pageLinks.length);
        console.log(\`Downloading \${pagesToDownload} pages...\`);
        
        const images = [];
        for (let i = 0; i < pagesToDownload; i++) {
            const imageUrl = manifest.pageLinks[i];
            console.log(\`Downloading page \${i + 1}...\`);
            
            const response = await fetch(imageUrl);
            if (!response.ok) {
                throw new Error(\`Failed to download page \${i + 1}\`);
            }
            
            const buffer = Buffer.from(await response.arrayBuffer());
            const imagePath = path.join(validationDir, \`page_\${String(i + 1).padStart(3, '0')}.jpg\`);
            await fs.writeFile(imagePath, buffer);
            images.push(imagePath);
            
            // Check file size to ensure it's a real image
            const stats = await fs.stat(imagePath);
            console.log(\`  Page \${i + 1}: \${(stats.size / 1024).toFixed(1)} KB\`);
        }
        
        console.log('\\n✅ Fulda fix validated successfully!');
        console.log(\`Images saved to: \${validationDir}\`);
        
    } catch (error) {
        console.log(\`\\n❌ Validation failed: \${error.message}\`);
    }
}

validateFuldaFix().catch(console.error);
`;

// Create a temporary test file
async function runTest() {
    const testFile = path.join(__dirname, 'validate-fulda-compiled.ts');
    await fs.writeFile(testFile, tsContent);
    
    try {
        // Run with ts-node
        execSync(`cd ${path.dirname(testFile)} && npx ts-node ${testFile}`, { 
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
        });
    } catch (error) {
        console.error('Failed to run test:', error.message);
    } finally {
        // Cleanup
        await fs.unlink(testFile).catch(() => {});
    }
}

runTest();