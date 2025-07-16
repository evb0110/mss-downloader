const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Reuse the fetchWithHTTPS function that mimics the fix
async function fetchWithHTTPS(url, options = {}) {
    const urlObj = new URL(url);
    const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/json,image/jpeg,*/*',
            ...options.headers
        },
        rejectUnauthorized: false
    };
    
    return new Promise((resolve, reject) => {
        const req = https.request(requestOptions, (res) => {
            const chunks = [];
            
            res.on('data', (chunk) => {
                chunks.push(chunk);
            });
            
            res.on('end', () => {
                const body = Buffer.concat(chunks);
                resolve({
                    ok: res.statusCode === 200,
                    status: res.statusCode,
                    headers: res.headers,
                    json: async () => JSON.parse(body.toString()),
                    arrayBuffer: async () => body
                });
            });
        });
        
        req.on('error', reject);
        req.end();
    });
}

async function validateGrenobleLibrary() {
    console.log('=== GRENOBLE LIBRARY VALIDATION ===\n');
    
    // Test URLs
    const testManuscripts = [
        'https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom',
        'https://pagella.bm-grenoble.fr/ark:/12148/btv1b84192911/f1.item.zoom',
        'https://pagella.bm-grenoble.fr/ark:/12148/btv1b84525846/f1.item.zoom'
    ];
    
    const outputDir = path.join(__dirname, 'grenoble-validation-output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const results = [];
    
    for (const [index, manuscriptUrl] of testManuscripts.entries()) {
        console.log(`\nTesting manuscript ${index + 1}/${testManuscripts.length}:`);
        console.log(`URL: ${manuscriptUrl}`);
        
        try {
            // Extract document ID
            const idMatch = manuscriptUrl.match(/\/([^/]+)\/f\d+/);
            if (!idMatch) {
                throw new Error('Invalid URL format');
            }
            const documentId = idMatch[1];
            
            // Fetch manifest
            const manifestUrl = `https://pagella.bm-grenoble.fr/iiif/ark:/12148/${documentId}/manifest.json`;
            console.log(`Manifest URL: ${manifestUrl}`);
            
            const manifestResponse = await fetchWithHTTPS(manifestUrl);
            if (!manifestResponse.ok) {
                throw new Error(`Manifest fetch failed: HTTP ${manifestResponse.status}`);
            }
            
            const manifest = await manifestResponse.json();
            const title = manifest.label || `Grenoble Manuscript ${documentId}`;
            console.log(`Title: ${title}`);
            
            // Get page count
            let totalPages = 0;
            if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
                totalPages = manifest.sequences[0].canvases.length;
            }
            console.log(`Total pages: ${totalPages}`);
            
            if (totalPages === 0) {
                throw new Error('No pages found in manifest');
            }
            
            // Download 10 pages (or all if fewer)
            const pagesToDownload = Math.min(10, totalPages);
            const pageIndices = [];
            
            // Select evenly distributed pages
            for (let i = 0; i < pagesToDownload; i++) {
                const pageIndex = Math.floor(i * totalPages / pagesToDownload) + 1;
                if (!pageIndices.includes(pageIndex)) {
                    pageIndices.push(pageIndex);
                }
            }
            
            console.log(`Downloading ${pageIndices.length} pages...`);
            const downloadedPages = [];
            
            for (const pageNum of pageIndices) {
                // Use maximum resolution URL
                const imageUrl = `https://pagella.bm-grenoble.fr/iiif/ark:/12148/${documentId}/f${pageNum}/full/4000,/0/default.jpg`;
                
                try {
                    const imgResponse = await fetchWithHTTPS(imageUrl);
                    if (!imgResponse.ok) {
                        console.log(`  Page ${pageNum}: Failed (HTTP ${imgResponse.status})`);
                        continue;
                    }
                    
                    const buffer = await imgResponse.arrayBuffer();
                    const filename = `manuscript-${index + 1}-page-${pageNum}.jpg`;
                    const filepath = path.join(outputDir, filename);
                    fs.writeFileSync(filepath, Buffer.from(buffer));
                    
                    const stats = fs.statSync(filepath);
                    console.log(`  Page ${pageNum}: ✓ (${(stats.size / 1024).toFixed(1)} KB)`);
                    downloadedPages.push(filepath);
                } catch (error) {
                    console.log(`  Page ${pageNum}: Failed (${error.message})`);
                }
            }
            
            // Create PDF if we have pages
            if (downloadedPages.length > 0) {
                const pdfPath = path.join(outputDir, `manuscript-${index + 1}.pdf`);
                try {
                    execSync(`convert ${downloadedPages.join(' ')} "${pdfPath}"`, { stdio: 'pipe' });
                    
                    // Validate PDF
                    const pdfInfo = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
                    const pdfImages = execSync(`pdfimages -list "${pdfPath}"`, { encoding: 'utf8' });
                    
                    console.log(`\nPDF created: ${path.basename(pdfPath)}`);
                    console.log('PDF validation: ✓ Valid');
                    
                    results.push({
                        url: manuscriptUrl,
                        title: title,
                        totalPages: totalPages,
                        downloadedPages: downloadedPages.length,
                        pdfCreated: true,
                        status: 'SUCCESS'
                    });
                } catch (error) {
                    console.log(`PDF creation failed: ${error.message}`);
                    results.push({
                        url: manuscriptUrl,
                        title: title,
                        totalPages: totalPages,
                        downloadedPages: downloadedPages.length,
                        pdfCreated: false,
                        status: 'PARTIAL'
                    });
                }
            } else {
                results.push({
                    url: manuscriptUrl,
                    title: title,
                    totalPages: totalPages,
                    downloadedPages: 0,
                    pdfCreated: false,
                    status: 'FAILED'
                });
            }
            
        } catch (error) {
            console.log(`\nERROR: ${error.message}`);
            results.push({
                url: manuscriptUrl,
                error: error.message,
                status: 'FAILED'
            });
        }
    }
    
    // Summary
    console.log('\n\n=== VALIDATION SUMMARY ===\n');
    
    const successful = results.filter(r => r.status === 'SUCCESS').length;
    const partial = results.filter(r => r.status === 'PARTIAL').length;
    const failed = results.filter(r => r.status === 'FAILED').length;
    
    console.log(`Total manuscripts tested: ${results.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Partial: ${partial}`);
    console.log(`Failed: ${failed}`);
    
    console.log('\nDetailed results:');
    results.forEach((r, i) => {
        console.log(`\n${i + 1}. ${r.url}`);
        if (r.status === 'FAILED' && r.error) {
            console.log(`   Status: FAILED - ${r.error}`);
        } else {
            console.log(`   Status: ${r.status}`);
            console.log(`   Title: ${r.title}`);
            console.log(`   Pages: ${r.downloadedPages}/${r.totalPages} downloaded`);
            console.log(`   PDF: ${r.pdfCreated ? '✓ Created' : '✗ Not created'}`);
        }
    });
    
    console.log(`\nValidation files saved to: ${outputDir}`);
    
    // Overall validation result
    const validationPassed = successful > 0 && failed === 0;
    console.log(`\n=== VALIDATION ${validationPassed ? 'PASSED' : 'FAILED'} ===`);
    
    return validationPassed;
}

// Run validation
validateGrenobleLibrary().then(passed => {
    process.exit(passed ? 0 : 1);
}).catch(error => {
    console.error('Validation error:', error);
    process.exit(1);
});