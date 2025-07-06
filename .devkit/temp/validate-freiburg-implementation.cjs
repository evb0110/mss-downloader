#!/usr/bin/env node

const https = require('https');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

/**
 * Comprehensive validation test for University of Freiburg library implementation
 * Tests the complete flow: URL parsing -> METS XML retrieval -> Image discovery -> Resolution testing
 */

const TEST_URL = 'https://dl.ub.uni-freiburg.de/diglit/hs360a/0001';
const VALIDATION_DIR = path.join(process.cwd(), 'CURRENT-VALIDATION');

console.log('🔍 Starting comprehensive University of Freiburg validation test...');
console.log(`📋 Test URL: ${TEST_URL}`);

async function fetchWithTimeout(url, options = {}, timeout = 30000) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, options, (response) => {
            let data = '';
            
            response.on('data', (chunk) => {
                data += chunk;
            });
            
            response.on('end', () => {
                resolve({
                    ok: response.statusCode >= 200 && response.statusCode < 300,
                    status: response.statusCode,
                    statusText: response.statusMessage,
                    text: () => Promise.resolve(data),
                    json: () => Promise.resolve(JSON.parse(data))
                });
            });
        });
        
        request.on('error', reject);
        request.setTimeout(timeout, () => {
            request.destroy();
            reject(new Error(`Request timeout: ${url}`));
        });
    });
}

async function testUrlParsing() {
    console.log('\n📝 Step 1: Testing URL parsing...');
    
    const testUrls = [
        'https://dl.ub.uni-freiburg.de/diglit/hs360a/0001',
        'https://dl.ub.uni-freiburg.de/diglit/hs360a',
        'https://dl.ub.uni-freiburg.de/diglit/codal_25',
        'https://dl.ub.uni-freiburg.de/diglit/codal_25/0001'
    ];
    
    const results = [];
    
    for (const url of testUrls) {
        try {
            const manuscriptMatch = url.match(/\/diglit\/([^/?]+)/);
            if (manuscriptMatch) {
                const manuscriptId = manuscriptMatch[1];
                console.log(`✅ ${url} -> manuscript ID: ${manuscriptId}`);
                results.push({ url, manuscriptId, success: true });
            } else {
                console.log(`❌ ${url} -> failed to extract manuscript ID`);
                results.push({ url, success: false, error: 'Failed to extract manuscript ID' });
            }
        } catch (error) {
            console.log(`❌ ${url} -> error: ${error.message}`);
            results.push({ url, success: false, error: error.message });
        }
    }
    
    return results;
}

