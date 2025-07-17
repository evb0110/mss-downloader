const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

async function testBelgicaAjaxZoom() {
    const browser = await chromium.launch({ 
        headless: false,
        devtools: true
    });
    
    try {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        console.log('Loading Belgica KBR manuscript...');
        await page.goto('https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415', {
            waitUntil: 'domcontentloaded'
        });
        
        await page.waitForTimeout(5000);
        
        // Get iframe URL
        const iframeUrl = await page.evaluate(() => {
            const iframe = document.querySelector('iframe');
            return iframe ? iframe.src : null;
        });
        
        console.log('Iframe URL:', iframeUrl);
        
        if (!iframeUrl) {
            throw new Error('No iframe found');
        }
        
        // Navigate directly to the iframe URL which should redirect to viewerd.kbr.be
        const viewerPage = await context.newPage();
        
        // Capture all requests
        const capturedRequests = [];
        const imageUrls = [];
        
        viewerPage.on('request', request => {
            const url = request.url();
            capturedRequests.push(url);
            
            if (url.includes('.jpg') && url.includes('display/')) {
                imageUrls.push(url);
                console.log('Image URL:', url);
            }
        });
        
        console.log('\nNavigating to viewer...');
        await viewerPage.goto(iframeUrl, {
            waitUntil: 'networkidle'
        });
        
        await viewerPage.waitForTimeout(5000);
        
        const finalUrl = viewerPage.url();
        console.log('Final viewer URL:', finalUrl);
        
        // Extract AJAX Zoom configuration
        const axZmConfig = await viewerPage.evaluate(() => {
            if (!window.jQuery || !window.jQuery.axZm) {
                return { error: 'AJAX Zoom not found' };
            }
            
            const config = {
                version: window.jQuery.axZm.version,
                zoomDir: window.jQuery.axZm.zoomDir,
                randNumber: window.jQuery.axZm.randNumber,
                currentImage: window.jQuery.axZm.currentImg,
                totalImages: window.jQuery.axZm.numImages,
                imagePath: window.jQuery.axZm.imgSrc,
                fullPath: window.jQuery.axZm.fullPath
            };
            
            // Try to get image list
            if (window.jQuery.axZm.zoomGA) {
                config.imageList = Object.keys(window.jQuery.axZm.zoomGA);
            }
            
            return config;
        });
        
        console.log('\nAJAX Zoom config:', JSON.stringify(axZmConfig, null, 2));
        
        // Try to get the actual image URL from AJAX Zoom
        const imageData = await viewerPage.evaluate(() => {
            if (!window.jQuery || !window.jQuery.axZm) return null;
            
            // Try different methods to get the image URL
            const methods = {
                imgSrc: window.jQuery.axZm.imgSrc,
                fullPath: window.jQuery.axZm.fullPath,
                currentImgSrc: window.jQuery.axZm.currentImgSrc,
                zoomData: window.jQuery.axZm.zoomData
            };
            
            // Try to trigger image loading
            if (window.jQuery.fn.axZm && window.jQuery.fn.axZm.getCurrentImage) {
                methods.getCurrentImage = window.jQuery.fn.axZm.getCurrentImage();
            }
            
            return methods;
        });
        
        console.log('\nImage data methods:', imageData);
        
        // Download test images with proper cookies and headers
        const cookies = await viewerPage.context().cookies();
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        
        const outputDir = path.join(__dirname, '../../.devkit/test-outputs/belgica-ajax-zoom');
        await fs.mkdir(outputDir, { recursive: true });
        
        // Test different URL patterns based on captured requests
        if (imageUrls.length > 0) {
            console.log(`\nFound ${imageUrls.length} image URLs. Testing download...`);
            
            for (let i = 0; i < Math.min(5, imageUrls.length); i++) {
                const url = imageUrls[i];
                try {
                    const response = await axios.get(url, {
                        headers: {
                            'Cookie': cookieString,
                            'Referer': finalUrl,
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                        },
                        responseType: 'arraybuffer'
                    });
                    
                    const filename = `test_${i + 1}.jpg`;
                    await fs.writeFile(path.join(outputDir, filename), response.data);
                    console.log(`Downloaded: ${filename} (${response.data.length} bytes)`);
                } catch (error) {
                    console.log(`Failed to download ${url}: ${error.response?.status || error.message}`);
                }
            }
        }
        
        // Try to navigate pages and capture more URLs
        console.log('\nTrying to navigate pages...');
        
        const navResult = await viewerPage.evaluate(() => {
            if (window.jQuery && window.jQuery.fn.axZm) {
                // Try to go to next page
                if (window.jQuery.fn.axZm.zoomSwitch) {
                    window.jQuery.fn.axZm.zoomSwitch(2);
                    return 'Switched to page 2';
                }
                if (window.jQuery.fn.axZm.next) {
                    window.jQuery.fn.axZm.next();
                    return 'Called next()';
                }
            }
            return 'Navigation methods not found';
        });
        
        console.log('Navigation result:', navResult);
        await viewerPage.waitForTimeout(3000);
        
        // Extract manuscript path pattern
        const manuscriptPath = finalUrl.match(/map=([^&]+)/)?.[1];
        
        // Save comprehensive analysis
        const analysis = {
            originalUrl: 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415',
            iframeUrl,
            finalUrl,
            manuscriptPath,
            axZmConfig,
            imageData,
            capturedImageUrls: imageUrls,
            totalRequests: capturedRequests.length,
            downloadSuccess: imageUrls.length > 0
        };
        
        await fs.writeFile(
            path.join(__dirname, '../../.devkit/reports/belgica-ajax-zoom-analysis.json'),
            JSON.stringify(analysis, null, 2)
        );
        
        console.log('\nAnalysis saved. Check .devkit/test-outputs/belgica-ajax-zoom/ for any downloaded images.');
        console.log('Press Ctrl+C to close browser...');
        
        await new Promise(() => {});
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

testBelgicaAjaxZoom().catch(console.error);