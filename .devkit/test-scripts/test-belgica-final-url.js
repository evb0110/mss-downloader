const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

async function findBelgicaFinalUrl() {
    const browser = await chromium.launch({ 
        headless: false,
        devtools: true
    });
    
    try {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        // Track all navigation
        const navigationLog = [];
        
        page.on('framenavigated', frame => {
            console.log('Frame navigated to:', frame.url());
            navigationLog.push({ type: 'frame', url: frame.url() });
        });
        
        page.on('response', response => {
            if (response.status() >= 300 && response.status() < 400) {
                console.log('Redirect:', response.url(), '->', response.headers()['location']);
            }
        });
        
        console.log('Loading redirect URL...');
        await page.goto('https://uurl.kbr.be/1558106', {
            waitUntil: 'networkidle'
        });
        
        await page.waitForTimeout(5000);
        
        const finalUrl = page.url();
        console.log('Final URL:', finalUrl);
        
        // Check if we're on viewerd.kbr.be
        if (finalUrl.includes('viewerd.kbr.be')) {
            console.log('\nNow on viewer domain. Analyzing...');
            
            // Extract viewer configuration
            const viewerConfig = await page.evaluate(() => {
                const config = {
                    url: window.location.href,
                    ajaxZoom: {
                        present: !!(window.jQuery && window.jQuery.axZm),
                        version: window.jQuery?.axZm?.version,
                        zoomDir: window.jQuery?.axZm?.zoomDir,
                        randNumber: window.jQuery?.axZm?.randNumber
                    },
                    globalVars: {}
                };
                
                // Look for configuration variables
                for (const key in window) {
                    if (key.includes('zoom') || key.includes('Zoom') || key.includes('axZm')) {
                        config.globalVars[key] = typeof window[key];
                    }
                }
                
                return config;
            });
            
            console.log('Viewer config:', JSON.stringify(viewerConfig, null, 2));
            
            // Look for image URLs in network requests
            const imageRequests = [];
            page.on('request', request => {
                const url = request.url();
                if (url.includes('/display/') && (url.includes('.jpg') || url.includes('.png'))) {
                    imageRequests.push(url);
                    console.log('Image request:', url);
                }
            });
            
            // Trigger some activity
            await page.mouse.move(500, 300);
            await page.mouse.wheel(0, 100);
            await page.waitForTimeout(3000);
            
            // Try to extract the manuscript ID from the URL
            const urlMatch = finalUrl.match(/map=([^&]+)/);
            const manuscriptPath = urlMatch ? urlMatch[1] : null;
            console.log('Manuscript path:', manuscriptPath);
            
            // Try to download an actual page image
            if (manuscriptPath) {
                const testUrls = [
                    `https://viewerd.kbr.be/display/${manuscriptPath}zoomthumb/BE-KBR00_A-1589485_0000-00-00_00_0001_600x400.jpg`,
                    `https://viewerd.kbr.be/display/${manuscriptPath}zoom/BE-KBR00_A-1589485_0000-00-00_00_0001.jpg`,
                    `https://viewerd.kbr.be/display/${manuscriptPath}BE-KBR00_A-1589485_0000-00-00_00_0001.jpg`
                ];
                
                console.log('\nTrying to download test images...');
                for (const url of testUrls) {
                    try {
                        const response = await page.evaluate(async (url) => {
                            try {
                                const resp = await fetch(url);
                                return {
                                    status: resp.status,
                                    ok: resp.ok,
                                    contentType: resp.headers.get('content-type')
                                };
                            } catch (e) {
                                return { error: e.message };
                            }
                        }, url);
                        console.log(`${url}:`, response);
                    } catch (e) {
                        console.log(`${url}: Error -`, e.message);
                    }
                }
            }
            
            // Save analysis
            await fs.writeFile(
                path.join(__dirname, '../../.devkit/reports/belgica-final-url-analysis.json'),
                JSON.stringify({
                    originalUrl: 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415',
                    redirectUrl: 'https://uurl.kbr.be/1558106',
                    finalUrl,
                    manuscriptPath,
                    viewerConfig,
                    imageRequests,
                    navigationLog
                }, null, 2)
            );
        }
        
        console.log('\nPress Ctrl+C to close browser...');
        await new Promise(() => {});
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

findBelgicaFinalUrl().catch(console.error);