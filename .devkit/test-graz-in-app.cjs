const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testGrazInApp() {
    console.log('=== Testing University of Graz Fix in App ===\n');
    
    const outputDir = path.join(__dirname, 'graz-validation-' + new Date().toISOString().split('T')[0]);
    await fs.mkdir(outputDir, { recursive: true });
    
    // Write test URLs to file
    const testUrls = [
        'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
        'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688'
    ];
    
    for (const url of testUrls) {
        console.log(`\nTesting: ${url}`);
        console.log('=' . repeat(60));
        
        const manuscriptId = url.match(/\/(\d+)$/)?.[1] || 'unknown';
        const outputFile = path.join(outputDir, `graz_${manuscriptId}.pdf`);
        
        // Start the app in headless mode
        console.log('Starting app in headless mode...');
        const appProcess = spawn('npm', ['run', 'dev:headless'], {
            env: { ...process.env, 
                MSS_URL: url,
                MSS_OUTPUT: outputFile,
                MSS_PAGES: '10'  // Download only 10 pages for testing
            },
            cwd: path.join(__dirname, '..')
        });
        
        let output = '';
        let errorOutput = '';
        let completed = false;
        
        appProcess.stdout.on('data', (data) => {
            output += data.toString();
            process.stdout.write(data);
            
            // Check for completion
            if (data.toString().includes('PDF created successfully') || 
                data.toString().includes('Download completed')) {
                completed = true;
            }
        });
        
        appProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
            process.stderr.write(data);
            
            // Check for ETIMEDOUT error
            if (data.toString().includes('ETIMEDOUT')) {
                console.log('\n✗ ETIMEDOUT error detected!');
            }
        });
        
        // Wait for completion or timeout
        const timeout = 180000; // 3 minutes
        const startTime = Date.now();
        
        while (!completed && (Date.now() - startTime) < timeout) {
            await sleep(1000);
        }
        
        // Kill the process
        appProcess.kill();
        
        // Check results
        if (completed) {
            try {
                const stats = await fs.stat(outputFile);
                console.log(`\n✓ PDF created successfully: ${outputFile}`);
                console.log(`  Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            } catch (e) {
                console.log('\n✗ PDF file not found');
            }
        } else {
            console.log('\n✗ Download did not complete within timeout');
        }
        
        // Wait a bit before next test
        await sleep(2000);
    }
    
    console.log(`\n\nValidation PDFs saved to: ${outputDir}`);
    console.log('Please check the PDFs manually to verify content.');
}

testGrazInApp().catch(console.error);