const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Test configurations for Morgan and HHU
const testConfigs = [
    {
        name: 'Morgan - ImagesByPriority Fix',
        library: 'morgan',
        url: 'https://www.themorgan.org/collection/lindau-gospels/thumbs',
        issue: 'Only extracting 1 page instead of all pages',
        fix: 'Fixed imagesByPriority parsing to extract all pages correctly',
        expectedPages: 10
    },
    {
        name: 'HHU Düsseldorf - JSON Parsing Fix',
        library: 'hhu',
        url: 'https://digital.ulb.hhu.de/ms/content/titleinfo/7674176',
        issue: 'Invalid JSON responses causing parse errors',
        fix: 'Added robust JSON parsing with HTML detection',
        expectedPages: 10
    }
];

// Create validation directory
const validationDir = path.join(__dirname, 'validation-morgan-hhu-' + new Date().toISOString().split('T')[0]);
if (!fs.existsSync(validationDir)) {
    fs.mkdirSync(validationDir, { recursive: true });
}

// Morgan specific manifest loading
async function getMorganManifest(url) {
    console.log('[Morgan] Processing URL:', url);
    
    // Extract Morgan ID from URL
    const morganIdMatch = url.match(/\/collection\/([^\/]+)/);
    if (!morganIdMatch) {
        throw new Error('Could not extract Morgan collection ID from URL');
    }
    
    const collectionId = morganIdMatch[1];
    console.log('[Morgan] Collection ID:', collectionId);
    
    // Fetch the page HTML
    const html = await fetchWithTimeout(url);
    
    // Extract images using imagesByPriority pattern
    const imagesMatch = html.match(/imagesByPriority:\s*(\[[^\]]+\])/);
    if (!imagesMatch) {
        throw new Error('Could not find imagesByPriority data in Morgan page');
    }
    
    try {
        // Parse the imagesByPriority array
        const imagesJson = imagesMatch[1]
            .replace(/'/g, '"')  // Replace single quotes with double quotes
            .replace(/(\w+):/g, '"$1":');  // Quote property names
        
        const imagesData = JSON.parse(imagesJson);
        console.log(`[Morgan] Found ${imagesData.length} pages in imagesByPriority`);
        
        // Build image URLs from the parsed data
        const images = imagesData.map((imageFile, index) => {
            // Remove any path prefix and extension from the filename
            const filename = imageFile.split('/').pop().replace(/\.[^.]+$/, '');
            return {
                url: `https://media.themorgan.org/images/${collectionId}/${filename}_thumb.jpg`,
                label: `Page ${index + 1}`
            };
        });
        
        return {
            title: `Morgan Library - ${collectionId}`,
            images: images
        };
    } catch (error) {
        console.error('[Morgan] Error parsing imagesByPriority:', error);
        throw new Error(`Failed to parse Morgan image data: ${error.message}`);
    }
}

// HHU specific manifest loading
async function getHHUManifest(url) {
    console.log('[HHU] Processing URL:', url);
    
    // Extract manuscript ID from URL
    const manuscriptIdMatch = url.match(/\/(\d+)$/);
    if (!manuscriptIdMatch) {
        throw new Error('Could not extract manuscript ID from HHU URL');
    }
    
    const manuscriptId = manuscriptIdMatch[1];
    const manifestUrl = `https://digital.ulb.hhu.de/i3f/v20/${manuscriptId}/manifest`;
    
    console.log('[HHU] Fetching IIIF manifest from:', manifestUrl);
    
    try {
        const manifestText = await fetchWithTimeout(manifestUrl, 60000);
        
        // Check if response is HTML (error page)
        if (manifestText.trim().startsWith('<') || manifestText.includes('<!DOCTYPE')) {
            throw new Error('HHU server returned HTML error page instead of JSON manifest');
        }
        
        // Try to parse JSON
        const manifest = JSON.parse(manifestText);
        console.log('[HHU] Manifest parsed successfully');
        
        // Extract images from IIIF manifest
        const images = [];
        if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
            const canvases = manifest.sequences[0].canvases;
            console.log(`[HHU] Found ${canvases.length} pages in manifest`);
            
            for (let i = 0; i < canvases.length; i++) {
                const canvas = canvases[i];
                if (canvas.images && canvas.images[0] && canvas.images[0].resource) {
                    images.push({
                        url: canvas.images[0].resource['@id'],
                        label: canvas.label || `Page ${i + 1}`
                    });
                }
            }
        }
        
        return {
            title: manifest.label || `HHU Manuscript ${manuscriptId}`,
            images: images
        };
    } catch (error) {
        console.error('[HHU] Error loading manifest:', error);
        throw error;
    }
}

// Helper function to fetch with timeout
function fetchWithTimeout(url, timeout = 30000) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error('Request timeout'));
        }, timeout);
        
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                clearTimeout(timeoutId);
                resolve(data);
            });
            res.on('error', err => {
                clearTimeout(timeoutId);
                reject(err);
            });
        }).on('error', err => {
            clearTimeout(timeoutId);
            reject(err);
        });
    });
}

