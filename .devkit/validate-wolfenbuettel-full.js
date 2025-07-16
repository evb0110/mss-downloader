const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Full validation for Wolfenbüttel with 10 different manuscripts
const testUrls = [
    'https://diglib.hab.de/wdb.php?dir=mss/105-noviss-2f',   // Folio notation
    'https://diglib.hab.de/wdb.php?dir=mss/1008-helmst',      // Sequential numbers
    'https://diglib.hab.de/wdb.php?dir=mss/1-gud-lat',        // Another pattern
    'https://diglib.hab.de/wdb.php?dir=mss/23-aug-4f',        // August collection
    'https://diglib.hab.de/wdb.php?dir=mss/95-weiss',         // Weiss collection
    'https://diglib.hab.de/wdb.php?dir=mss/42-aug-2f',        // Another August
    'https://diglib.hab.de/wdb.php?dir=mss/17-aug-4f',        // More August
    'https://diglib.hab.de/wdb.php?dir=mss/404-helmst',       // Helmstedt
    'https://diglib.hab.de/wdb.php?dir=mss/338-helmst',       // Another Helmstedt
    'https://diglib.hab.de/wdb.php?dir=mss/532-helmst'        // One more Helmstedt
];

// Clean output directory for user validation
const outputDir = path.join(process.env.HOME, 'Desktop', 'wolfenbuettel-validation-final');
if (fs.existsSync(outputDir)) {
    execSync(`rm -rf "${outputDir}"`, { stdio: 'inherit' });
}
fs.mkdirSync(outputDir, { recursive: true });

