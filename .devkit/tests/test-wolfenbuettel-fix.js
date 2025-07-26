const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
const PDFDocument = require('pdfkit');
const sharp = require('sharp');
const stream = require('stream');
const { promisify } = require('util');

async function testWolfenbuettelFix() {
    console.log('=== TESTING WOLFENBÜTTEL FIX ===\n');
    
    const outputDir = path.join(__dirname, '../reports/wolfenbuettel-fix-test');
    await fs.mkdir(outputDir, { recursive: true });
    
    // Test URL
    const testUrl = 'https://diglib.hab.de/varia/selecta/ed000011/start.htm';
    const manuscriptId = 'varia/selecta/ed000011';
    
    console.log('Testing manuscript:', manuscriptId);
    console.log('URL:', testUrl);
    
    // Simulate the fixed logic
    const pageLinks = [];
    const allImageNames = [];
    let pointer = 0;
    let hasMorePages = true;
    let pagesProcessed = 0;
    
    console.log('\n=== CRAWLING THUMBS PAGES ===');
    
    while (hasMorePages && pagesProcessed < 50) { // Safety limit
        const thumbsUrl = `https://diglib.hab.de/thumbs.php?dir=${manuscriptId}&pointer=${pointer}`;
        console.log(`\nFetching page ${pagesProcessed + 1}: pointer=${pointer}`);
        
        try {
            const response = await fetch(thumbsUrl);
            if (response.ok) {
                const html = await response.text();
                
                // Extract image names
                const imageMatches = html.matchAll(/image=([^'"&]+)/g);
                const imageNames = Array.from(imageMatches, m => m[1]);
                
                if (imageNames.length > 0) {
                    const newImages = imageNames.filter(name => !allImageNames.includes(name));
                    allImageNames.push(...newImages);
                    console.log(`  Found ${imageNames.length} images (${newImages.length} new), total: ${allImageNames.length}`);
                    
                    // Check for next page with fixed regex
                    const nextPageMatch = html.match(/href="thumbs\.php\?dir=[^&]+&pointer=(\d+)"[^>]*>.*?pfeilrechtsaktiv\.gif/);
                    
                    if (nextPageMatch) {
                        const nextPointer = parseInt(nextPageMatch[1], 10);
                        console.log(`  Next pointer found: ${nextPointer}`);
                        
                        if (nextPointer === pointer) {
                            console.log('  Reached last page (same pointer)');
                            hasMorePages = false;
                        } else {
                            pointer = nextPointer;
                        }
                    } else {
                        console.log('  No forward button found - reached end');
                        hasMorePages = false;
                    }
                } else {
                    console.log('  No images found on this page');
                    hasMorePages = false;
                }
            } else {
                console.log(`  Failed to fetch: ${response.status}`);
                hasMorePages = false;
            }
        } catch (err) {
            console.error(`  Error: ${err.message}`);
            hasMorePages = false;
        }
        
        pagesProcessed++;
    }
    
    console.log(`\n=== CRAWLING COMPLETE ===`);
    console.log(`Total unique images found: ${allImageNames.length}`);
    console.log(`Pages processed: ${pagesProcessed}`);
    
    // Convert to full URLs
    for (const imageName of allImageNames) {
        const imageUrl = `http://diglib.hab.de/${manuscriptId}/max/${imageName}.jpg`;
        pageLinks.push({
            url: imageUrl,
            name: imageName
        });
    }
    
    // Download sample pages
    console.log('\n=== DOWNLOADING SAMPLE PAGES ===');
    const samplesToDownload = Math.min(10, pageLinks.length);
    const downloadedFiles = [];
    
    for (let i = 0; i < samplesToDownload; i++) {
        const page = pageLinks[i];
        const filename = path.join(outputDir, `page_${i + 1}_${page.name}.jpg`);
        
        try {
            console.log(`Downloading page ${i + 1}/${samplesToDownload}: ${page.name}`);
            const response = await fetch(page.url);
            
            if (response.ok) {
                const buffer = await response.arrayBuffer();
                await fs.writeFile(filename, Buffer.from(buffer));
                downloadedFiles.push(filename);
                console.log(`  ✓ Downloaded successfully`);
            } else {
                console.log(`  ✗ Failed: HTTP ${response.status}`);
            }
        } catch (err) {
            console.log(`  ✗ Error: ${err.message}`);
        }
    }
    
    // Create PDF
    if (downloadedFiles.length > 0) {
        console.log('\n=== CREATING PDF ===');
        const pdfPath = path.join(outputDir, 'wolfenbuettel_ed000011.pdf');
        const doc = new PDFDocument({ autoFirstPage: false });
        const writeStream = fs.createWriteStream(pdfPath);
        doc.pipe(writeStream);
        
        for (const file of downloadedFiles) {
            try {
                const metadata = await sharp(file).metadata();
                doc.addPage({ size: [metadata.width, metadata.height] });
                doc.image(file, 0, 0, { width: metadata.width, height: metadata.height });
                console.log(`Added to PDF: ${path.basename(file)}`);
            } catch (err) {
                console.error(`Error processing image:`, err.message);
            }
        }
        
        doc.end();
        await promisify(stream.finished)(writeStream);
        console.log(`\nPDF created: ${pdfPath}`);
        
        // Validate PDF
        const { exec } = require('child_process');
        const { promisify: promisifyExec } = require('util');
        const execPromise = promisifyExec(exec);
        
        try {
            const { stdout } = await execPromise(`pdfimages -list "${pdfPath}" | head -20`);
            console.log('\n=== PDF VALIDATION ===');
            console.log(stdout);
        } catch (err) {
            console.log('PDF validation skipped (pdfimages not available)');
        }
    }
    
    // Generate report
    const report = {
        manuscript: manuscriptId,
        url: testUrl,
        timestamp: new Date().toISOString(),
        totalPages: pageLinks.length,
        pagesDownloaded: downloadedFiles.length,
        pagesProcessed: pagesProcessed,
        success: pageLinks.length > 0 && downloadedFiles.length > 0,
        samplePages: pageLinks.slice(0, 5).map(p => p.name)
    };
    
    await fs.writeFile(
        path.join(outputDir, 'test-report.json'),
        JSON.stringify(report, null, 2)
    );
    
    console.log('\n=== TEST SUMMARY ===');
    console.log(`Status: ${report.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Total pages found: ${report.totalPages}`);
    console.log(`Pages downloaded: ${report.pagesDownloaded}`);
    console.log(`Results saved to: ${outputDir}`);
}

testWolfenbuettelFix().catch(console.error);