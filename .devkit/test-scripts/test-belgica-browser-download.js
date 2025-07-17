const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

async function downloadBelgicaManuscript() {
    const browser = await chromium.launch({ 
        headless: true 
    });
    
    try {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        console.log('Loading Belgica KBR manuscript viewer...');
        
        // First load the main page
        await page.goto('https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415', {
            waitUntil: 'domcontentloaded'
        });
        
        await page.waitForTimeout(3000);
        
        // Get the iframe URL
        const iframeUrl = await page.evaluate(() => {
            const iframe = document.querySelector('iframe');
            return iframe ? iframe.src : null;
        });
        
        if (!iframeUrl) {
            throw new Error('Could not find viewer iframe');
        }
        
        console.log('Found viewer URL:', iframeUrl);
        
        // Navigate to the viewer directly
        await page.goto(iframeUrl, {
            waitUntil: 'networkidle'
        });
        
        await page.waitForTimeout(5000);
        
        // Get cookies and headers
        const cookies = await context.cookies();
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        
        console.log('Got session cookies:', cookies.length);
        
        // Extract the session ID from the page
        const sessionData = await page.evaluate(() => {
            // Look for AJAX Zoom session
            if (window.jQuery && window.jQuery.axZm) {
                return {
                    session: window.jQuery.axZm.randNumber,
                    zoomDir: window.jQuery.axZm.zoomDir
                };
            }
            return null;
        });
        
        console.log('Session data:', sessionData);
        
        // Try to download images with session
        const outputDir = path.join(__dirname, '../../.devkit/test-outputs/belgica-browser');
        await fs.mkdir(outputDir, { recursive: true });
        
        // Test downloading thumbnails from browser context
        const downloadedUrls = [];
        
        page.on('response', async response => {
            const url = response.url();
            if (url.includes('zoomthumb') && url.endsWith('.jpg')) {
                downloadedUrls.push(url);
                try {
                    const buffer = await response.body();
                    const filename = path.basename(url);
                    await fs.writeFile(path.join(outputDir, filename), buffer);
                    console.log('Downloaded:', filename);
                } catch (e) {
                    console.log('Failed to save:', url);
                }
            }
        });
        
        // Trigger thumbnail loading by clicking through pages
        console.log('Navigating through pages to capture images...');
        
        // Look for navigation buttons
        const hasNavigation = await page.evaluate(() => {
            return !!(document.querySelector('.axZm_zoomNaviNext') || 
                     document.querySelector('#axZm_zoomNaviNext') ||
                     document.querySelector('[onclick*="next"]'));
        });
        
        if (hasNavigation) {
            console.log('Found navigation controls');
            
            // Click through first 10 pages
            for (let i = 0; i < 10; i++) {
                try {
                    await page.click('.axZm_zoomNaviNext, #axZm_zoomNaviNext, [onclick*="next"]');
                    await page.waitForTimeout(2000);
                    console.log(`Navigated to page ${i + 2}`);
                } catch (e) {
                    console.log('Navigation failed:', e.message);
                    break;
                }
            }
        }
        
        // Try to find high-resolution download links
        console.log('\nLooking for download functionality...');
        
        const downloadInfo = await page.evaluate(() => {
            // Check for download buttons or links
            const downloadButtons = document.querySelectorAll('[class*="download"], [id*="download"], [onclick*="download"]');
            const info = {
                downloadButtons: downloadButtons.length,
                axZmDownload: !!(window.jQuery && window.jQuery.axZm && window.jQuery.axZm.downloadImage)
            };
            
            // Try to find the actual image URLs
            const images = document.querySelectorAll('img[src*="display"], img[src*="zoom"]');
            info.sampleImageUrls = Array.from(images).slice(0, 5).map(img => img.src);
            
            return info;
        });
        
        console.log('Download info:', downloadInfo);
        
        // Try programmatic download if available
        if (downloadInfo.axZmDownload) {
            console.log('Trying AJAX Zoom download function...');
            
            try {
                await page.evaluate(() => {
                    if (window.jQuery && window.jQuery.axZm && window.jQuery.axZm.downloadImage) {
                        window.jQuery.axZm.downloadImage();
                    }
                });
                await page.waitForTimeout(2000);
            } catch (e) {
                console.log('Download function failed:', e.message);
            }
        }
        
        // Extract the manuscript structure
        const manuscriptInfo = await page.evaluate(() => {
            const info = {
                totalPages: 0,
                currentPage: 0,
                imagePattern: null
            };
            
            // Look for page info
            const pageText = document.body.innerText.match(/(\d+)\s*\/\s*(\d+)/);
            if (pageText) {
                info.currentPage = parseInt(pageText[1]);
                info.totalPages = parseInt(pageText[2]);
            }
            
            // Try to find the gallery structure
            const galleryImages = document.querySelectorAll('[src*="zoomgallery"]');
            if (galleryImages.length > 0) {
                info.totalPages = Math.max(info.totalPages, galleryImages.length);
                info.galleryPattern = galleryImages[0].src;
            }
            
            return info;
        });
        
        console.log('Manuscript info:', manuscriptInfo);
        
        // Save the analysis
        await fs.writeFile(
            path.join(__dirname, '../../.devkit/reports/belgica-browser-analysis.json'),
            JSON.stringify({
                url: 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415',
                viewerUrl: iframeUrl,
                sessionData,
                downloadInfo,
                manuscriptInfo,
                downloadedUrls,
                cookieCount: cookies.length
            }, null, 2)
        );
        
        console.log(`\nAnalysis complete. Downloaded ${downloadedUrls.length} images.`);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

downloadBelgicaManuscript().catch(console.error);