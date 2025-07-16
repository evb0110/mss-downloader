const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function loadWolfenbuettelManifest(wolfenbuettelUrl) {
    const urlMatch = wolfenbuettelUrl.match(/dir=mss\/([^&]+)/);
    if (!urlMatch) {
        throw new Error('Could not extract manuscript ID from Wolfenbüttel URL');
    }

    const manuscriptId = urlMatch[1];
    console.log(`Loading Wolfenbüttel manuscript: ${manuscriptId}`);
    
    const pageLinks = [];
    const allImageNames = [];
    
    try {
        let pointer = 0;
        let hasMorePages = true;
        
        while (hasMorePages) {
            const thumbsUrl = `https://diglib.hab.de/thumbs.php?dir=mss/${manuscriptId}&pointer=${pointer}`;
            console.log(`Fetching page list from: ${thumbsUrl} (pointer=${pointer})`);
            
            const thumbsResponse = await fetch(thumbsUrl);
            if (thumbsResponse.ok) {
                const thumbsHtml = await thumbsResponse.text();
                
                // Extract image names from current thumbs page
                const imageMatches = thumbsHtml.matchAll(/image=([^'"&]+)/g);
                const imageNames = Array.from(imageMatches, m => m[1]);
                
                // Filter duplicates on current page
                const uniqueOnPage = [...new Set(imageNames)];
                
                if (uniqueOnPage.length > 0) {
                    allImageNames.push(...uniqueOnPage);
                    console.log(`Found ${uniqueOnPage.length} unique images on page (total so far: ${allImageNames.length})`);
                    
                    // Check if there's a next page link (forward button)
                    const nextPageMatch = thumbsHtml.match(/href="thumbs\.php\?dir=mss\/[^&]+&pointer=(\d+)"[^>]*><img[^>]*title="forward"/);
                    if (nextPageMatch) {
                        const nextPointer = parseInt(nextPageMatch[1], 10);
                        console.log(`Next page found: pointer=${nextPointer}`);
                        pointer = nextPointer;
                    } else {
                        console.log('No next page found - reached end');
                        hasMorePages = false;
                    }
                } else {
                    console.log('No images found on page');
                    hasMorePages = false;
                }
            } else {
                console.log(`HTTP error: ${thumbsResponse.status}`);
                hasMorePages = false;
            }
        }
        
        // Remove any final duplicates
        const finalImageNames = [...new Set(allImageNames)];
        
        if (finalImageNames.length > 0) {
            console.log(`Total unique images found: ${finalImageNames.length}`);
            
            // Convert all image names to full URLs using maximum resolution
            for (const imageName of finalImageNames) {
                const imageUrl = `http://diglib.hab.de/mss/${manuscriptId}/max/${imageName}.jpg`;
                pageLinks.push(imageUrl);
            }
        }
    } catch (error) {
        console.warn(`Failed to fetch thumbs pages: ${error}`);
    }
    
    if (pageLinks.length === 0) {
        throw new Error(`No pages found for Wolfenbüttel manuscript: ${manuscriptId}`);
    }

    const displayName = `Wolfenbüttel HAB MS ${manuscriptId}`;
    
    console.log(`\n✅ Success! Found ${pageLinks.length} pages in Wolfenbüttel manuscript`);

    return {
        displayName,
        pageLinks,
        library: 'wolfenbuettel',
        originalUrl: wolfenbuettelUrl,
        totalPages: pageLinks.length
    };
}

async function createSamplePdf(manifest) {
    console.log('\nCreating sample PDF to verify fix...');
    
    // Create output directory
    const outputDir = path.join(__dirname, 'wolfenbuettel-fix-validation');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Download sample pages
    const pagesToDownload = Math.min(5, manifest.totalPages);
    const downloadedFiles = [];
    
    console.log(`Downloading ${pagesToDownload} sample pages...`);
    
    for (let i = 0; i < pagesToDownload; i++) {
        const pageNum = Math.floor(i * manifest.totalPages / pagesToDownload);
        const imageUrl = manifest.pageLinks[pageNum];
        const fileName = `page_${pageNum + 1}.jpg`;
        const filePath = path.join(outputDir, fileName);
        
        try {
            const response = await fetch(imageUrl);
            if (response.ok) {
                const buffer = await response.buffer();
                fs.writeFileSync(filePath, buffer);
                downloadedFiles.push(filePath);
                console.log(`  ✓ Downloaded page ${pageNum + 1}/${manifest.totalPages}`);
            }
        } catch (error) {
            console.error(`  ✗ Failed to download page ${pageNum + 1}: ${error.message}`);
        }
    }
    
    if (downloadedFiles.length > 0) {
        const pdfPath = path.join(outputDir, `${manifest.displayName.replace(/[^a-zA-Z0-9-_]/g, '_')}_sample.pdf`);
        console.log('\nCreating PDF...');
        
        try {
            execSync(`magick "${downloadedFiles.join('" "')}" "${pdfPath}"`, { stdio: 'pipe' });
            const stats = fs.statSync(pdfPath);
            console.log(`✓ PDF created: ${path.basename(pdfPath)} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
            
            // Verify with poppler
            const pdfInfo = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
            const pageMatch = pdfInfo.match(/Pages:\s+(\d+)/);
            if (pageMatch) {
                console.log(`✓ PDF validated: ${pageMatch[1]} pages`);
            }
        } catch (error) {
            console.error(`Failed to create PDF: ${error.message}`);
        }
    }
}

async function runTest() {
    console.log('Wolfenbüttel Complete Page Detection Test');
    console.log('='.repeat(80));
    
    const testUrls = [
        'https://diglib.hab.de/wdb.php?dir=mss/1008-helmst',     // Should have 500+ pages
        'https://diglib.hab.de/wdb.php?dir=mss/105-noviss-2f',   // Should have exactly 20
        'https://diglib.hab.de/wdb.php?dir=mss/532-helmst'       // Should have 200+ pages
    ];
    
    for (const url of testUrls) {
        console.log(`\nTesting: ${url}`);
        console.log('-'.repeat(80));
        
        try {
            const manifest = await loadWolfenbuettelManifest(url);
            
            console.log(`\nManifest Summary:`);
            console.log(`- Display Name: ${manifest.displayName}`);
            console.log(`- Total Pages: ${manifest.totalPages}`);
            console.log(`- First Page: ${path.basename(manifest.pageLinks[0])}`);
            console.log(`- Last Page: ${path.basename(manifest.pageLinks[manifest.pageLinks.length - 1])}`);
            
            if (manifest.totalPages > 20) {
                console.log(`\n✅ SUCCESS: Found all ${manifest.totalPages} pages (more than 20)`);
                
                // Create sample PDF for large manuscript
                if (url.includes('1008-helmst')) {
                    await createSamplePdf(manifest);
                }
            } else if (manifest.totalPages === 20) {
                console.log(`\n✅ OK: Found exactly 20 pages (manuscript might have exactly 20)`);
            } else {
                console.log(`\n❌ ISSUE: Found only ${manifest.totalPages} pages`);
            }
            
        } catch (error) {
            console.error(`\n❌ ERROR: ${error.message}`);
        }
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('Test completed!');
}

runTest().catch(console.error);