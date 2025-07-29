const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

const VALIDATION_DIR = path.join(__dirname, '../validation-results/morgan');
const PDF_DIR = path.join(VALIDATION_DIR, 'pdfs');

// Test URLs from GitHub issue #4
const TEST_URLS = [
    'https://www.themorgan.org/collection/lindau-gospels/thumbs',
    'https://www.themorgan.org/collection/gospel-book/159129',
    'https://ica.themorgan.org/manuscript/thumbs/143821'
];

async function downloadImage(url, outputPath) {
    const loader = new SharedManifestLoaders();
    const response = await loader.fetchWithRetry(url);
    if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
    const buffer = await response.buffer();
    await fs.writeFile(outputPath, buffer);
    console.log(`Downloaded: ${path.basename(outputPath)} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

async function validateMorgan() {
    console.log('=== Morgan Library Validation ===\n');
    
    // Clean up and create directories
    await fs.rm(VALIDATION_DIR, { recursive: true, force: true });
    await fs.mkdir(PDF_DIR, { recursive: true });
    
    const loader = new SharedManifestLoaders();
    const results = [];
    
    for (const url of TEST_URLS) {
        console.log(`\nTesting: ${url}`);
        const urlParts = url.split('/');
        const manuscriptId = urlParts[urlParts.length - 2] || urlParts[urlParts.length - 1];
        const manuscriptDir = path.join(PDF_DIR, `manuscript_${manuscriptId}`);
        await fs.mkdir(manuscriptDir, { recursive: true });
        
        try {
            const startTime = Date.now();
            const manifest = await loader.getMorganManifest(url);
            const fetchTime = Date.now() - startTime;
            
            console.log(`✓ Manifest loaded in ${fetchTime}ms`);
            console.log(`  Title: ${manifest.displayName || 'Morgan Manuscript'}`);
            console.log(`  Total images: ${manifest.images.length}`);
            
            // Download first 10 pages
            const downloadCount = Math.min(10, manifest.images.length);
            const imageFiles = [];
            
            for (let i = 0; i < downloadCount; i++) {
                const image = manifest.images[i];
                const outputPath = path.join(manuscriptDir, `page_${String(i + 1).padStart(3, '0')}.jpg`);
                
                try {
                    // Handle ZIF files differently
                    if (image.url.endsWith('.zif')) {
                        console.log(`  Skipping ZIF file (requires special handling): ${image.label}`);
                        continue;
                    }
                    
                    await downloadImage(image.url, outputPath);
                    imageFiles.push(outputPath);
                } catch (error) {
                    console.error(`  ✗ Failed to download page ${i + 1}: ${error.message}`);
                }
            }
            
            if (imageFiles.length > 0) {
                // Create PDF
                const pdfPath = path.join(PDF_DIR, `morgan_${manuscriptId.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
                console.log(`\nCreating PDF: ${path.basename(pdfPath)}`);
                
                execSync(`convert ${imageFiles.join(' ')} "${pdfPath}"`, { 
                    stdio: 'pipe',
                    maxBuffer: 50 * 1024 * 1024 
                });
                
                // Validate PDF
                const pdfInfo = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
                const pageMatch = pdfInfo.match(/Pages:\s+(\d+)/);
                const pdfPages = pageMatch ? parseInt(pageMatch[1]) : 0;
                
                console.log(`✓ PDF created successfully with ${pdfPages} pages`);
                
                // Check file size
                const stats = await fs.stat(pdfPath);
                console.log(`  PDF size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
                
                results.push({
                    url,
                    status: 'success',
                    pages: imageFiles.length,
                    pdfPages,
                    pdfSize: stats.size,
                    fetchTime
                });
            } else {
                throw new Error('No images downloaded successfully');
            }
            
        } catch (error) {
            console.error(`✗ Error: ${error.message}`);
            results.push({
                url,
                status: 'failed',
                error: error.message
            });
        }
    }
    
    // Write report
    const report = {
        library: 'Morgan Library',
        timestamp: new Date().toISOString(),
        issue: 'GitHub Issue #4 - ReferenceError imagesByPriority',
        results,
        summary: {
            total: results.length,
            successful: results.filter(r => r.status === 'success').length,
            failed: results.filter(r => r.status === 'failed').length
        }
    };
    
    await fs.writeFile(
        path.join(VALIDATION_DIR, 'validation-report.json'),
        JSON.stringify(report, null, 2)
    );
    
    console.log('\n=== Summary ===');
    console.log(`Total tests: ${report.summary.total}`);
    console.log(`Successful: ${report.summary.successful}`);
    console.log(`Failed: ${report.summary.failed}`);
    
    return report;
}

// Run validation
validateMorgan().catch(console.error);