const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const sharp = require('sharp');

async function downloadBelgicaManuscript(belgicaUrl, outputName) {
    console.log(`\nDownloading ${outputName} from ${belgicaUrl}...`);
    
    const browser = await chromium.launch({ headless: true });
    
    try {
        const page = await browser.newPage();
        
        // Set up request interception
        const imageUrls = [];
        const capturedPaths = new Set();
        
        page.on('request', request => {
            const url = request.url();
            if (url.includes('viewerd.kbr.be') && url.includes('/display/') && 
                (url.includes('.jpg') || url.includes('.jpeg'))) {
                imageUrls.push(url);
                
                const pathMatch = url.match(/\/display\/([^\/]+\/[^\/]+\/[^\/]+\/[^\/]+\/[^\/]+\/[^\/]+\/[^\/]+\/[^\/]+\/[^\/]+)\//);
                if (pathMatch) {
                    capturedPaths.add(pathMatch[1]);
                }
            }
        });
        
        // Navigate to manuscript
        await page.goto(belgicaUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        
        await page.waitForTimeout(3000);
        
        // Get iframe URL
        const iframeUrl = await page.evaluate(() => {
            const iframe = document.querySelector('iframe');
            return iframe ? iframe.src : null;
        });
        
        if (!iframeUrl) {
            throw new Error('Could not find viewer iframe');
        }
        
        // Navigate to viewer
        await page.goto(iframeUrl, {
            waitUntil: 'networkidle',
            timeout: 30000
        });
        
        await page.waitForTimeout(5000);
        
        // Extract manuscript info
        const manuscriptPath = Array.from(capturedPaths)[0];
        if (!manuscriptPath) {
            throw new Error('Could not capture manuscript path');
        }
        
        let manuscriptId = 'unknown';
        const idMatch = imageUrls[0]?.match(/BE-KBR\d+_[^_]+/);
        if (idMatch) {
            manuscriptId = idMatch[0];
        }
        
        // Count total pages from gallery thumbnails
        const galleryCount = imageUrls.filter(url => url.includes('zoomgallery')).length;
        const totalPages = Math.min(galleryCount || 10, 10); // Limit to 10 pages for validation
        
        console.log(`Manuscript ID: ${manuscriptId}`);
        console.log(`Total pages to download: ${totalPages}`);
        
        // Get cookies
        const cookies = await page.context().cookies();
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        
        await browser.close();
        
        // Download pages
        const outputDir = path.join(__dirname, '../../.devkit/test-outputs/belgica-validation', outputName);
        await fs.mkdir(outputDir, { recursive: true });
        
        const downloadedFiles = [];
        
        for (let i = 1; i <= totalPages; i++) {
            const pageNum = String(i).padStart(4, '0');
            const pageUrl = `https://viewerd.kbr.be/display/${manuscriptPath}/zoomthumb/${manuscriptId}_0000-00-00_00_${pageNum}_600x400.jpg`;
            
            try {
                const response = await axios.get(pageUrl, {
                    headers: {
                        'Cookie': cookieString,
                        'Referer': 'https://belgica.kbr.be/',
                        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                        'Sec-Fetch-Dest': 'image',
                        'Sec-Fetch-Mode': 'no-cors',
                        'Sec-Fetch-Site': 'cross-site',
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                    },
                    responseType: 'arraybuffer',
                    timeout: 30000
                });
                
                const filename = `${outputName}_page_${pageNum}.jpg`;
                const filepath = path.join(outputDir, filename);
                await fs.writeFile(filepath, response.data);
                downloadedFiles.push(filename);
                
                console.log(`  Downloaded page ${i}/${totalPages} (${(response.data.length / 1024).toFixed(1)} KB)`);
            } catch (error) {
                console.error(`  Failed page ${i}: ${error.response?.status || error.message}`);
            }
        }
        
        return { outputDir, downloadedFiles, manuscriptId };
        
    } catch (error) {
        await browser.close();
        throw error;
    }
}

async function createPDF(outputDir, downloadedFiles, outputName) {
    console.log(`\nCreating PDF for ${outputName}...`);
    
    const doc = new PDFDocument({ autoFirstPage: false });
    const pdfPath = path.join(outputDir, `${outputName}.pdf`);
    doc.pipe(fs.createWriteStream(pdfPath));
    
    for (const file of downloadedFiles) {
        const imagePath = path.join(outputDir, file);
        
        try {
            const metadata = await sharp(imagePath).metadata();
            
            doc.addPage({
                size: [metadata.width, metadata.height]
            });
            
            doc.image(imagePath, 0, 0, {
                width: metadata.width,
                height: metadata.height
            });
            
            console.log(`  Added ${file} to PDF`);
        } catch (error) {
            console.error(`  Error processing ${file}:`, error.message);
        }
    }
    
    doc.end();
    console.log(`PDF created: ${pdfPath}`);
    
    return pdfPath;
}

async function validatePDF(pdfPath) {
    console.log(`\nValidating PDF with poppler...`);
    
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
        // Use pdfimages to extract image list
        const { stdout } = await execAsync(`pdfimages -list "${pdfPath}"`);
        console.log('PDF validation result:');
        console.log(stdout);
        
        // Count images
        const lines = stdout.split('\n');
        const imageLines = lines.filter(line => line.match(/^\s*\d+\s+\d+/));
        console.log(`\nTotal images in PDF: ${imageLines.length}`);
        
        return imageLines.length > 0;
    } catch (error) {
        console.error('PDF validation error:', error.message);
        return false;
    }
}

async function main() {
    console.log('Belgica KBR Validation Test');
    console.log('=' * 50);
    
    const manuscripts = [
        {
            url: 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415',
            name: 'Belgica_KBR_16994415'
        },
        {
            url: 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16073935',
            name: 'Belgica_KBR_16073935'
        },
        {
            url: 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/15949802',
            name: 'Belgica_KBR_15949802'
        }
    ];
    
    const validationDir = path.join(__dirname, '../../.devkit/test-outputs/belgica-validation');
    await fs.mkdir(validationDir, { recursive: true });
    
    const results = [];
    
    for (const manuscript of manuscripts) {
        try {
            // Download manuscript
            const { outputDir, downloadedFiles, manuscriptId } = await downloadBelgicaManuscript(
                manuscript.url, 
                manuscript.name
            );
            
            if (downloadedFiles.length > 0) {
                // Create PDF
                const pdfPath = await createPDF(outputDir, downloadedFiles, manuscript.name);
                
                // Validate PDF
                const isValid = await validatePDF(pdfPath);
                
                results.push({
                    name: manuscript.name,
                    url: manuscript.url,
                    manuscriptId,
                    pagesDownloaded: downloadedFiles.length,
                    pdfCreated: true,
                    pdfValid: isValid,
                    pdfPath
                });
            } else {
                results.push({
                    name: manuscript.name,
                    url: manuscript.url,
                    manuscriptId,
                    pagesDownloaded: 0,
                    pdfCreated: false,
                    pdfValid: false,
                    error: 'No pages downloaded'
                });
            }
            
        } catch (error) {
            results.push({
                name: manuscript.name,
                url: manuscript.url,
                error: error.message
            });
        }
    }
    
    // Summary report
    console.log('\n\nVALIDATION SUMMARY');
    console.log('=' * 50);
    
    results.forEach(result => {
        console.log(`\n${result.name}:`);
        console.log(`  URL: ${result.url}`);
        if (result.error) {
            console.log(`  Status: FAILED - ${result.error}`);
        } else {
            console.log(`  Manuscript ID: ${result.manuscriptId}`);
            console.log(`  Pages Downloaded: ${result.pagesDownloaded}`);
            console.log(`  PDF Created: ${result.pdfCreated ? 'YES' : 'NO'}`);
            console.log(`  PDF Valid: ${result.pdfValid ? 'YES' : 'NO'}`);
            if (result.pdfPath) {
                console.log(`  PDF Path: ${result.pdfPath}`);
            }
        }
    });
    
    // Save summary
    const summaryPath = path.join(validationDir, 'validation-summary.json');
    await fs.writeFile(summaryPath, JSON.stringify(results, null, 2));
    console.log(`\nSummary saved to: ${summaryPath}`);
}

main().catch(console.error);