const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

async function testBelgicaDirect() {
    console.log('Testing Belgica KBR direct implementation...\n');
    
    const testUrls = [
        'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415',
        'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16073935',
        'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/15949802'
    ];
    
    for (const belgicaUrl of testUrls) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Testing: ${belgicaUrl}`);
        console.log('='.repeat(60));
        
        const browser = await chromium.launch({ headless: true });
        
        try {
            const page = await browser.newPage();
            
            // Set up request interception to capture image URLs
            const imageUrls = [];
            const capturedPaths = new Set();
            
            page.on('request', request => {
                const url = request.url();
                if (url.includes('viewerd.kbr.be') && url.includes('/display/') && 
                    (url.includes('.jpg') || url.includes('.jpeg'))) {
                    imageUrls.push(url);
                    
                    // Extract manuscript path
                    const pathMatch = url.match(/\/display\/([^\/]+\/[^\/]+\/[^\/]+\/[^\/]+\/[^\/]+\/[^\/]+\/[^\/]+\/[^\/]+\/[^\/]+)\//);
                    if (pathMatch) {
                        capturedPaths.add(pathMatch[1]);
                    }
                }
            });
            
            // Navigate to the manuscript page
            console.log('Loading manuscript page...');
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
                console.error('Could not find viewer iframe');
                continue;
            }
            
            console.log('Found viewer iframe:', iframeUrl);
            
            // Navigate to the viewer
            await page.goto(iframeUrl, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            
            await page.waitForTimeout(5000);
            
            // Extract manuscript information from the captured URLs
            if (capturedPaths.size === 0) {
                console.error('Could not capture manuscript path from network requests');
                continue;
            }
            
            const manuscriptPath = Array.from(capturedPaths)[0];
            console.log('Manuscript path:', manuscriptPath);
            
            // Extract manuscript ID from captured URLs
            let manuscriptId = 'unknown';
            const idMatch = imageUrls[0]?.match(/BE-KBR\d+_[^_]+/);
            if (idMatch) {
                manuscriptId = idMatch[0];
            }
            console.log('Manuscript ID:', manuscriptId);
            
            // Analyze captured URLs to find available resolutions
            const resolutions = new Map();
            
            imageUrls.forEach(url => {
                if (url.includes('zoomthumb') && url.includes('_600x400')) {
                    resolutions.set('zoomthumb_600x400', { width: 600, height: 400, count: (resolutions.get('zoomthumb_600x400')?.count || 0) + 1 });
                } else if (url.includes('zoomgallery') && url.includes('_70x70')) {
                    resolutions.set('zoomgallery_70x70', { width: 70, height: 70, count: (resolutions.get('zoomgallery_70x70')?.count || 0) + 1 });
                } else if (url.includes('zoommap') && url.includes('_200x200')) {
                    resolutions.set('zoommap_200x200', { width: 200, height: 200, count: (resolutions.get('zoommap_200x200')?.count || 0) + 1 });
                }
            });
            
            console.log('Available resolutions:', Array.from(resolutions.entries()));
            
            // Determine best resolution (prefer zoomthumb)
            let selectedResolution = 'zoomthumb';
            let suffix = '_600x400';
            
            // Extract total pages from gallery thumbnails count
            const galleryCount = resolutions.get('zoomgallery_70x70')?.count || 0;
            const totalPages = galleryCount > 0 ? galleryCount : 100;
            
            console.log(`Detected ${totalPages} pages in manuscript`);
            
            // Get cookies for authenticated requests
            const cookies = await page.context().cookies();
            const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
            
            // Test downloading some pages
            const outputDir = path.join(__dirname, '../../.devkit/test-outputs/belgica-direct', path.basename(belgicaUrl));
            await fs.mkdir(outputDir, { recursive: true });
            
            console.log('\nTesting page downloads...');
            let successCount = 0;
            const testPages = Math.min(10, totalPages);
            
            for (let i = 1; i <= testPages; i++) {
                const pageNum = String(i).padStart(4, '0');
                const pageUrl = `https://viewerd.kbr.be/display/${manuscriptPath}/${selectedResolution}/${manuscriptId}_0000-00-00_00_${pageNum}${suffix}.jpg`;
                
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
                    
                    const filename = path.join(outputDir, `page_${pageNum}.jpg`);
                    await fs.writeFile(filename, response.data);
                    
                    successCount++;
                    console.log(`  ✓ Page ${i} downloaded (${(response.data.length / 1024).toFixed(1)} KB)`);
                } catch (error) {
                    console.error(`  ✗ Page ${i} failed: ${error.response?.status || error.message}`);
                }
            }
            
            console.log(`\nDownload success rate: ${successCount}/${testPages} (${(successCount/testPages*100).toFixed(1)}%)`);
            
            // Create a test PDF if downloads succeeded
            if (successCount > 0) {
                console.log('\nCreating test PDF...');
                const PDFDocument = require('pdfkit');
                const sharp = require('sharp');
                
                const doc = new PDFDocument({ autoFirstPage: false });
                const pdfPath = path.join(outputDir, 'test.pdf');
                doc.pipe(fs.createWriteStream(pdfPath));
                
                const files = await fs.readdir(outputDir);
                const imageFiles = files.filter(f => f.startsWith('page_') && f.endsWith('.jpg')).sort();
                
                for (const file of imageFiles) {
                    const imagePath = path.join(outputDir, file);
                    const metadata = await sharp(imagePath).metadata();
                    
                    doc.addPage({
                        size: [metadata.width, metadata.height]
                    });
                    
                    doc.image(imagePath, 0, 0, {
                        width: metadata.width,
                        height: metadata.height
                    });
                }
                
                doc.end();
                console.log(`PDF created: ${pdfPath}`);
            }
            
        } catch (error) {
            console.error('Error:', error.message);
        } finally {
            await browser.close();
        }
    }
    
    console.log('\n\nAll tests complete!');
}

testBelgicaDirect().catch(console.error);