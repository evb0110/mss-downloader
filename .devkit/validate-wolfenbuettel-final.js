const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Clean validation folder
const outputDir = path.join(process.env.HOME, 'Desktop', 'wolfenbuettel-pagination-fix');
if (fs.existsSync(outputDir)) {
    execSync(`rm -rf "${outputDir}"`, { stdio: 'inherit' });
}
fs.mkdirSync(outputDir, { recursive: true });

async function testManuscript(manuscriptId, expectedPages) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing: ${manuscriptId}`);
    console.log(`Expected: ${expectedPages}`);
    console.log('='.repeat(80));
    
    const allImageNames = [];
    let pointer = 0;
    let pageCount = 0;
    let hasMorePages = true;
    
    while (hasMorePages && pageCount < 50) { // Safety limit
        pageCount++;
        const thumbsUrl = `https://diglib.hab.de/thumbs.php?dir=mss/${manuscriptId}&pointer=${pointer}`;
        
        const response = await fetch(thumbsUrl);
        if (response.ok) {
            const html = await response.text();
            
            const imageMatches = html.matchAll(/image=([^'"&]+)/g);
            const imageNames = Array.from(imageMatches, m => m[1]);
            
            if (imageNames.length > 0) {
                allImageNames.push(...imageNames);
                process.stdout.write(`\rFetching page ${pageCount}... (${allImageNames.length} images so far)`);
                
                const nextPageMatch = html.match(/href="thumbs\.php\?dir=mss\/[^&]+&pointer=(\d+)"[^>]*><img[^>]*title="forward"/);
                if (nextPageMatch) {
                    const nextPointer = parseInt(nextPageMatch[1], 10);
                    if (nextPointer === pointer) {
                        hasMorePages = false;
                    } else {
                        pointer = nextPointer;
                    }
                } else {
                    hasMorePages = false;
                }
            } else {
                hasMorePages = false;
            }
        } else {
            hasMorePages = false;
        }
    }
    
    const uniqueImages = [...new Set(allImageNames)];
    console.log(`\n✓ Found ${uniqueImages.length} unique pages`);
    
    // Download sample pages
    const sampleIndices = [0, Math.floor(uniqueImages.length / 4), Math.floor(uniqueImages.length / 2), Math.floor(3 * uniqueImages.length / 4), uniqueImages.length - 1];
    const downloadedFiles = [];
    
    console.log('Downloading sample pages...');
    for (let i = 0; i < sampleIndices.length; i++) {
        const idx = sampleIndices[i];
        if (idx < uniqueImages.length) {
            const imageName = uniqueImages[idx];
            const imageUrl = `http://diglib.hab.de/mss/${manuscriptId}/max/${imageName}.jpg`;
            const fileName = `${manuscriptId}_page_${idx + 1}_of_${uniqueImages.length}.jpg`;
            const filePath = path.join(outputDir, fileName);
            
            try {
                const imgResponse = await fetch(imageUrl);
                if (imgResponse.ok) {
                    const buffer = await imgResponse.buffer();
                    fs.writeFileSync(filePath, buffer);
                    downloadedFiles.push(filePath);
                    console.log(`  ✓ Downloaded page ${idx + 1}/${uniqueImages.length} (${imageName})`);
                }
            } catch (error) {
                console.error(`  ✗ Failed to download page ${idx + 1}`);
            }
        }
    }
    
    // Create PDF
    if (downloadedFiles.length > 0) {
        const pdfName = `${manuscriptId}_${uniqueImages.length}pages_sample.pdf`;
        const pdfPath = path.join(outputDir, pdfName);
        
        try {
            execSync(`magick "${downloadedFiles.join('" "')}" "${pdfPath}"`, { stdio: 'pipe' });
            const stats = fs.statSync(pdfPath);
            console.log(`✓ Created PDF: ${pdfName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
            
            // Delete individual images
            downloadedFiles.forEach(f => fs.unlinkSync(f));
        } catch (error) {
            console.error('Failed to create PDF');
        }
    }
    
    return {
        manuscriptId,
        expected: expectedPages,
        actual: uniqueImages.length,
        success: uniqueImages.length > 20
    };
}

async function runValidation() {
    console.log('Wolfenbüttel Pagination Fix Validation');
    console.log('Testing manuscripts with many pages\n');
    
    const tests = [
        { id: '1008-helmst', expected: '576 pages' },
        { id: '532-helmst', expected: '200+ pages' },
        { id: '105-noviss-2f', expected: '20 pages (exactly)' }
    ];
    
    const results = [];
    
    for (const test of tests) {
        const result = await testManuscript(test.id, test.expected);
        results.push(result);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`\n${'='.repeat(80)}`);
    console.log('VALIDATION SUMMARY');
    console.log('='.repeat(80));
    
    results.forEach(r => {
        const status = r.success ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} ${r.manuscriptId}: Expected ${r.expected}, Got ${r.actual} pages`);
    });
    
    const allPass = results.every(r => r.success);
    console.log(`\nOverall: ${allPass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    console.log(`\nValidation PDFs saved to: ${outputDir}`);
}

runValidation().catch(console.error);