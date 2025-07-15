const https = require('https');
const fs = require('fs');
const path = require('path');

// Extended test for Wolfenbüttel manuscript library
const baseUrl = 'http://diglib.hab.de/mss/1008-helmst';

async function testWolfenbuettelExtended() {
    console.log('Extended Wolfenbüttel Digital Library Testing...');
    
    // Test extensive page range to find total pages
    console.log('\nTesting extensive page range:');
    const maxPages = 200; // Test up to 200 pages
    let validPages = [];
    let consecutiveFailures = 0;
    
    for (let i = 1; i <= maxPages; i++) {
        const pageNum = i.toString().padStart(5, '0');
        const testUrl = `${baseUrl}/max/${pageNum}.jpg`;
        
        try {
            const response = await fetchWithTimeout(testUrl, 3000);
            if (response.status === 200) {
                validPages.push(pageNum);
                consecutiveFailures = 0;
                if (validPages.length % 10 === 0) {
                    console.log(`Found ${validPages.length} valid pages so far...`);
                }
            } else {
                consecutiveFailures++;
                if (consecutiveFailures > 10) {
                    console.log(`Stopping after ${consecutiveFailures} consecutive failures at page ${pageNum}`);
                    break;
                }
            }
        } catch (error) {
            consecutiveFailures++;
            if (consecutiveFailures > 10) {
                console.log(`Stopping after ${consecutiveFailures} consecutive failures at page ${pageNum}`);
                break;
            }
        }
    }
    
    console.log(`\nTotal valid pages found: ${validPages.length}`);
    console.log(`Page range: ${validPages[0]} to ${validPages[validPages.length - 1]}`);
    
    // Test different resolution formats for maximum quality
    console.log('\nTesting alternative resolution formats:');
    const testPage = '00001';
    const resolutionFormats = [
        '/max/',
        '/large/',
        '/medium/',
        '/small/',
        '/full/',
        '/original/',
        '/hires/',
        '/highres/',
        '/biggest/',
        '/largest/'
    ];
    
    const validFormats = [];
    
    for (const format of resolutionFormats) {
        const testUrl = `${baseUrl}${format}${testPage}.jpg`;
        try {
            const response = await fetchWithTimeout(testUrl, 5000);
            if (response.status === 200) {
                const contentLength = response.headers['content-length'] || 'unknown';
                validFormats.push({
                    format,
                    size: contentLength,
                    url: testUrl
                });
                console.log(`✓ ${format}: ${contentLength} bytes`);
            }
        } catch (error) {
            // Silent fail
        }
    }
    
    // Test different file formats
    console.log('\nTesting different file formats:');
    const fileFormats = ['.jpg', '.jpeg', '.png', '.tiff', '.tif'];
    
    for (const ext of fileFormats) {
        const testUrl = `${baseUrl}/max/${testPage}${ext}`;
        try {
            const response = await fetchWithTimeout(testUrl, 5000);
            if (response.status === 200) {
                const contentLength = response.headers['content-length'] || 'unknown';
                console.log(`✓ ${ext}: ${contentLength} bytes`);
            }
        } catch (error) {
            // Silent fail
        }
    }
    
    // Download sample pages for validation
    console.log('\nDownloading sample pages for validation:');
    const samplePages = validPages.slice(0, 10); // First 10 pages
    const sampleDir = path.join(__dirname, 'temp', 'wolfenbuettel-samples');
    await fs.promises.mkdir(sampleDir, { recursive: true });
    
    for (const pageNum of samplePages) {
        const imageUrl = `${baseUrl}/max/${pageNum}.jpg`;
        try {
            const response = await fetchWithTimeout(imageUrl, 10000);
            if (response.status === 200) {
                const buffer = Buffer.from(await response.arrayBuffer());
                const filename = path.join(sampleDir, `page-${pageNum}.jpg`);
                await fs.promises.writeFile(filename, buffer);
                console.log(`✓ Downloaded page ${pageNum}: ${buffer.length} bytes`);
            }
        } catch (error) {
            console.log(`✗ Failed to download page ${pageNum}: ${error.message}`);
        }
    }
    
    // Generate implementation summary
    console.log('\n=== IMPLEMENTATION SUMMARY ===');
    console.log(`Library: Wolfenbüttel Digital Library (HAB)`);
    console.log(`Base URL pattern: http://diglib.hab.de/mss/[manuscript-id]/max/[page].jpg`);
    console.log(`Total pages: ${validPages.length}`);
    console.log(`Best resolution format: /max/`);
    console.log(`File format: .jpg`);
    console.log(`Page numbering: 5-digit zero-padded (00001, 00002, etc.)`);
    console.log(`Sample pages saved to: ${sampleDir}`);
    
    return {
        totalPages: validPages.length,
        pageRange: validPages,
        bestFormat: '/max/',
        baseUrl: baseUrl,
        sampleDir: sampleDir
    };
}

async function fetchWithTimeout(url, timeout = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// Run the extended test
testWolfenbuettelExtended().catch(console.error);