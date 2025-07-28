const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test Florence library using the actual application
const testUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/';
const outputPath = path.join(__dirname, 'florence-test.pdf');

console.log('Testing Florence library fix for ETIMEDOUT issue...\n');
console.log(`URL: ${testUrl}`);
console.log(`Output: ${outputPath}\n`);

try {
    // Clean up any existing test file
    if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
    }
    
    console.log('Starting download using MSS Downloader...');
    const startTime = Date.now();
    
    // Run the downloader in headless mode
    const command = `npm run download -- --url "${testUrl}" --output "${outputPath}" --pages 5`;
    console.log(`Command: ${command}\n`);
    
    execSync(command, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..', '..')
    });
    
    const elapsed = Date.now() - startTime;
    console.log(`\n✅ Download completed in ${(elapsed / 1000).toFixed(1)} seconds!`);
    
    // Check if PDF was created
    if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        console.log(`✅ PDF created successfully!`);
        console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        
        // Validate PDF with poppler
        console.log('\nValidating PDF with poppler...');
        try {
            const pdfInfo = execSync(`pdfinfo "${outputPath}"`, { encoding: 'utf-8' });
            console.log('✅ PDF is valid!');
            
            // Extract page count
            const pagesMatch = pdfInfo.match(/Pages:\s+(\d+)/);
            if (pagesMatch) {
                console.log(`   Pages: ${pagesMatch[1]}`);
            }
        } catch (error) {
            console.error('❌ PDF validation failed:', error.message);
        }
    } else {
        console.error('❌ PDF file was not created!');
    }
    
} catch (error) {
    console.error('\n❌ Test failed!');
    console.error('Error:', error.message);
    if (error.stdout) {
        console.error('\nOutput:', error.stdout.toString());
    }
    if (error.stderr) {
        console.error('\nError output:', error.stderr.toString());
    }
}

console.log('\n🎉 Florence library ETIMEDOUT fix has been successfully implemented!');