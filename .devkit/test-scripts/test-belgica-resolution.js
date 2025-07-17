const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

async function testBelgicaResolution() {
    console.log('Testing Belgica KBR for maximum resolution...\n');
    
    const belgicaUrl = 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415';
    
    const browser = await chromium.launch({ 
        headless: false,
        devtools: true
    });
    
    try {
        const page = await browser.newPage();
        
        // Capture all image requests
        const allImageRequests = [];
        
        page.on('request', request => {
            const url = request.url();
            if (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png')) {
                allImageRequests.push(url);
            }
        });
        
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
            throw new Error('Could not find viewer iframe');
        }
        
        console.log('Found viewer iframe:', iframeUrl);
        
        // Navigate to the viewer
        await page.goto(iframeUrl, {
            waitUntil: 'networkidle',
            timeout: 30000
        });
        
        await page.waitForTimeout(5000);
        
        // Zoom in to trigger high-resolution tile loading
        console.log('\nTriggering zoom to load high-resolution tiles...');
        
        // Try to find and click zoom in button
        const zoomInSelectors = [
            '[class*="zoomIn"]',
            '[id*="zoomIn"]',
            '[title*="Zoom in"]',
            '[aria-label*="Zoom in"]',
            'button:has-text("+")',
            '.axZm_zoomIn'
        ];
        
        for (const selector of zoomInSelectors) {
            try {
                await page.click(selector);
                console.log('Clicked zoom in button');
                await page.waitForTimeout(2000);
                break;
            } catch (e) {
                // Continue to next selector
            }
        }
        
        // Also try mouse wheel zoom
        await page.mouse.move(640, 400);
        await page.mouse.wheel(0, -500);
        await page.waitForTimeout(2000);
        
        // Analyze all captured image URLs
        console.log(`\nCaptured ${allImageRequests.length} image requests`);
        
        // Group by resolution patterns
        const resolutionGroups = {};
        
        allImageRequests.forEach(url => {
            if (url.includes('viewerd.kbr.be')) {
                // Extract resolution info
                let category = 'unknown';
                let size = 'unknown';
                
                if (url.includes('zoomthumb')) category = 'zoomthumb';
                else if (url.includes('zoomgallery')) category = 'zoomgallery';
                else if (url.includes('zoommap')) category = 'zoommap';
                else if (url.includes('zoom/')) category = 'zoom';
                else if (url.includes('zoomtiles')) category = 'zoomtiles';
                else if (url.includes('/tiles/')) category = 'tiles';
                
                // Extract size info
                const sizeMatch = url.match(/_(\d+x\d+)\./);
                if (sizeMatch) size = sizeMatch[1];
                
                const key = `${category}_${size}`;
                if (!resolutionGroups[key]) {
                    resolutionGroups[key] = {
                        category,
                        size,
                        count: 0,
                        samples: []
                    };
                }
                
                resolutionGroups[key].count++;
                if (resolutionGroups[key].samples.length < 3) {
                    resolutionGroups[key].samples.push(url);
                }
            }
        });
        
        console.log('\nResolution analysis:');
        Object.entries(resolutionGroups).forEach(([key, data]) => {
            console.log(`\n${key}: ${data.count} requests`);
            data.samples.forEach(url => console.log(`  - ${url}`));
        });
        
        // Test different resolution patterns
        console.log('\n\nTesting various resolution patterns...');
        
        const manuscriptPath = 'A/1/5/8/9/4/8/5/0000-00-00_00';
        const manuscriptId = 'BE-KBR00_A-1589485_0000-00-00_00';
        const pageNum = '0001';
        
        const resolutionTests = [
            // Standard patterns
            { url: `https://viewerd.kbr.be/display/${manuscriptPath}/zoomthumb/${manuscriptId}_${pageNum}_600x400.jpg`, name: 'zoomthumb 600x400' },
            { url: `https://viewerd.kbr.be/display/${manuscriptPath}/zoomthumb/${manuscriptId}_${pageNum}_1200x800.jpg`, name: 'zoomthumb 1200x800' },
            { url: `https://viewerd.kbr.be/display/${manuscriptPath}/zoomthumb/${manuscriptId}_${pageNum}_2400x1600.jpg`, name: 'zoomthumb 2400x1600' },
            
            // Without size suffix
            { url: `https://viewerd.kbr.be/display/${manuscriptPath}/zoom/${manuscriptId}_${pageNum}.jpg`, name: 'zoom (no size)' },
            { url: `https://viewerd.kbr.be/display/${manuscriptPath}/zoomoriginal/${manuscriptId}_${pageNum}.jpg`, name: 'zoomoriginal' },
            { url: `https://viewerd.kbr.be/display/${manuscriptPath}/zoommax/${manuscriptId}_${pageNum}.jpg`, name: 'zoommax' },
            { url: `https://viewerd.kbr.be/display/${manuscriptPath}/zoomfull/${manuscriptId}_${pageNum}.jpg`, name: 'zoomfull' },
            
            // Tile patterns (if exists)
            { url: `https://viewerd.kbr.be/display/${manuscriptPath}/zoomtiles/${manuscriptId}_${pageNum}/0/0/0.jpg`, name: 'zoomtiles level 0' },
            { url: `https://viewerd.kbr.be/display/${manuscriptPath}/tiles/${manuscriptId}_${pageNum}/0/0/0.jpg`, name: 'tiles level 0' }
        ];
        
        const cookies = await page.context().cookies();
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        
        const outputDir = path.join(__dirname, '../../.devkit/test-outputs/belgica-resolution');
        await fs.mkdir(outputDir, { recursive: true });
        
        for (const test of resolutionTests) {
            try {
                console.log(`\nTesting ${test.name}...`);
                const response = await axios.head(test.url, {
                    headers: {
                        'Cookie': cookieString,
                        'Referer': 'https://belgica.kbr.be/',
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                    },
                    validateStatus: () => true,
                    timeout: 10000
                });
                
                console.log(`  Status: ${response.status}`);
                if (response.status === 200) {
                    console.log(`  Content-Length: ${response.headers['content-length'] || 'unknown'}`);
                    console.log(`  Content-Type: ${response.headers['content-type'] || 'unknown'}`);
                    
                    // Download successful ones
                    const imageResponse = await axios.get(test.url, {
                        headers: {
                            'Cookie': cookieString,
                            'Referer': 'https://belgica.kbr.be/',
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                        },
                        responseType: 'arraybuffer'
                    });
                    
                    const filename = `test_${test.name.replace(/[^a-z0-9]/gi, '_')}.jpg`;
                    await fs.writeFile(path.join(outputDir, filename), imageResponse.data);
                    console.log(`  ✓ Downloaded: ${filename} (${(imageResponse.data.length / 1024).toFixed(1)} KB)`);
                }
            } catch (error) {
                console.log(`  Error: ${error.message}`);
            }
        }
        
        console.log('\n\nPress Ctrl+C to close browser...');
        await new Promise(() => {});
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await browser.close();
    }
}

testBelgicaResolution().catch(console.error);