const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

const VALIDATION_DIR = path.join(__dirname, '../validation-results/hhu');
const PDF_DIR = path.join(VALIDATION_DIR, 'pdfs');

// Test URLs from GitHub issue #1
const TEST_URLS = [
    'https://digital.ub.uni-duesseldorf.de/content/titleinfo/7938251',
    'https://digital.ub.uni-duesseldorf.de/hs/content/titleinfo/259994',
    'https://digital.ub.uni-duesseldorf.de/content/titleinfo/4688809'
];

async function downloadImage(url, outputPath) {
    const loader = new SharedManifestLoaders();
    const response = await loader.fetchWithRetry(url);
    if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
    const buffer = await response.buffer();
    await fs.writeFile(outputPath, buffer);
    console.log(`Downloaded: ${path.basename(outputPath)} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

async function validateHHU() {
    console.log('=== HHU Düsseldorf Validation ===\n');
    
    // Clean up and create directories
    await fs.rm(VALIDATION_DIR, { recursive: true, force: true });
    await fs.mkdir(PDF_DIR, { recursive: true });
    
    const loader = new SharedManifestLoaders();
    const results = [];
    
    for (const url of TEST_URLS) {
        console.log(`\nTesting: ${url}`);
        const manuscriptId = url.match(/titleinfo\/(\d+)/)[1];
        const manuscriptDir = path.join(PDF_DIR, `manuscript_${manuscriptId}`);
        await fs.mkdir(manuscriptDir, { recursive: true });
        
        try {
            const startTime = Date.now();
            const manifest = await loader.getHHUManifest(url);
            const fetchTime = Date.now() - startTime;
            
            console.log(`✓ Manifest loaded in ${fetchTime}ms`);
            console.log(`  Title: ${manifest.displayName || 'HHU Manuscript'}`);
            console.log(`  Total images: ${manifest.images.length}`);
            
            // Download first 10 pages
            const downloadCount = Math.min(10, manifest.images.length);
            const imageFiles = [];
            
            for (let i = 0; i < downloadCount; i++) {
                const image = manifest.images[i];
                const outputPath = path.join(manuscriptDir, `page_${String(i + 1).padStart(3, '0')}.jpg`);
                
                try {
                    await downloadImage(image.url, outputPath);
                    imageFiles.push(outputPath);
                } catch (error) {
                    console.error(`  ✗ Failed to download page ${i + 1}: ${error.message}`);
                }
            }
            
            if (imageFiles.length > 0) {
                // Create PDF
                const pdfPath = path.join(PDF_DIR, `hhu_${manuscriptId}.pdf`);
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
        library: 'Heinrich Heine University Düsseldorf',
        timestamp: new Date().toISOString(),
        issue: 'GitHub Issue #1 - JSON parsing error',
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
validateHHU().catch(console.error);