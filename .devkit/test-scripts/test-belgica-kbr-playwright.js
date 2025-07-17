const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

async function analyzeBelgicaKBR() {
    const browser = await chromium.launch({ 
        headless: false,
        devtools: true
    });
    
    try {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        const requests = [];
        const imageRequests = [];
        
        page.on('request', request => {
            const url = request.url();
            requests.push({
                url,
                method: request.method(),
                resourceType: request.resourceType()
            });
            
            if (request.resourceType() === 'image' || 
                url.includes('tile') || 
                url.includes('image') ||
                url.includes('iiif') ||
                url.includes('.jpg') ||
                url.includes('.png')) {
                imageRequests.push(url);
            }
        });
        
        page.on('console', msg => {
            console.log('Console:', msg.text());
        });
        
        console.log('Navigating to Belgica KBR manuscript...');
        await page.goto('https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415', {
            waitUntil: 'networkidle',
            timeout: 60000
        });
        
        console.log('Page loaded, waiting for viewer...');
        await page.waitForTimeout(5000);
        
        // Check for iframe
        const iframes = await page.locator('iframe').all();
        console.log(`Found ${iframes.length} iframes`);
        
        // Try to find viewer elements
        const viewerSelectors = [
            '#viewer',
            '.viewer',
            '#book-viewer',
            '.book-viewer',
            '#manuscript-viewer',
            '.manuscript-viewer',
            '[data-viewer]',
            '.openseadragon-container',
            '#openseadragon',
            '.leaflet-container',
            '#map',
            '.mirador-viewer',
            '#mirador'
        ];
        
        for (const selector of viewerSelectors) {
            const element = await page.locator(selector).first();
            if (await element.count() > 0) {
                console.log(`Found viewer element: ${selector}`);
                const box = await element.boundingBox();
                console.log('Viewer dimensions:', box);
            }
        }
        
        // Extract page data
        const pageData = await page.evaluate(() => {
            const data = {
                title: document.title,
                scripts: Array.from(document.scripts).map(s => s.src).filter(Boolean),
                iframes: Array.from(document.querySelectorAll('iframe')).map(f => ({
                    src: f.src,
                    id: f.id,
                    class: f.className
                })),
                globalVars: Object.keys(window).filter(k => !k.match(/^(webkit|moz|ms|o)[A-Z]/)),
                metadata: {}
            };
            
            // Check for OpenSeadragon
            if (window.OpenSeadragon) {
                data.hasOpenSeadragon = true;
            }
            
            // Check for Mirador
            if (window.Mirador) {
                data.hasMirador = true;
            }
            
            // Check for any viewer configuration
            for (const key of Object.keys(window)) {
                if (key.toLowerCase().includes('viewer') || 
                    key.toLowerCase().includes('manifest') ||
                    key.toLowerCase().includes('iiif')) {
                    data.metadata[key] = typeof window[key];
                }
            }
            
            return data;
        });
        
        console.log('\nPage analysis:');
        console.log('Title:', pageData.title);
        console.log('Scripts:', pageData.scripts.length);
        console.log('IFrames:', pageData.iframes);
        console.log('Has OpenSeadragon:', pageData.hasOpenSeadragon);
        console.log('Has Mirador:', pageData.hasMirador);
        console.log('Viewer-related globals:', pageData.metadata);
        
        // If there's an iframe, analyze it
        if (pageData.iframes.length > 0) {
            for (let i = 0; i < pageData.iframes.length; i++) {
                const iframe = pageData.iframes[i];
                console.log(`\nAnalyzing iframe ${i + 1}:`, iframe.src);
                
                if (iframe.src) {
                    const frame = page.frameLocator(`iframe[src="${iframe.src}"]`);
                    
                    try {
                        // Try to extract data from iframe
                        const frameExists = await frame.locator('body').count() > 0;
                        if (frameExists) {
                            console.log('Successfully accessed iframe content');
                            
                            // Look for viewer elements in iframe
                            for (const selector of viewerSelectors) {
                                const count = await frame.locator(selector).count();
                                if (count > 0) {
                                    console.log(`Found in iframe: ${selector}`);
                                }
                            }
                        }
                    } catch (e) {
                        console.log('Could not access iframe content (cross-origin)');
                    }
                }
            }
        }
        
        // Try to intercept API calls
        const apiCalls = requests.filter(r => 
            r.url.includes('api') || 
            r.url.includes('manifest') ||
            r.url.includes('info.json') ||
            r.url.includes('iiif')
        );
        
        console.log('\nAPI calls found:', apiCalls.length);
        apiCalls.forEach(call => console.log('-', call.url));
        
        // Save network analysis
        const report = {
            url: 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415',
            timestamp: new Date().toISOString(),
            pageData,
            totalRequests: requests.length,
            imageRequests: imageRequests.length,
            uniqueImagePatterns: [...new Set(imageRequests.map(url => {
                if (url.includes('tile')) return 'tile-based';
                if (url.includes('iiif')) return 'iiif';
                if (url.includes('.jpg')) return 'static-jpg';
                if (url.includes('.png')) return 'static-png';
                return 'other';
            }))],
            sampleImageUrls: imageRequests.slice(0, 10),
            apiCalls: apiCalls
        };
        
        await fs.writeFile(
            path.join(__dirname, '../../.devkit/reports/belgica-kbr-analysis.json'),
            JSON.stringify(report, null, 2)
        );
        
        console.log('\nImage request patterns:', report.uniqueImagePatterns);
        console.log('\nSample image URLs:');
        report.sampleImageUrls.forEach(url => console.log('-', url));
        
        // Try to navigate pages
        console.log('\nLooking for navigation controls...');
        const navSelectors = [
            'button[aria-label*="next"]',
            'button[aria-label*="Next"]',
            '.next-page',
            '.navigation-next',
            '[data-action="next"]',
            'button:has-text("Next")',
            'a:has-text("Next")'
        ];
        
        for (const selector of navSelectors) {
            const navButton = await page.locator(selector).first();
            if (await navButton.count() > 0) {
                console.log(`Found navigation button: ${selector}`);
                try {
                    await navButton.click();
                    await page.waitForTimeout(2000);
                    console.log('Clicked next page button');
                } catch (e) {
                    console.log('Could not click navigation button');
                }
                break;
            }
        }
        
        console.log('\nPress Ctrl+C to close the browser when done inspecting...');
        await new Promise(() => {}); // Keep browser open
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

analyzeBelgicaKBR();