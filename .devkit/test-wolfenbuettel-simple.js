const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Test manuscripts - including the problematic one and others
const testUrls = [
    'https://diglib.hab.de/wdb.php?dir=mss/105-noviss-2f',  // The one that failed
    'https://diglib.hab.de/wdb.php?dir=mss/1008-helmst',     // A different one
    'https://diglib.hab.de/wdb.php?dir=mss/1-gud-lat',       // Another pattern
];

// Create output directory
const outputDir = path.join(__dirname, 'wolfenbuettel-validation');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function loadWolfenbuettelManifest(wolfenbuettelUrl) {
    // URL format: https://diglib.hab.de/wdb.php?dir=mss/1008-helmst
    const urlMatch = wolfenbuettelUrl.match(/dir=mss\/([^&]+)/);
    if (!urlMatch) {
        throw new Error('Could not extract manuscript ID from Wolfenbüttel URL');
    }

    const manuscriptId = urlMatch[1];
    console.log(`Loading Wolfenbüttel manuscript: ${manuscriptId}`);
    
    // First try to get page list from thumbs.php
    const pageLinks = [];
    try {
        const thumbsUrl = `https://diglib.hab.de/thumbs.php?dir=mss/${manuscriptId}&thumbs=0`;
        console.log(`Fetching page list from: ${thumbsUrl}`);
        
        const thumbsResponse = await fetch(thumbsUrl);
        if (thumbsResponse.ok) {
            const thumbsHtml = await thumbsResponse.text();
            
            // Extract image names from thumbs page (e.g., image=001v, image=002r)
            const imageMatches = thumbsHtml.matchAll(/image=([^'"&]+)/g);
            const imageNames = Array.from(imageMatches, m => m[1]);
            
            if (imageNames.length > 0) {
                console.log(`Found ${imageNames.length} images in thumbs page`);
                
                // Convert image names to full URLs using maximum resolution
                for (const imageName of imageNames) {
                    const imageUrl = `http://diglib.hab.de/mss/${manuscriptId}/max/${imageName}.jpg`;
                    pageLinks.push(imageUrl);
                }
            }
        }
    } catch (error) {
        console.warn(`Failed to fetch thumbs page: ${error}`);
    }
    
    // If thumbs approach failed, fall back to sequential number testing
    if (pageLinks.length === 0) {
        console.log('Falling back to sequential page detection');
        const baseImageUrl = `http://diglib.hab.de/mss/${manuscriptId}/max`;
        
        let pageNum = 1;
        let consecutiveFailures = 0;
        
        while (consecutiveFailures < 10 && pageNum <= 500) { // Maximum 500 pages
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
    
    console.log(`Found ${pageLinks.length} pages in Wolfenbüttel manuscript`);

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

async function testManuscript(url) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing: ${url}`);
    console.log('='.repeat(80));
    
    try {
        // Load manifest
        const manifest = await loadWolfenbuettelManifest(url);
        console.log(`✓ Manifest loaded: ${manifest.displayName}`);
        console.log(`✓ Total pages: ${manifest.totalPages}`);
        
        // Download first 10 pages (or all if fewer)
        const pagesToTest = Math.min(10, manifest.totalPages);
        const manuscriptDir = path.join(outputDir, manifest.displayName.replace(/[^a-zA-Z0-9-_]/g, '_'));
        
        if (!fs.existsSync(manuscriptDir)) {
            fs.mkdirSync(manuscriptDir, { recursive: true });
        }
        
        const downloadedImages = [];
        
        for (let i = 0; i < pagesToTest; i++) {
            const imageUrl = manifest.pageLinks[i];
            const fileName = `page_${(i + 1).toString().padStart(3, '0')}.jpg`;
            const filePath = path.join(manuscriptDir, fileName);
            
            console.log(`  Downloading page ${i + 1}/${pagesToTest}: ${imageUrl}`);
            
            try {
                const size = await downloadFile(imageUrl, filePath);
                console.log(`    ✓ Downloaded: ${fileName} (${(size / 1024 / 1024).toFixed(2)} MB)`);
                downloadedImages.push(filePath);
            } catch (error) {
                console.error(`    ✗ Failed to download page ${i + 1}: ${error.message}`);
            }
        }
        
        // Create PDF from downloaded images
        if (downloadedImages.length > 0) {
            const pdfPath = path.join(outputDir, `${manifest.displayName.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`);
            console.log(`\n  Creating PDF...`);
            
            try {
                execSync(`convert "${downloadedImages.join('" "')}" "${pdfPath}"`, { stdio: 'inherit' });
                const pdfStats = fs.statSync(pdfPath);
                console.log(`  ✓ PDF created: ${path.basename(pdfPath)} (${(pdfStats.size / 1024 / 1024).toFixed(2)} MB)`);
                
                // Validate PDF with poppler
                console.log(`  Validating PDF...`);
                try {
                    const pdfInfo = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
                    const pageMatch = pdfInfo.match(/Pages:\s+(\d+)/);
                    if (pageMatch) {
                        console.log(`  ✓ PDF validated: ${pageMatch[1]} pages`);
                    }
                } catch (error) {
                    console.error(`  ✗ PDF validation failed: ${error.message}`);
                }
                
            } catch (error) {
                console.error(`  ✗ Failed to create PDF: ${error.message}`);
            }
        }
        
        return {
            url,
            success: true,
            displayName: manifest.displayName,
            totalPages: manifest.totalPages,
            downloadedPages: downloadedImages.length,
            message: 'Success'
        };
        
    } catch (error) {
        console.error(`✗ Failed: ${error.message}`);
        return {
            url,
            success: false,
            message: error.message
        };
    }
}

async function runTests() {
    console.log('Wolfenbüttel Digital Library Fix Validation');
    console.log('Testing with maximum resolution images');
    
    const results = [];
    
    for (const url of testUrls) {
        const result = await testManuscript(url);
        results.push(result);
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`\nTotal tests: ${results.length}`);
    console.log(`Successful: ${successful.length}`);
    console.log(`Failed: ${failed.length}`);
    
    if (successful.length > 0) {
        console.log('\nSuccessful manuscripts:');
        successful.forEach(r => {
            console.log(`  ✓ ${r.displayName} - ${r.totalPages} pages (downloaded ${r.downloadedPages})`);
        });
    }
    
    if (failed.length > 0) {
        console.log('\nFailed manuscripts:');
        failed.forEach(r => {
            console.log(`  ✗ ${r.url} - ${r.message}`);
        });
    }
    
    console.log(`\nOutput directory: ${outputDir}`);
    console.log('\nValidation complete!');
}

// Run tests
runTests().catch(console.error);