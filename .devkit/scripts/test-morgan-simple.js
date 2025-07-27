const fs = require('fs').promises;
const path = require('path');

// We'll test by running the app in headless mode with a specific Morgan URL
const testUrl = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';

async function testMorganFix() {
    console.log('Testing Morgan Library fix...\n');
    console.log('URL:', testUrl);
    
    try {
        // Create config for testing
        const testConfig = {
            urls: [testUrl],
            outputDirectory: path.join(__dirname, '../validation/morgan'),
            skipExisting: false,
            createSubfolders: false,
            downloadWorkers: 1,
            pageWorkers: 5,
            startPage: 1,
            endPage: 5, // Test first 5 pages
            selectedManuscripts: []
        };
        
        // Create output directory
        await fs.mkdir(testConfig.outputDirectory, { recursive: true });
        
        // Write test config
        const configPath = path.join(__dirname, '../validation/morgan/test-config.json');
        await fs.writeFile(configPath, JSON.stringify(testConfig, null, 2));
        
        console.log('Created test config:', configPath);
        console.log('\nTest configuration:');
        console.log('- Download first 5 pages');
        console.log('- Output directory:', testConfig.outputDirectory);
        
        console.log('\n✅ Test setup complete!');
        console.log('\nTo run the test:');
        console.log('1. npm run dev:headless');
        console.log('2. Load the config from:', configPath);
        console.log('3. Start download');
        console.log('4. Check the output PDF');
        
        console.log('\nExpected result: Should create a PDF with 5 different pages from Lindau Gospels');
        
    } catch (error) {
        console.error('Test setup failed:', error.message);
    }
}

testMorganFix().catch(console.error);