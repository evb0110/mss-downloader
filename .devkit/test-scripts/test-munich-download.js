#!/usr/bin/env node

const path = require('path');
const fs = require('fs').promises;

// Need to set up electron app paths
const { app } = require('electron');
app.setPath('userData', path.join(process.cwd(), '.devkit/electron-test-data'));

// Import production service
const { EnhancedManuscriptDownloaderService } = require('../../dist/main/services/EnhancedManuscriptDownloaderService.js');

async function testMunichDownload() {
    const service = new EnhancedManuscriptDownloaderService();
    const munichUrl = 'https://www.digitale-sammlungen.de/en/view/bsb10193966?page=1';
    
    console.log('Testing Munich download with EnhancedManuscriptDownloaderService...');
    console.log('URL:', munichUrl);
    
    try {
        // Test downloading just first 2 pages
        const result = await service.downloadManuscript(munichUrl, {
            startPage: 1,
            endPage: 2,
            onProgress: (progress) => {
                console.log(`Progress: ${progress.completed}/${progress.total}`);
            },
            onManifestLoaded: (manifest) => {
                console.log('Manifest loaded:', manifest.totalPages, 'pages');
            }
        });
        
        console.log('✅ SUCCESS: Munich download completed');
        console.log('Result:', result);
        
        // Clean up
        if (result.filepath) {
            try {
                await fs.unlink(result.filepath);
                console.log('Cleaned up test file');
            } catch (e) {}
        }
        
        return true;
    } catch (error) {
        console.log('❌ FAILED:', error.message);
        if (error.stack && error.stack.includes('validImagePaths')) {
            console.log('⚠️  STILL GETTING validImagePaths ERROR!');
            console.log('Stack trace:', error.stack);
        }
        return false;
    }
}

// Need to compile TypeScript first
const { execSync } = require('child_process');
console.log('Building TypeScript files...');
try {
    execSync('npm run build:main:bundled', { stdio: 'inherit' });
} catch (e) {
    console.error('Build failed:', e.message);
    process.exit(1);
}

testMunichDownload().then(success => {
    process.exit(success ? 0 : 1);
});