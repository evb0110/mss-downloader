const fs = require('fs').promises;
const path = require('path');
const { JSDOM } = require('jsdom');
const sharp = require('sharp');
const PDFDocument = require('pdfkit');
const stream = require('stream');
const { promisify } = require('util');

const outputDir = path.join(__dirname, '../reports/wolfenbuettel-cycle-test');

// Create output directory
async function ensureDir(dir) {
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (err) {
        console.error('Error creating directory:', err);
    }
}

// Wolfenbüttel loader with detailed logging
async function loadWolfenbuettelManifest(url, libraryUrl) {
    console.log('\n=== STARTING WOLFENBÜTTEL DOWNLOAD ===');
    console.log('URL:', url);
    
    const pages = [];
    let abortController = new AbortController();
    
    try {
        // Parse URL
        const urlObj = new URL(url);
        const pathMatch = urlObj.pathname.match(/\/(drucke|varia)\/([^\/]+)\/([^\/]+)\//);
        let collection, subcollection, manuscript;
        
        if (pathMatch) {
            [, collection, subcollection, manuscript] = pathMatch;
        } else {
            const dirMatch = url.match(/dir=([^&]+)/);
            if (dirMatch) {
                const pathParts = dirMatch[1].split('/');
                collection = pathParts[0];
                manuscript = pathParts[pathParts.length - 1];
            }
        }
        
        console.log(`Collection: ${collection}, Subcollection: ${subcollection}, Manuscript: ${manuscript}`);
        
        // First try: Thumbs approach with pagination
        console.log('\n--- TRYING THUMBS APPROACH ---');
        let pointer = 0;
        let totalImages = 0;
        let cycleDetectionCounter = 0;
        const seenPointers = new Set();
        
        while (true) {
            const thumbsUrl = `https://diglib.hab.de/${collection}/${subcollection}/${manuscript}/thumbs.htm?pointer=${pointer}`;
            console.log(`\nFetching thumbs page: pointer=${pointer}`);
            console.log(`URL: ${thumbsUrl}`);
            
            // Cycle detection
            if (seenPointers.has(pointer)) {
                console.log('CYCLE DETECTED! Already seen pointer:', pointer);
                break;
            }
            seenPointers.add(pointer);
            
            try {
                const response = await fetch(thumbsUrl, { signal: abortController.signal });
                const html = await response.text();
                const dom = new JSDOM(html);
                const doc = dom.window.document;
                
                // Extract image names from current page
                const imageLinks = doc.querySelectorAll('a[href*=".jpg"], a[href*=".JPG"]');
                console.log(`Found ${imageLinks.length} images on this page`);
                
                imageLinks.forEach(link => {
                    const href = link.getAttribute('href');
                    const imageName = href.split('/').pop().split('?')[0];
                    if (!pages.some(p => p.label === imageName)) {
                        const imageUrl = `https://diglib.hab.de/${collection}/${subcollection}/${manuscript}/${imageName}`;
                        pages.push({
                            id: imageUrl,
                            label: imageName,
                            type: 'Image',
                            width: 2000,
                            height: 3000
                        });
                        totalImages++;
                        console.log(`  Added: ${imageName}`);
                    }
                });
                
                // Look for next page button
                let nextPointer = pointer;
                const forwardLink = doc.querySelector('a[href*="forward.gif"], a img[src*="forward.gif"]');
                
                if (forwardLink) {
                    const parentLink = forwardLink.tagName === 'IMG' ? forwardLink.parentElement : forwardLink;
                    const href = parentLink?.getAttribute('href');
                    if (href) {
                        const pointerMatch = href.match(/pointer=(\d+)/);
                        if (pointerMatch) {
                            nextPointer = parseInt(pointerMatch[1]);
                        }
                    }
                }
                
                console.log(`Current pointer: ${pointer}, Next pointer: ${nextPointer}`);
                
                // Check if we're stuck
                if (nextPointer === pointer || cycleDetectionCounter > 50) {
                    console.log('Reached end of thumbs pages or cycle limit exceeded');
                    console.log(`Total cycle detection counter: ${cycleDetectionCounter}`);
                    break;
                }
                
                pointer = nextPointer;
                cycleDetectionCounter++;
                
                // Safety limit
                if (pages.length > 500) {
                    console.log('Reached safety limit of 500 pages');
                    break;
                }
                
            } catch (err) {
                console.error('Error fetching thumbs page:', err.message);
                break;
            }
        }
        
        console.log(`\nThumbs approach completed. Total images found: ${pages.length}`);
        
        // If no images found, try sequential approach
        if (pages.length === 0) {
            console.log('\n--- TRYING SEQUENTIAL APPROACH ---');
            // Sequential approach code would go here...
        }
        
        return pages;
        
    } catch (err) {
        console.error('Error in loadWolfenbuettelManifest:', err);
        return pages;
    }
}

// Download single image with retry
async function downloadImage(url, filename, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`Downloading (attempt ${i + 1}): ${url}`);
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const buffer = await response.arrayBuffer();
            await fs.writeFile(filename, Buffer.from(buffer));
            console.log(`  ✓ Downloaded: ${path.basename(filename)}`);
            return true;
        } catch (err) {
            console.error(`  ✗ Attempt ${i + 1} failed:`, err.message);
            if (i === retries - 1) return false;
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    return false;
}

// Main test function
async function testWolfenbuettelCycle() {
    const testUrl = 'https://diglib.hab.de/varia/selecta/ed000011/start.htm?distype=thumbs-img&imgtyp=0&size=';
    
    console.log('Testing Wolfenbüttel cycle issue...');
    console.log('URL:', testUrl);
    
    await ensureDir(outputDir);
    
    // Load manifest
    const pages = await loadWolfenbuettelManifest(testUrl);
    
    console.log(`\n=== MANIFEST SUMMARY ===`);
    console.log(`Total pages found: ${pages.length}`);
    
    if (pages.length === 0) {
        console.error('No pages found! This might be the issue.');
        return;
    }
    
    // Download first 10 pages for testing
    console.log('\n=== DOWNLOADING SAMPLE PAGES ===');
    const samplesToDownload = Math.min(10, pages.length);
    const downloadedFiles = [];
    
    for (let i = 0; i < samplesToDownload; i++) {
        const page = pages[i];
        const filename = path.join(outputDir, `page_${i + 1}_${page.label}`);
        const success = await downloadImage(page.id, filename);
        if (success) downloadedFiles.push(filename);
    }
    
    console.log(`\nDownloaded ${downloadedFiles.length} of ${samplesToDownload} pages`);
    
    // Create PDF
    if (downloadedFiles.length > 0) {
        console.log('\n=== CREATING PDF ===');
        const pdfPath = path.join(outputDir, 'wolfenbuettel_test.pdf');
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
                console.error(`Error adding image to PDF:`, err.message);
            }
        }
        
        doc.end();
        await promisify(stream.finished)(writeStream);
        console.log(`\nPDF created: ${pdfPath}`);
    }
    
    // Save detailed report
    const report = {
        url: testUrl,
        timestamp: new Date().toISOString(),
        pagesFound: pages.length,
        pagesDownloaded: downloadedFiles.length,
        firstTenPages: pages.slice(0, 10).map(p => ({
            label: p.label,
            url: p.id
        }))
    };
    
    await fs.writeFile(
        path.join(outputDir, 'test-report.json'),
        JSON.stringify(report, null, 2)
    );
    
    console.log('\n=== TEST COMPLETE ===');
    console.log(`Results saved to: ${outputDir}`);
}

// Run test
testWolfenbuettelCycle().catch(console.error);