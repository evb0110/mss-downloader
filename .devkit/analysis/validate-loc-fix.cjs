const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const testUrls = [
    'https://www.loc.gov/item/48040441/', // Original test manuscript (742 pages)
    'https://www.loc.gov/item/2021667393/', // Different manuscript for variety
];

async function runValidation(url, index) {
    return new Promise((resolve, reject) => {
        console.log(`\n=== Testing manuscript ${index + 1}: ${url} ===`);
        
        const outputDir = path.join(__dirname, 'loc-validation-output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const outputFile = path.join(outputDir, `loc_test_${index + 1}.pdf`);
        
        // Run the actual app in headless mode
        const startTime = Date.now();
        const proc = spawn('npm', ['run', 'dev:headless', '--', 
            '--url', url,
            '--output', outputFile,
            '--max-pages', '50' // Test first 50 pages for speed
        ], {
            cwd: path.join(__dirname, '..', '..'),
            env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
        });
        
        let lastProgressUpdate = Date.now();
        let progressData = '';
        
        proc.stdout.on('data', (data) => {
            const text = data.toString();
            progressData += text;
            
            // Log progress updates
            if (Date.now() - lastProgressUpdate > 5000 || text.includes('Download complete')) {
                console.log(text.trim());
                lastProgressUpdate = Date.now();
            }
        });
        
        proc.stderr.on('data', (data) => {
            const text = data.toString();
            if (text.includes('error') || text.includes('Error')) {
                console.error('Error:', text);
            }
        });
        
        proc.on('close', (code) => {
            const elapsed = (Date.now() - startTime) / 1000;
            
            if (code === 0 && fs.existsSync(outputFile)) {
                const stats = fs.statSync(outputFile);
                const sizeMB = stats.size / 1024 / 1024;
                
                console.log(`\nSuccess! PDF created: ${outputFile}`);
                console.log(`Size: ${sizeMB.toFixed(2)}MB`);
                console.log(`Time: ${elapsed.toFixed(1)}s`);
                console.log(`Speed: ${(sizeMB / elapsed).toFixed(2)} MB/s`);
                
                resolve({
                    url,
                    success: true,
                    sizeMB,
                    elapsed,
                    speed: sizeMB / elapsed,
                    outputFile
                });
            } else {
                console.error(`\nFailed! Exit code: ${code}`);
                resolve({
                    url,
                    success: false,
                    error: `Process exited with code ${code}`
                });
            }
        });
        
        proc.on('error', (err) => {
            console.error('Failed to start process:', err);
            reject(err);
        });
        
        // Set a timeout
        setTimeout(() => {
            proc.kill();
            reject(new Error('Process timeout after 5 minutes'));
        }, 300000); // 5 minutes
    });
}

async function main() {
    console.log('=== Library of Congress Performance Fix Validation ===');
    console.log('Testing with new optimization settings: 8 concurrent downloads\n');
    
    const results = [];
    
    for (let i = 0; i < testUrls.length; i++) {
        try {
            const result = await runValidation(testUrls[i], i);
            results.push(result);
        } catch (error) {
            console.error(`Test ${i + 1} failed:`, error.message);
            results.push({
                url: testUrls[i],
                success: false,
                error: error.message
            });
        }
    }
    
    // Summary
    console.log('\n\n=== VALIDATION SUMMARY ===');
    const successful = results.filter(r => r.success);
    console.log(`Success rate: ${successful.length}/${results.length}`);
    
    if (successful.length > 0) {
        const avgSpeed = successful.reduce((sum, r) => sum + r.speed, 0) / successful.length;
        const totalSize = successful.reduce((sum, r) => sum + r.sizeMB, 0);
        const totalTime = successful.reduce((sum, r) => sum + r.elapsed, 0);
        
        console.log(`\nPerformance metrics:`);
        console.log(`- Average download speed: ${avgSpeed.toFixed(2)} MB/s`);
        console.log(`- Total size downloaded: ${totalSize.toFixed(2)}MB`);
        console.log(`- Total time: ${totalTime.toFixed(1)}s`);
        
        console.log(`\nPDF files created:`);
        successful.forEach(r => {
            console.log(`- ${r.outputFile} (${r.sizeMB.toFixed(2)}MB)`);
        });
    }
    
    console.log('\n✅ Validation complete!');
}

main().catch(console.error);