// Test a library
async function testLibrary(config) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing: ${config.name}`);
    console.log(`URL: ${config.url}`);
    console.log(`Issue: ${config.issue}`);
    console.log(`Fix: ${config.fix}`);
    console.log(`${'='.repeat(80)}\n`);

    const result = {
        library: config.library,
        name: config.name,
        status: 'pending',
        error: null,
        manifest: null,
        pdfPath: null,
        pdfSize: 0,
        pageCount: 0,
        timeElapsed: 0
    };

    const startTime = Date.now();

    try {
        // Step 1: Load manifest
        console.log('Step 1: Loading manifest...');
        let manifest;
        
        if (config.library === 'morgan') {
            manifest = await getMorganManifest(config.url);
        } else if (config.library === 'hhu') {
            manifest = await getHHUManifest(config.url);
        } else {
            throw new Error(`Unknown library: ${config.library}`);
        }
        
        if (!manifest || !manifest.images || manifest.images.length === 0) {
            throw new Error('No images found in manifest');
        }

        console.log(`✓ Manifest loaded successfully: ${manifest.title || 'Untitled'}`);
        console.log(`✓ Found ${manifest.images.length} pages`);
        result.manifest = {
            title: manifest.title,
            totalPages: manifest.images.length
        };

        // Step 2: Download sample pages (up to 10)
        const pagesToDownload = Math.min(config.expectedPages, manifest.images.length);
        console.log(`\nStep 2: Downloading ${pagesToDownload} sample pages...`);

        const imageDir = path.join(validationDir, `${config.library}-images`);
        if (!fs.existsSync(imageDir)) {
            fs.mkdirSync(imageDir);
        }

        const downloadedImages = [];
        for (let i = 0; i < pagesToDownload; i++) {
            const image = manifest.images[i];
            const imagePath = path.join(imageDir, `page-${String(i + 1).padStart(3, '0')}.jpg`);
            
            try {
                console.log(`  Downloading page ${i + 1}/${pagesToDownload}...`);
                
                // Use curl to download image with extended timeout
                const curlCmd = `curl -s -L -o "${imagePath}" --max-time 60 --retry 3 "${image.url}"`;
                execSync(curlCmd, { stdio: 'pipe' });
                
                // Verify file was downloaded
                if (fs.existsSync(imagePath) && fs.statSync(imagePath).size > 0) {
                    downloadedImages.push(imagePath);
                    console.log(`  ✓ Page ${i + 1} downloaded (${(fs.statSync(imagePath).size / 1024).toFixed(1)} KB)`);
                } else {
                    console.log(`  ✗ Page ${i + 1} failed to download`);
                }
            } catch (err) {
                console.log(`  ✗ Page ${i + 1} download error: ${err.message}`);
            }
        }

        if (downloadedImages.length === 0) {
            throw new Error('Failed to download any pages');
        }

        console.log(`\n✓ Downloaded ${downloadedImages.length} pages successfully`);

        // Step 3: Create PDF
        console.log('\nStep 3: Creating PDF...');
        const pdfPath = path.join(validationDir, `${config.library}-manuscript.pdf`);
        
        // Use ImageMagick to create PDF
        const convertCmd = `convert ${downloadedImages.map(p => `"${p}"`).join(' ')} "${pdfPath}"`;
        execSync(convertCmd, { stdio: 'pipe' });

        if (!fs.existsSync(pdfPath)) {
            throw new Error('PDF creation failed');
        }

        const pdfSize = fs.statSync(pdfPath).size;
        console.log(`✓ PDF created successfully: ${(pdfSize / 1024 / 1024).toFixed(2)} MB`);

        // Step 4: Validate PDF with poppler
        console.log('\nStep 4: Validating PDF with poppler...');
        try {
            const pdfInfoOutput = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
            const pageMatch = pdfInfoOutput.match(/Pages:\s+(\d+)/);
            const pageCount = pageMatch ? parseInt(pageMatch[1]) : 0;
            
            if (pageCount !== downloadedImages.length) {
                throw new Error(`PDF page count mismatch: expected ${downloadedImages.length}, got ${pageCount}`);
            }
            
            console.log(`✓ PDF validation passed: ${pageCount} pages`);
            result.pageCount = pageCount;
        } catch (err) {
            throw new Error(`PDF validation failed: ${err.message}`);
        }

        // Success
        result.status = 'success';
        result.pdfPath = pdfPath;
        result.pdfSize = pdfSize;
        result.timeElapsed = Date.now() - startTime;

        console.log(`\n✅ ${config.name} - TEST PASSED`);
        console.log(`   Time: ${(result.timeElapsed / 1000).toFixed(1)}s`);
        console.log(`   PDF: ${path.basename(pdfPath)} (${(pdfSize / 1024 / 1024).toFixed(2)} MB)`);

    } catch (error) {
        result.status = 'failed';
        result.error = error.message;
        result.timeElapsed = Date.now() - startTime;
        
        console.error(`\n❌ ${config.name} - TEST FAILED`);
        console.error(`   Error: ${error.message}`);
        console.error(`   Time: ${(result.timeElapsed / 1000).toFixed(1)}s`);
    }

    return result;
}

// Run all tests
async function runTests() {
    console.log('Testing Morgan and HHU libraries...\n');
    console.log(`Results will be saved to: ${validationDir}\n`);

    const results = [];
    
    for (const config of testConfigs) {
        const result = await testLibrary(config);
        results.push(result);
        
        if (testConfigs.indexOf(config) < testConfigs.length - 1) {
            console.log('\nWaiting 5 seconds before next test...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('VALIDATION SUMMARY');
    console.log('='.repeat(80));

    const successCount = results.filter(r => r.status === 'success').length;
    const failCount = results.filter(r => r.status === 'failed').length;

    console.log(`\nTotal Tests: ${results.length}`);
    console.log(`✅ Passed: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);

    // Save results
    const reportPath = path.join(validationDir, 'validation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\nValidation report saved to: ${reportPath}`);
    
    console.log(`\nAll validation files saved to: ${validationDir}`);
    
    return { passed: successCount, failed: failCount };
}

// Run the tests
runTests().then(summary => {
    console.log('\n✨ Tests completed!');
    process.exit(summary.failed > 0 ? 1 : 0);
}).catch(error => {
    console.error('\n💥 Test runner failed:', error);
    process.exit(1);
});