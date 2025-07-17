const { chromium } = require('playwright');
const https = require('https');
const http = require('http');
const { URL } = require('url');

async function followRedirects(startUrl) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(startUrl);
        const client = parsedUrl.protocol === 'https:' ? https : http;
        
        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        };
        
        client.get(options, (response) => {
            console.log(`Status: ${response.statusCode}`);
            console.log(`Location: ${response.headers.location}`);
            
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                resolve(response.headers.location);
            } else {
                resolve(null);
            }
        }).on('error', reject);
    });
}

async function analyzeBelgicaFlow() {
    // First check the redirect
    console.log('Checking redirect from https://uurl.kbr.be/1558106...');
    const redirectUrl = await followRedirects('https://uurl.kbr.be/1558106');
    console.log('Redirects to:', redirectUrl);
    
    const browser = await chromium.launch({ 
        headless: false,
        devtools: true
    });
    
    try {
        const context = await browser.newContext();
        
        // First, load the main page to see what happens
        const mainPage = await context.newPage();
        
        const requests = [];
        mainPage.on('request', request => {
            const url = request.url();
            if (url.includes('viewerd.kbr.be') || 
                url.includes('zoomify') || 
                url.includes('manifest') ||
                url.includes('tiles')) {
                requests.push({
                    url,
                    method: request.method(),
                    resourceType: request.resourceType()
                });
                console.log(`Request: ${request.method()} ${url}`);
            }
        });
        
        console.log('\nLoading main manuscript page...');
        await mainPage.goto('https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415', {
            waitUntil: 'domcontentloaded'
        });
        
        await mainPage.waitForTimeout(5000);
        
        // Check iframe again
        const iframeData = await mainPage.evaluate(() => {
            const iframe = document.querySelector('iframe');
            if (iframe) {
                return {
                    src: iframe.src,
                    content: iframe.contentDocument ? 'accessible' : 'cross-origin'
                };
            }
            return null;
        });
        
        console.log('Iframe data:', iframeData);
        
        // Now let's follow the actual viewer URL if we have the redirect
        if (redirectUrl || iframeData?.src) {
            const viewerUrl = redirectUrl || iframeData.src;
            console.log('\nOpening viewer directly:', viewerUrl);
            
            const viewerPage = await context.newPage();
            
            const tileRequests = [];
            viewerPage.on('request', request => {
                const url = request.url();
                if (url.includes('tile') || url.includes('zoomify') || url.includes('/TileGroup')) {
                    tileRequests.push(url);
                    console.log('Tile:', url);
                }
            });
            
            await viewerPage.goto(viewerUrl, {
                waitUntil: 'networkidle'
            });
            
            await viewerPage.waitForTimeout(5000);
            
            // Analyze the viewer page
            const viewerData = await viewerPage.evaluate(() => {
                const data = {
                    title: document.title,
                    url: window.location.href,
                    hasFlash: !!document.querySelector('embed[type*="flash"]'),
                    hasObject: !!document.querySelector('object'),
                    hasCanvas: !!document.querySelector('canvas'),
                    scripts: Array.from(document.scripts).map(s => s.src).filter(Boolean)
                };
                
                // Look for Zoomify elements
                const zoomifyElements = document.querySelectorAll('[id*="zoomify"], [class*="zoomify"], [id*="Zoomify"], [class*="Zoomify"]');
                data.zoomifyElements = zoomifyElements.length;
                
                // Check for AJAX Zoom
                if (window.jQuery && window.jQuery.axZm) {
                    data.ajaxZoom = {
                        present: true,
                        version: window.jQuery.axZm.version
                    };
                }
                
                return data;
            });
            
            console.log('\nViewer page analysis:', JSON.stringify(viewerData, null, 2));
            
            // Try to extract configuration from page source
            const pageSource = await viewerPage.content();
            
            // Look for Zoomify paths
            const zoomifyMatch = pageSource.match(/zPath["\s]*[:=]["\s]*["']([^"']+)["']/);
            if (zoomifyMatch) {
                console.log('Found Zoomify path:', zoomifyMatch[1]);
            }
            
            // Look for tile patterns
            const tileMatches = pageSource.match(/TileGroup\d+\/\d+-\d+-\d+\.jpg/g);
            if (tileMatches) {
                console.log('Found tile patterns:', tileMatches.slice(0, 3));
            }
            
            console.log('\nTotal tile requests captured:', tileRequests.length);
        }
        
        console.log('\nPress Ctrl+C to close browser...');
        await new Promise(() => {});
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

analyzeBelgicaFlow();