async function loadWolfenbuettelManifest(wolfenbuettelUrl) {
    const urlMatch = wolfenbuettelUrl.match(/dir=mss\/([^&]+)/);
    if (!urlMatch) {
        throw new Error('Could not extract manuscript ID from Wolfenbüttel URL');
    }

    const manuscriptId = urlMatch[1];
    console.log(`Loading Wolfenbüttel manuscript: ${manuscriptId}`);
    
    const pageLinks = [];
    try {
        const thumbsUrl = `https://diglib.hab.de/thumbs.php?dir=mss/${manuscriptId}&thumbs=0`;
        const thumbsResponse = await fetch(thumbsUrl);
        if (thumbsResponse.ok) {
            const thumbsHtml = await thumbsResponse.text();
            const imageMatches = thumbsHtml.matchAll(/image=([^'"&]+)/g);
            const imageNames = Array.from(imageMatches, m => m[1]);
            
            if (imageNames.length > 0) {
                console.log(`Found ${imageNames.length} images in thumbs page`);
                for (const imageName of imageNames) {
                    const imageUrl = `http://diglib.hab.de/mss/${manuscriptId}/max/${imageName}.jpg`;
                    pageLinks.push(imageUrl);
                }
            }
        }
    } catch (error) {
        console.warn(`Failed to fetch thumbs page: ${error}`);
    }
    
    if (pageLinks.length === 0) {
        console.log('Falling back to sequential page detection');
        const baseImageUrl = `http://diglib.hab.de/mss/${manuscriptId}/max`;
        
        let pageNum = 1;
        let consecutiveFailures = 0;
        
        while (consecutiveFailures < 10 && pageNum <= 500) {
            const pageStr = pageNum.toString().padStart(5, '0');
            const imageUrl = `${baseImageUrl}/${pageStr}.jpg`;
            
            try {
                const response = await fetch(imageUrl, { method: 'HEAD' });
                if (response.status === 200) {
                    pageLinks.push(imageUrl);
                    consecutiveFailures = 0;
                } else {
                    consecutiveFailures++;
                }
            } catch (error) {
                consecutiveFailures++;
            }
            
            pageNum++;
        }
    }

    if (pageLinks.length === 0) {
        throw new Error(`No pages found for Wolfenbüttel manuscript: ${manuscriptId}`);
    }

    const displayName = `Wolfenbüttel HAB MS ${manuscriptId}`;
    
    return {
        displayName,
        pageLinks,
        library: 'wolfenbuettel',
        originalUrl: wolfenbuettelUrl,
        totalPages: pageLinks.length
    };
}

async function downloadFile(url, filepath) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = await response.buffer();
    fs.writeFileSync(filepath, buffer);
    return fs.statSync(filepath).size;
}

async function createPdfForManuscript(manifest) {
    console.log(`  Creating PDF for ${manifest.displayName}...`);
    
    // Download 10 pages (or all if fewer)
    const pagesToDownload = Math.min(10, manifest.totalPages);
    const tempDir = path.join(outputDir, 'temp', manifest.displayName.replace(/[^a-zA-Z0-9-_]/g, '_'));
    
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const downloadedImages = [];
    
    for (let i = 0; i < pagesToDownload; i++) {
        const imageUrl = manifest.pageLinks[i];
        const fileName = `page_${(i + 1).toString().padStart(3, '0')}.jpg`;
        const filePath = path.join(tempDir, fileName);
        
        try {
            await downloadFile(imageUrl, filePath);
            downloadedImages.push(filePath);
        } catch (error) {
            console.error(`    Failed to download page ${i + 1}: ${error.message}`);
        }
    }
    
    if (downloadedImages.length === 0) {
        throw new Error('No pages downloaded');
    }
    
    // Create PDF with descriptive name
    const pdfName = `Wolfenbüttel_${manifest.displayName.split(' ').pop()}_${pagesToDownload}pages.pdf`;
    const pdfPath = path.join(outputDir, pdfName);
    
    execSync(`magick "${downloadedImages.join('" "')}" "${pdfPath}"`, { stdio: 'pipe' });
    
    // Clean up temp files
    execSync(`rm -rf "${tempDir}"`, { stdio: 'inherit' });
    
    const pdfStats = fs.statSync(pdfPath);
    console.log(`  ✓ Created: ${pdfName} (${(pdfStats.size / 1024 / 1024).toFixed(2)} MB)`);
    
    // Validate with poppler
    const pdfInfo = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
    const pageMatch = pdfInfo.match(/Pages:\s+(\d+)/);
    if (!pageMatch || parseInt(pageMatch[1]) !== downloadedImages.length) {
        throw new Error('PDF validation failed');
    }
    
    return {
        pdfPath,
        pdfName,
        pages: downloadedImages.length,
        size: pdfStats.size
    };
}

async function runValidation() {
    console.log('Wolfenbüttel Digital Library - Full Validation');
    console.log('Testing 10 different manuscripts with maximum resolution\n');
    
    const results = [];
    
    for (let i = 0; i < testUrls.length; i++) {
        const url = testUrls[i];
        console.log(`[${i + 1}/${testUrls.length}] Processing: ${url}`);
        
        try {
            const manifest = await loadWolfenbuettelManifest(url);
            console.log(`  ✓ Manifest loaded: ${manifest.totalPages} pages`);
            
            const pdfResult = await createPdfForManuscript(manifest);
            
            results.push({
                url,
                success: true,
                displayName: manifest.displayName,
                totalPages: manifest.totalPages,
                pdfName: pdfResult.pdfName,
                pdfPages: pdfResult.pages
            });
            
        } catch (error) {
            console.error(`  ✗ Failed: ${error.message}`);
            results.push({
                url,
                success: false,
                error: error.message
            });
        }
        
        // Small delay between manuscripts
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('VALIDATION SUMMARY');
    console.log('='.repeat(80));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`\nTotal manuscripts tested: ${results.length}`);
    console.log(`Successful: ${successful.length}`);
    console.log(`Failed: ${failed.length}`);
    
    if (successful.length > 0) {
        console.log('\nSuccessfully created PDFs:');
        successful.forEach(r => {
            console.log(`  ✓ ${r.pdfName}`);
        });
    }
    
    if (failed.length > 0) {
        console.log('\nFailed manuscripts:');
        failed.forEach(r => {
            console.log(`  ✗ ${r.url} - ${r.error}`);
        });
    }
    
    console.log(`\nValidation folder ready: ${outputDir}`);
    console.log('Contains only final PDF files for user inspection.');
    
    // Success rate
    const successRate = (successful.length / results.length * 100).toFixed(1);
    console.log(`\nSuccess rate: ${successRate}%`);
    
    if (successRate === '100.0') {
        console.log('\n✅ Wolfenbüttel library validation PASSED (100% success rate)');
    } else {
        console.log(`\n⚠️  Wolfenbüttel library validation needs attention (${successRate}% success rate)`);
    }
}

// Run validation
runValidation().catch(console.error);