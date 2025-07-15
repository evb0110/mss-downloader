const fs = require('fs');
const path = require('path');

// Test Wolfenbüttel library with direct approach
async function testWolfenbuettelSimple() {
    console.log('=== WOLFENBÜTTEL LIBRARY SIMPLE TEST ===');
    
    const testUrl = 'https://diglib.hab.de/wdb.php?dir=mss/1008-helmst';
    const manuscriptId = '1008-helmst'; // Extract from URL
    const baseImageUrl = `http://diglib.hab.de/mss/${manuscriptId}/max`;
    
    console.log(`Testing manuscript: ${manuscriptId}`);
    console.log(`Base image URL: ${baseImageUrl}`);
    
    // Test page discovery
    console.log('\n1. Testing page discovery...');
    const pageLinks = [];
    let pageNum = 1;
    let consecutiveFailures = 0;
    
    while (consecutiveFailures < 10 && pageNum <= 50) { // Test first 50 pages
        const pageStr = pageNum.toString().padStart(5, '0');
        const imageUrl = `${baseImageUrl}/${pageStr}.jpg`;
        
        try {
            const response = await fetch(imageUrl);
            if (response.status === 200) {
                pageLinks.push(imageUrl);
                consecutiveFailures = 0;
                if (pageLinks.length % 10 === 0) {
                    console.log(`   Found ${pageLinks.length} pages so far...`);
                }
            } else {
                consecutiveFailures++;
            }
        } catch (error) {
            consecutiveFailures++;
        }
        
        pageNum++;
    }
    
    console.log(`   Total pages found: ${pageLinks.length}`);
    
    if (pageLinks.length === 0) {
        throw new Error('No pages found!');
    }
    
    // Test downloading first 10 pages
    console.log('\n2. Testing downloads...');
    const samplePages = pageLinks.slice(0, Math.min(10, pageLinks.length));
    const validationDir = path.join(__dirname, 'temp', 'wolfenbuettel-simple-validation');
    await fs.promises.mkdir(validationDir, { recursive: true });
    
    const downloadResults = [];
    
    for (let i = 0; i < samplePages.length; i++) {
        const pageUrl = samplePages[i];
        const pageNum = i + 1;
        
        try {
            console.log(`   Downloading page ${pageNum}/${samplePages.length}...`);
            const response = await fetch(pageUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const buffer = Buffer.from(await response.arrayBuffer());
            const filename = path.join(validationDir, `page-${pageNum.toString().padStart(3, '0')}.jpg`);
            await fs.promises.writeFile(filename, buffer);
            
            downloadResults.push({
                pageNum,
                url: pageUrl,
                filename,
                size: buffer.length,
                success: true
            });
            
            console.log(`   ✓ Page ${pageNum}: ${buffer.length} bytes`);
            
        } catch (error) {
            downloadResults.push({
                pageNum,
                url: pageUrl,
                error: error.message,
                success: false
            });
            
            console.log(`   ✗ Page ${pageNum}: ${error.message}`);
        }
    }
    
    // Summary
    const successCount = downloadResults.filter(r => r.success).length;
    const failureCount = downloadResults.filter(r => !r.success).length;
    
    console.log(`\n3. Test Summary:`);
    console.log(`   - Total pages found: ${pageLinks.length}`);
    console.log(`   - Sample pages tested: ${samplePages.length}`);
    console.log(`   - Successful downloads: ${successCount}`);
    console.log(`   - Failed downloads: ${failureCount}`);
    console.log(`   - Success rate: ${((successCount / samplePages.length) * 100).toFixed(1)}%`);
    console.log(`   - Files saved to: ${validationDir}`);
    
    if (successCount < Math.floor(samplePages.length * 0.8)) {
        throw new Error(`Too many failures: ${failureCount}/${samplePages.length}`);
    }
    
    console.log('\n✓ WOLFENBÜTTEL LIBRARY SIMPLE TEST PASSED');
    
    return {
        totalPages: pageLinks.length,
        pageLinks: pageLinks,
        downloadResults,
        validationDir,
        successRate: (successCount / samplePages.length) * 100
    };
}

// Run the test
testWolfenbuettelSimple().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});