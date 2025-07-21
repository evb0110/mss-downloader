const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// Mock electron app for testing
if (!app) {
    global.app = {
        getPath: (name) => {
            if (name === 'userData') return path.join(__dirname, '..', 'test-data');
            return __dirname;
        },
        getName: () => 'mss-downloader',
        on: () => {}
    };
}

async function testGrazInElectron() {
    console.log('Testing Graz in Electron-like environment...\n');
    
    try {
        // Import the service
        const { EnhancedManuscriptDownloaderService } = require('../dist/main/services/EnhancedManuscriptDownloaderService.js');
        const service = new EnhancedManuscriptDownloaderService();
        
        const testUrls = [
            'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
            'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688'
        ];
        
        for (const url of testUrls) {
            console.log(`\nTesting: ${url}`);
            console.log('Starting time:', new Date().toISOString());
            
            try {
                const startTime = Date.now();
                const result = await service.parseManuscriptUrl(url);
                const elapsed = Date.now() - startTime;
                
                console.log(`Success in ${elapsed}ms!`);
                console.log(`Title: ${result.title}`);
                console.log(`Pages: ${result.pages}`);
                console.log(`Library: ${result.library}`);
                console.log(`Manifest URL: ${result.manifestUrl}`);
            } catch (error) {
                const elapsed = Date.now() - startTime;
                console.log(`Error after ${elapsed}ms:`, error.message);
                
                // Check if it's a network error
                if (error.code) {
                    console.log('Error code:', error.code);
                }
                if (error.stack) {
                    console.log('Stack trace:', error.stack);
                }
            }
        }
    } catch (error) {
        console.error('Setup error:', error);
    }
}

// Run the test
testGrazInElectron().catch(console.error);