async function testMetadataExtraction() {
    console.log('\n🔍 Step 2: Testing metadata extraction...');
    
    // Extract manuscript ID from test URL
    const manuscriptMatch = TEST_URL.match(/\/diglit\/([^/?]+)/);
    if (!manuscriptMatch) {
        throw new Error('Cannot extract manuscript ID from test URL');
    }
    
    const manuscriptId = manuscriptMatch[1];
    const metadataUrl = `https://dl.ub.uni-freiburg.de/diglit/${manuscriptId}`;
    
    console.log(`📡 Fetching metadata from: ${metadataUrl}`);
    
    try {
        const response = await fetchWithTimeout(metadataUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Metadata request failed: ${response.status} ${response.statusText}`);
        }
        
        const html = await response.text();
        const dom = new JSDOM(html);
        const document = dom.window.document;
        
        // Extract title using multiple selectors
        let displayName = `Freiburg Manuscript ${manuscriptId}`;
        const titleSelectors = [
            'h1.page-header',
            '.metadata-title', 
            'h1',
            'title'
        ];
        
        for (const selector of titleSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                displayName = element.textContent.trim();
                console.log(`✅ Found title with selector '${selector}': ${displayName}`);
                break;
            }
        }
        
        return {
            manuscriptId,
            metadataUrl,
            displayName,
            htmlLength: html.length,
            success: true
        };
        
    } catch (error) {
        console.log(`❌ Metadata extraction failed: ${error.message}`);
        return {
            manuscriptId,
            metadataUrl,
            success: false,
            error: error.message
        };
    }
}

async function testMetsXmlParsing() {
    console.log('\n🗂️ Step 3: Testing METS XML parsing...');
    
    const manuscriptMatch = TEST_URL.match(/\/diglit\/([^/?]+)/);
    const manuscriptId = manuscriptMatch[1];
    const metsUrl = `https://dl.ub.uni-freiburg.de/diglit/${manuscriptId}/mets`;
    
    console.log(`📡 Fetching METS XML from: ${metsUrl}`);
    
    try {
        const response = await fetchWithTimeout(metsUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/xml,text/xml,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!response.ok) {
            throw new Error(`METS XML request failed: ${response.status} ${response.statusText}`);
        }
        
        const xmlContent = await response.text();
        const dom = new JSDOM(xmlContent, { contentType: 'text/xml' });
        const document = dom.window.document;
        
        console.log(`✅ METS XML fetched successfully (${xmlContent.length} characters)`);
        
        // Parse file sections to find images
        const fileElements = document.querySelectorAll('mets\\:file, file');
        console.log(`📄 Found ${fileElements.length} file elements in METS XML`);
        
        const pageLinks = [];
        
        fileElements.forEach((fileElement, index) => {
            const fLocationElement = fileElement.querySelector('mets\\:FLocat, FLocat');
            if (fLocationElement) {
                const href = fLocationElement.getAttribute('xlink:href') || fLocationElement.getAttribute('href');
                if (href && href.includes('.jp')) {
                    const fileMatch = href.match(/([^/]+)\.jp[e]?g$/i);
                    if (fileMatch) {
                        const filename = fileMatch[1];
                        const iiifUrl = `https://dl.ub.uni-freiburg.de/diglitData/image/${manuscriptId}/${filename}.jp2/full/full/0/default.jpg`;
                        pageLinks.push(iiifUrl);
                        
                        if (index < 5) { // Show first 5 for debugging
                            console.log(`  📸 Page ${index + 1}: ${filename} -> ${iiifUrl}`);
                        }
                    }
                }
            }
        });
        
        if (pageLinks.length > 5) {
            console.log(`  ... and ${pageLinks.length - 5} more pages`);
        }
        
        return {
            metsUrl,
            xmlLength: xmlContent.length,
            totalFiles: fileElements.length,
            pageLinks,
            totalPages: pageLinks.length,
            success: true
        };
        
    } catch (error) {
        console.log(`❌ METS XML parsing failed: ${error.message}`);
        return {
            metsUrl,
            success: false,
            error: error.message
        };
    }
}

async function testImageResolution(pageLinks, sampleSize = 5) {
    console.log('\n🖼️ Step 4: Testing image resolution and availability...');
    
    if (!pageLinks || pageLinks.length === 0) {
        console.log('❌ No page links available for testing');
        return { success: false, error: 'No page links available' };
    }
    
    // Test different resolution patterns
    const resolutionTests = [
        { name: 'Full Resolution', pattern: 'full/full/0/default.jpg' },
        { name: 'Max Width 4000', pattern: 'full/4000,/0/default.jpg' },
        { name: 'Max Width 2000', pattern: 'full/2000,/0/default.jpg' },
        { name: 'Max Width 1000', pattern: 'full/1000,/0/default.jpg' }
    ];
    
    const results = [];
    const testUrls = pageLinks.slice(0, sampleSize);
    
    console.log(`🔍 Testing ${testUrls.length} sample images with ${resolutionTests.length} resolution patterns...`);
    
    for (const resTest of resolutionTests) {
        console.log(`\n📐 Testing ${resTest.name} (${resTest.pattern}):`);
        
        const testResults = [];
        for (let i = 0; i < testUrls.length; i++) {
            const originalUrl = testUrls[i];
            const testUrl = originalUrl.replace(/\/full\/full\/0\/default\.jpg$/, `/${resTest.pattern}`);
            
            try {
                const startTime = Date.now();
                const response = await fetchWithTimeout(testUrl, {}, 15000);
                const loadTime = Date.now() - startTime;
                
                const success = response.ok;
                const status = response.status;
                
                if (success) {
                    console.log(`  ✅ Page ${i + 1}: ${status} (${loadTime}ms)`);
                } else {
                    console.log(`  ❌ Page ${i + 1}: ${status} ${response.statusText} (${loadTime}ms)`);
                }
                
                testResults.push({
                    pageIndex: i + 1,
                    url: testUrl,
                    success,
                    status,
                    loadTime
                });
                
            } catch (error) {
                console.log(`  ❌ Page ${i + 1}: Error - ${error.message}`);
                testResults.push({
                    pageIndex: i + 1,
                    url: testUrl,
                    success: false,
                    error: error.message
                });
            }
        }
        
        const successCount = testResults.filter(r => r.success).length;
        const successRate = (successCount / testResults.length) * 100;
        
        console.log(`  📊 ${resTest.name}: ${successCount}/${testResults.length} successful (${successRate.toFixed(1)}%)`);
        
        results.push({
            resolutionName: resTest.name,
            pattern: resTest.pattern,
            testResults,
            successCount,
            successRate
        });
    }
    
    // Find best resolution pattern
    const bestResolution = results.reduce((best, current) => 
        current.successRate > best.successRate ? current : best
    );
    
    console.log(`\n🏆 Best resolution pattern: ${bestResolution.resolutionName} (${bestResolution.successRate.toFixed(1)}% success)`);
    
    return {
        success: true,
        results,
        bestResolution,
        testedUrls: testUrls.length,
        totalAvailable: pageLinks.length
    };
}

async function createValidationPdf(pageLinks, metadata, maxPages = 10) {
    console.log('\n📄 Step 5: Creating validation PDF...');
    
    if (!pageLinks || pageLinks.length === 0) {
        console.log('❌ No page links available for PDF creation');
        return { success: false, error: 'No page links available' };
    }
    
    // Ensure validation directory exists
    if (!fs.existsSync(VALIDATION_DIR)) {
        fs.mkdirSync(VALIDATION_DIR, { recursive: true });
        console.log(`📁 Created validation directory: ${VALIDATION_DIR}`);
    }
    
    const selectedPages = pageLinks.slice(0, Math.min(maxPages, pageLinks.length));
    const pdfFileName = 'FREIBURG-HS360A-VALIDATION.pdf';
    const pdfPath = path.join(VALIDATION_DIR, pdfFileName);
    
    console.log(`📥 Downloading ${selectedPages.length} pages for PDF validation...`);
    
    try {
        // Import the actual service to create the PDF
        const { spawn } = require('child_process');
        
        // Create a simple Node.js script to download images and create PDF
        const downloadScript = `
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const pageUrls = ${JSON.stringify(selectedPages)};
const tempDir = path.join('${VALIDATION_DIR}', 'temp-freiburg-images');
const pdfPath = '${pdfPath}';

async function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        const request = https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        });
        request.on('error', reject);
        request.setTimeout(30000, () => {
            request.destroy();
            reject(new Error('Download timeout'));
        });
    });
}

async function createPdf() {
    // Create temp directory
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    console.log('Downloading images...');
    const imagePaths = [];
    
    for (let i = 0; i < pageUrls.length; i++) {
        const url = pageUrls[i];
        const filename = \`page_\${String(i + 1).padStart(3, '0')}.jpg\`;
        const filepath = path.join(tempDir, filename);
        
        try {
            await downloadImage(url, filepath);
            imagePaths.push(filepath);
            console.log(\`✅ Downloaded page \${i + 1}/\${pageUrls.length}\`);
        } catch (error) {
            console.log(\`❌ Failed to download page \${i + 1}: \${error.message}\`);
        }
    }
    
    if (imagePaths.length === 0) {
        throw new Error('No images downloaded successfully');
    }
    
    console.log(\`Creating PDF with \${imagePaths.length} images...\`);
    
    // Use ImageMagick to create PDF
    return new Promise((resolve, reject) => {
        const convertArgs = [...imagePaths, pdfPath];
        const convert = spawn('convert', convertArgs);
        
        convert.on('close', (code) => {
            // Clean up temp directory
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
            } catch (e) {
                console.log('Note: Could not clean up temp directory');
            }
            
            if (code === 0) {
                console.log(\`✅ PDF created successfully: \${pdfPath}\`);
                resolve();
            } else {
                reject(new Error(\`ImageMagick convert failed with code \${code}\`));
            }
        });
        
        convert.on('error', reject);
    });
}

createPdf().catch(console.error);
`;
        
        // Write and execute the download script
        const scriptPath = path.join(VALIDATION_DIR, 'create-freiburg-pdf.js');
        fs.writeFileSync(scriptPath, downloadScript);
        
        await new Promise((resolve, reject) => {
            const process = spawn('node', [scriptPath], { stdio: 'inherit' });
            process.on('close', (code) => {
                fs.unlinkSync(scriptPath); // Clean up script
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`PDF creation failed with code ${code}`));
                }
            });
            process.on('error', reject);
        });
        
        // Verify PDF was created
        if (fs.existsSync(pdfPath)) {
            const stats = fs.statSync(pdfPath);
            console.log(`✅ PDF created successfully: ${pdfFileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
            
            return {
                success: true,
                pdfPath,
                pdfFileName,
                fileSize: stats.size,
                pageCount: selectedPages.length
            };
        } else {
            throw new Error('PDF file was not created');
        }
        
    } catch (error) {
        console.log(`❌ PDF creation failed: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}

async function runComprehensiveValidation() {
    const results = {
        testUrl: TEST_URL,
        timestamp: new Date().toISOString(),
        steps: {}
    };
    
    try {
        // Step 1: URL Parsing
        results.steps.urlParsing = await testUrlParsing();
        
        // Step 2: Metadata Extraction  
        results.steps.metadataExtraction = await testMetadataExtraction();
        
        // Step 3: METS XML Parsing
        results.steps.metsXmlParsing = await testMetsXmlParsing();
        
        // Step 4: Image Resolution Testing
        if (results.steps.metsXmlParsing.success && results.steps.metsXmlParsing.pageLinks) {
            results.steps.imageResolution = await testImageResolution(results.steps.metsXmlParsing.pageLinks);
        }
        
        // Step 5: PDF Validation
        if (results.steps.metsXmlParsing.success && results.steps.metsXmlParsing.pageLinks) {
            results.steps.pdfCreation = await createValidationPdf(
                results.steps.metsXmlParsing.pageLinks,
                results.steps.metadataExtraction,
                10
            );
        }
        
        // Generate summary
        const successfulSteps = Object.values(results.steps).filter(step => step.success).length;
        const totalSteps = Object.keys(results.steps).length;
        
        console.log('\n📊 VALIDATION SUMMARY');
        console.log('='.repeat(50));
        console.log(`✅ Successful steps: ${successfulSteps}/${totalSteps}`);
        console.log(`📋 Test URL: ${TEST_URL}`);
        
        if (results.steps.metadataExtraction?.success) {
            console.log(`📖 Manuscript: ${results.steps.metadataExtraction.displayName}`);
        }
        
        if (results.steps.metsXmlParsing?.success) {
            console.log(`📄 Total pages discovered: ${results.steps.metsXmlParsing.totalPages}`);
        }
        
        if (results.steps.imageResolution?.success) {
            console.log(`🖼️ Best resolution: ${results.steps.imageResolution.bestResolution.resolutionName}`);
        }
        
        if (results.steps.pdfCreation?.success) {
            console.log(`📄 Validation PDF: ${results.steps.pdfCreation.pdfFileName}`);
        }
        
        console.log('='.repeat(50));
        
        // Save detailed results
        const resultsFile = path.join(VALIDATION_DIR, 'freiburg-validation-results.json');
        fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
        console.log(`💾 Detailed results saved to: ${resultsFile}`);
        
        return results;
        
    } catch (error) {
        console.error(`❌ Validation failed: ${error.message}`);
        results.error = error.message;
        return results;
    }
}

// Run the validation
runComprehensiveValidation().then((results) => {
    const success = Object.values(results.steps).every(step => step.success);
    process.exit(success ? 0 : 1);
}).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});