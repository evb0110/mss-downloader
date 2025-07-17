const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

async function downloadBelgicaManuscript() {
    const browser = await chromium.launch({ 
        headless: true
    });
    
    try {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        console.log('Loading Belgica KBR manuscript...');
        await page.goto('https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415', {
            waitUntil: 'domcontentloaded'
        });
        
        await page.waitForTimeout(3000);
        
        // Get iframe URL and navigate to it
        const iframeUrl = await page.evaluate(() => {
            const iframe = document.querySelector('iframe');
            return iframe ? iframe.src : null;
        });
        
        if (!iframeUrl) {
            throw new Error('No iframe found');
        }
        
        console.log('Navigating to viewer...');
        await page.goto(iframeUrl, {
            waitUntil: 'networkidle'
        });
        
        await page.waitForTimeout(5000);
        
        // Extract the manuscript path from the URL
        const finalUrl = page.url();
        const manuscriptPath = finalUrl.match(/map=([^&]+)/)?.[1];
        
        if (!manuscriptPath) {
            throw new Error('Could not extract manuscript path');
        }
        
        console.log('Manuscript path:', manuscriptPath);
        
        // Based on the captured patterns, we know the structure:
        // zoomthumb: 600x400 medium resolution
        // zoomgallery: 70x70 thumbnails
        // zoommap: 200x200 small images
        
        // Try to find higher resolution patterns
        const resolutionTests = [
            { folder: 'zoom', suffix: '' },
            { folder: 'zoomoriginal', suffix: '' },
            { folder: 'zoommax', suffix: '' },
            { folder: 'zoomhigh', suffix: '' },
            { folder: 'zoomfull', suffix: '' },
            { folder: 'display', suffix: '' },
            { folder: 'original', suffix: '' },
            { folder: 'full', suffix: '' }
        ];
        
        let workingResolution = null;
        const baseId = 'BE-KBR00_A-1589485_0000-00-00_00';
        
        console.log('Testing for higher resolutions...');
        
        for (const res of resolutionTests) {
            const testUrl = `https://viewerd.kbr.be/display/${manuscriptPath}${res.folder}/${baseId}_0001${res.suffix}.jpg`;
            
            try {
                const response = await page.evaluate(async (url) => {
                    try {
                        const resp = await fetch(url);
                        return { ok: resp.ok, status: resp.status };
                    } catch (e) {
                        return { error: e.message };
                    }
                }, testUrl);
                
                if (response.ok) {
                    console.log(`Found working resolution: ${res.folder}`);
                    workingResolution = res;
                    break;
                }
            } catch (e) {
                // Continue to next
            }
        }
        
        // If no higher resolution found, use zoomthumb
        if (!workingResolution) {
            console.log('Using zoomthumb (600x400) resolution');
            workingResolution = { folder: 'zoomthumb', suffix: '_600x400' };
        }
        
        // Download pages
        const outputDir = path.join(__dirname, '../../.devkit/test-outputs/belgica-manuscript');
        await fs.mkdir(outputDir, { recursive: true });
        
        console.log('\nDownloading manuscript pages...');
        
        const downloadedFiles = [];
        let consecutiveFailures = 0;
        
        for (let i = 1; i <= 300; i++) { // Try up to 300 pages
            const pageNum = String(i).padStart(4, '0');
            const url = `https://viewerd.kbr.be/display/${manuscriptPath}${workingResolution.folder}/${baseId}_${pageNum}${workingResolution.suffix}.jpg`;
            
            try {
                // Download through browser context
                const buffer = await page.evaluate(async (url) => {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const blob = await response.blob();
                    const arrayBuffer = await blob.arrayBuffer();
                    return Array.from(new Uint8Array(arrayBuffer));
                }, url);
                
                const filename = `page_${pageNum}.jpg`;
                await fs.writeFile(path.join(outputDir, filename), Buffer.from(buffer));
                console.log(`Downloaded page ${i}`);
                downloadedFiles.push(filename);
                consecutiveFailures = 0;
                
            } catch (error) {
                consecutiveFailures++;
                if (consecutiveFailures > 5) {
                    console.log(`Stopping after ${i - 1} pages (5 consecutive failures)`);
                    break;
                }
            }
        }
        
        console.log(`\nDownloaded ${downloadedFiles.length} pages`);
        
        // Create a summary
        const summary = {
            url: 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415',
            manuscriptPath,
            resolution: workingResolution,
            totalPages: downloadedFiles.length,
            outputDirectory: outputDir,
            pattern: `https://viewerd.kbr.be/display/${manuscriptPath}${workingResolution.folder}/${baseId}_{pageNum}${workingResolution.suffix}.jpg`
        };
        
        await fs.writeFile(
            path.join(outputDir, 'download-summary.json'),
            JSON.stringify(summary, null, 2)
        );
        
        console.log('\nDownload complete. Files saved to:', outputDir);
        
        return summary;
        
    } catch (error) {
        console.error('Error:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

// Test PDF creation
async function createTestPDF() {
    const PDFDocument = require('pdfkit');
    const sharp = require('sharp');
    
    const outputDir = path.join(__dirname, '../../.devkit/test-outputs/belgica-manuscript');
    const files = await fs.readdir(outputDir);
    const imageFiles = files.filter(f => f.endsWith('.jpg') && f.startsWith('page_')).sort();
    
    if (imageFiles.length === 0) {
        console.log('No images found to create PDF');
        return;
    }
    
    console.log(`Creating PDF from ${imageFiles.length} images...`);
    
    const doc = new PDFDocument({ autoFirstPage: false });
    const pdfPath = path.join(outputDir, 'belgica-test.pdf');
    doc.pipe(fs.createWriteStream(pdfPath));
    
    for (let i = 0; i < Math.min(10, imageFiles.length); i++) {
        const imagePath = path.join(outputDir, imageFiles[i]);
        
        try {
            // Get image dimensions
            const metadata = await sharp(imagePath).metadata();
            
            // Add page with image dimensions
            doc.addPage({
                size: [metadata.width, metadata.height]
            });
            
            doc.image(imagePath, 0, 0, {
                width: metadata.width,
                height: metadata.height
            });
            
            console.log(`Added page ${i + 1}`);
        } catch (error) {
            console.error(`Error processing ${imageFiles[i]}:`, error.message);
        }
    }
    
    doc.end();
    console.log('PDF created:', pdfPath);
}

// Run the download and create test PDF
downloadBelgicaManuscript()
    .then(() => createTestPDF())
    .catch(console.error);