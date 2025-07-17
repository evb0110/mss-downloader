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
                url.includes('.png') ||
                url.includes('/scale/')) {
                imageRequests.push(url);
            }
        });
        
        console.log('Navigating to Belgica KBR manuscript...');
        await page.goto('https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        
        console.log('Page loaded, waiting for content...');
        await page.waitForTimeout(10000);
        
        // Check for iframe
        const iframes = await page.locator('iframe').all();
        console.log(`Found ${iframes.length} iframes`);
        
        // Get iframe sources
        const iframeSources = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('iframe')).map(f => ({
                src: f.src,
                id: f.id,
                class: f.className,
                width: f.width,
                height: f.height
            }));
        });
        
        console.log('IFrame sources:', iframeSources);
        
        // Look for the viewer iframe
        for (const iframe of iframeSources) {
            if (iframe.src && iframe.src.includes('viewer')) {
                console.log('\nFound viewer iframe:', iframe.src);
                
                // Navigate directly to the iframe URL
                const viewerPage = await context.newPage();
                
                viewerPage.on('request', request => {
                    const url = request.url();
                    if (url.includes('tile') || 
                        url.includes('image') ||
                        url.includes('iiif') ||
                        url.includes('/scale/') ||
                        url.includes('.jpg')) {
                        console.log('Viewer image request:', url);
                    }
                });
                
                try {
                    await viewerPage.goto(iframe.src, {
                        waitUntil: 'domcontentloaded',
                        timeout: 30000
                    });
                    
                    await viewerPage.waitForTimeout(5000);
                    
                    const viewerData = await viewerPage.evaluate(() => {
                        return {
                            title: document.title,
                            hasOpenSeadragon: !!window.OpenSeadragon,
                            hasMirador: !!window.Mirador,
                            hasLeaflet: !!window.L,
                            scripts: Array.from(document.scripts).map(s => s.src).filter(Boolean)
                        };
                    });
                    
                    console.log('Viewer page data:', viewerData);
                    
                    // Look for API endpoints in scripts
                    const scriptContent = await viewerPage.evaluate(() => {
                        const scripts = Array.from(document.scripts);
                        const inlineScripts = scripts.filter(s => !s.src && s.textContent);
                        return inlineScripts.map(s => s.textContent.substring(0, 1000));
                    });
                    
                    console.log('\nChecking inline scripts for configuration...');
                    scriptContent.forEach((content, i) => {
                        if (content.includes('manifest') || content.includes('iiif') || content.includes('tile')) {
                            console.log(`Script ${i} contains relevant content:`, content.substring(0, 200));
                        }
                    });
                    
                } catch (error) {
                    console.error('Error loading viewer page:', error.message);
                }
            }
        }
        
        // Analyze collected requests
        const uniqueImagePatterns = [...new Set(imageRequests.map(url => {
            if (url.includes('tile')) return 'tile-based';
            if (url.includes('iiif')) return 'iiif';
            if (url.includes('/scale/')) return 'scale-based';
            if (url.includes('.jpg')) return 'static-jpg';
            if (url.includes('.png')) return 'static-png';
            return 'other';
        }))];
        
        console.log('\nImage request patterns:', uniqueImagePatterns);
        console.log('\nSample image URLs:');
        imageRequests.slice(0, 10).forEach(url => console.log('-', url));
        
        // Save analysis
        const report = {
            url: 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415',
            timestamp: new Date().toISOString(),
            iframes: iframeSources,
            totalRequests: requests.length,
            imageRequests: imageRequests.length,
            uniqueImagePatterns,
            sampleImageUrls: imageRequests.slice(0, 20)
        };
        
        await fs.writeFile(
            path.join(__dirname, '../../.devkit/reports/belgica-kbr-analysis.json'),
            JSON.stringify(report, null, 2)
        );
        
        console.log('\nAnalysis saved. Press Ctrl+C to close browser...');
        await new Promise(() => {});
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

analyzeBelgicaKBR();