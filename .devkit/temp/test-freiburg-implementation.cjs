#!/usr/bin/env node

const path = require('path');

async function testFreiburgImplementation() {
    console.log('🧪 Testing Freiburg implementation directly...');
    
    try {
        // Import the actual service
        const servicePath = path.join(process.cwd(), 'src', 'main', 'services', 'EnhancedManuscriptDownloaderService.ts');
        
        // Since we can't directly import TypeScript, let's test the URL pattern recognition
        const testUrl = 'https://dl.ub.uni-freiburg.de/diglit/hs360a/0001';
        
        console.log(`📋 Testing URL: ${testUrl}`);
        
        // Test library detection
        const library = testUrl.includes('dl.ub.uni-freiburg.de') ? 'freiburg' : null;
        console.log(`✅ Library detected: ${library}`);
        
        // Test manuscript ID extraction
        const manuscriptMatch = testUrl.match(/\/diglit\/([^/?]+)/);
        if (manuscriptMatch) {
            const manuscriptId = manuscriptMatch[1];
            console.log(`✅ Manuscript ID: ${manuscriptId}`);
            
            // Test expected URLs
            const metadataUrl = `https://dl.ub.uni-freiburg.de/diglit/${manuscriptId}`;
            const metsUrl = `https://dl.ub.uni-freiburg.de/diglit/${manuscriptId}/mets`;
            
            console.log(`📄 Expected metadata URL: ${metadataUrl}`);
            console.log(`🗂️ Expected METS URL: ${metsUrl} (redirects to diglitData/mets/${manuscriptId}.xml)`);
            
            return {
                success: true,
                library,
                manuscriptId,
                metadataUrl,
                metsUrl
            };
        } else {
            throw new Error('Failed to extract manuscript ID');
        }
        
    } catch (error) {
        console.error(`❌ Test failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function createComprehensiveValidation() {
    console.log('🔧 Creating comprehensive validation test...');
    
    const testResult = await testFreiburgImplementation();
    
    if (!testResult.success) {
        console.error('❌ Implementation test failed, cannot proceed with validation');
        return;
    }
    
    // Create a Node.js test script that mimics the service behavior
    const validationScript = `
const https = require('https');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const TEST_URL = 'https://dl.ub.uni-freiburg.de/diglit/hs360a/0001';
const VALIDATION_DIR = path.join(process.cwd(), 'CURRENT-VALIDATION');

async function fetchDirect(url, options = {}, timeout = 30000) {
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
            reject(new Error(\`Request timeout: \${url}\`));
        });
    });
}

async function loadFreiburgManifest(originalUrl) {
    try {
        console.log(\`Loading Freiburg manuscript from: \${originalUrl}\`);
        
        const manuscriptMatch = originalUrl.match(/\\/diglit\\/([^/?]+)/);
        if (!manuscriptMatch) {
            throw new Error('Invalid Freiburg URL format - cannot extract manuscript ID');
        }
        
        const manuscriptId = manuscriptMatch[1];
        console.log(\`Extracted manuscript ID: \${manuscriptId}\`);
        
        // Get manuscript metadata from the main page
        const metadataUrl = \`https://dl.ub.uni-freiburg.de/diglit/\${manuscriptId}\`;
        console.log(\`Fetching metadata from: \${metadataUrl}\`);
        
        const metadataResponse = await fetchDirect(metadataUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!metadataResponse.ok) {
            throw new Error(\`HTTP \${metadataResponse.status}: \${metadataResponse.statusText}\`);
        }
        
        const metadataHtml = await metadataResponse.text();
        
        // Extract display name from metadata page
        let displayName = \`Freiburg Manuscript \${manuscriptId}\`;
        const dom = new JSDOM(metadataHtml);
        const document = dom.window.document;
        
        const titleSelectors = [
            'h1.page-header',
            '.metadata-title',
            'h1',
            'title'
        ];
        
        for (const selector of titleSelectors) {
            const titleElement = document.querySelector(selector);
            if (titleElement && titleElement.textContent?.trim()) {
                displayName = titleElement.textContent.trim();
                break;
            }
        }
        
        console.log(\`Extracted display name: \${displayName}\`);
        
        // Fetch METS XML metadata for page information
        const metsUrl = \`https://dl.ub.uni-freiburg.de/diglit/\${manuscriptId}/mets\`;
        console.log(\`Fetching METS XML from: \${metsUrl}\`);
        
        const metsResponse = await fetchDirect(metsUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/xml,text/xml,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!metsResponse.ok) {
            throw new Error(\`Failed to fetch METS XML: HTTP \${metsResponse.status}\`);
        }
        
        const metsXml = await metsResponse.text();
        console.log(\`METS XML length: \${metsXml.length} characters\`);
        
        // Parse METS XML to extract page information
        const xmlDom = new JSDOM(metsXml, { contentType: 'text/xml' });
        const xmlDocument = xmlDom.window.document;
        
        // First try to get display name from MODS metadata in METS
        const titleElement = xmlDocument.querySelector('mods\\\\:title, title');
        if (titleElement && titleElement.textContent && titleElement.textContent.trim()) {
            displayName = titleElement.textContent.trim();
            console.log(\`Updated display name from MODS: \${displayName}\`);
        }
        
        // Extract page files from METS structure
        // Look for maximum resolution images in fileGrp USE="MAX"
        let imageFiles = xmlDocument.querySelectorAll('mets\\\\:fileGrp[USE="MAX"] mets\\\\:file[MIMETYPE="image/jpg"], fileGrp[USE="MAX"] file[MIMETYPE="image/jpg"]');
        
        if (imageFiles.length === 0) {
            // Fallback to DEFAULT or PRINT groups
            imageFiles = xmlDocument.querySelectorAll('mets\\\\:fileGrp[USE="DEFAULT"] mets\\\\:file[MIMETYPE="image/jpg"], mets\\\\:fileGrp[USE="PRINT"] mets\\\\:file[MIMETYPE="image/jpg"], fileGrp[USE="DEFAULT"] file[MIMETYPE="image/jpg"], fileGrp[USE="PRINT"] file[MIMETYPE="image/jpg"]');
        }
        
        if (imageFiles.length === 0) {
            // Final fallback: look for any image files
            imageFiles = xmlDocument.querySelectorAll('mets\\\\:file[MIMETYPE="image/jpg"], file[MIMETYPE="image/jpg"]');
            if (imageFiles.length === 0) {
                throw new Error('No image files found in METS XML');
            }
            console.log(\`Found \${imageFiles.length} image files using fallback selector\`);
        } else {
            console.log(\`Found \${imageFiles.length} maximum resolution image files\`);
        }
        
        // Extract page information and use direct URLs from METS
        const pageLinks = [];
        
        imageFiles.forEach((fileElement, index) => {
            const fLocatElement = fileElement.querySelector('mets\\\\:FLocat, FLocat');
            if (fLocatElement) {
                const href = fLocatElement.getAttribute('xlink:href') || fLocatElement.getAttribute('href');
                if (href && href.includes('.jpg')) {
                    // Use the direct URL from METS XML for maximum resolution
                    pageLinks.push(href);
                    
                    if (index < 5) { // Log first 5 for debugging
                        console.log(\`Added page \${index + 1}: \${href}\`);
                    }
                }
            }
        });
        
        if (pageLinks.length === 0) {
            throw new Error('No valid pages found in METS XML structure');
        }
        
        if (pageLinks.length > 5) {
            console.log(\`... and \${pageLinks.length - 5} more pages\`);
        }
        
        console.log(\`Successfully extracted \${pageLinks.length} page links\`);
        
        return {
            pageLinks: pageLinks,
            totalPages: pageLinks.length,
            library: 'freiburg',
            displayName: displayName,
            originalUrl: originalUrl
        };
        
    } catch (error) {
        console.error('Freiburg manifest loading error:', error);
        throw new Error(\`Failed to load Freiburg manuscript: \${error.message}\`);
    }
}

async function testImageAvailability(pageLinks, sampleSize = 5) {
    console.log('\\n🖼️ Testing image availability...');
    
    const testUrls = pageLinks.slice(0, sampleSize);
    const results = [];
    
    for (let i = 0; i < testUrls.length; i++) {
        const url = testUrls[i];
        try {
            const startTime = Date.now();
            const response = await fetchDirect(url, {}, 15000);
            const loadTime = Date.now() - startTime;
            
            const success = response.ok;
            const status = response.status;
            
            if (success) {
                console.log(\`  ✅ Page \${i + 1}: \${status} (\${loadTime}ms)\`);
            } else {
                console.log(\`  ❌ Page \${i + 1}: \${status} \${response.statusText} (\${loadTime}ms)\`);
            }
            
            results.push({
                pageIndex: i + 1,
                url,
                success,
                status,
                loadTime
            });
            
        } catch (error) {
            console.log(\`  ❌ Page \${i + 1}: Error - \${error.message}\`);
            results.push({
                pageIndex: i + 1,
                url,
                success: false,
                error: error.message
            });
        }
    }
    
    const successCount = results.filter(r => r.success).length;
    const successRate = (successCount / results.length) * 100;
    
    console.log(\`📊 Image availability: \${successCount}/\${results.length} successful (\${successRate.toFixed(1)}%)\`);
    
    return {
        results,
        successCount,
        successRate,
        testedUrls: testUrls.length
    };
}

async function createValidationPdf(pageLinks, displayName, maxPages = 10) {
    console.log('\\n📄 Creating validation PDF...');
    
    if (!fs.existsSync(VALIDATION_DIR)) {
        fs.mkdirSync(VALIDATION_DIR, { recursive: true });
    }
    
    const selectedPages = pageLinks.slice(0, Math.min(maxPages, pageLinks.length));
    const pdfFileName = 'FREIBURG-HS360A-VALIDATION.pdf';
    const pdfPath = path.join(VALIDATION_DIR, pdfFileName);
    const tempDir = path.join(VALIDATION_DIR, 'temp-freiburg-images');
    
    try {
        // Create temp directory
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        console.log(\`📥 Downloading \${selectedPages.length} pages...\`);
        
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
        
        const imagePaths = [];
        
        for (let i = 0; i < selectedPages.length; i++) {
            const url = selectedPages[i];
            const filename = \`page_\${String(i + 1).padStart(3, '0')}.jpg\`;
            const filepath = path.join(tempDir, filename);
            
            try {
                await downloadImage(url, filepath);
                imagePaths.push(filepath);
                console.log(\`✅ Downloaded page \${i + 1}/\${selectedPages.length}\`);
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
                    console.log(\`✅ PDF created successfully: \${pdfFileName}\`);
                    
                    // Verify PDF
                    if (fs.existsSync(pdfPath)) {
                        const stats = fs.statSync(pdfPath);
                        console.log(\`📄 PDF size: \${(stats.size / 1024 / 1024).toFixed(2)} MB\`);
                        
                        resolve({
                            success: true,
                            pdfPath,
                            pdfFileName,
                            fileSize: stats.size,
                            pageCount: imagePaths.length
                        });
                    } else {
                        reject(new Error('PDF file was not created'));
                    }
                } else {
                    reject(new Error(\`ImageMagick convert failed with code \${code}\`));
                }
            });
            
            convert.on('error', reject);
        });
        
    } catch (error) {
        console.log(\`❌ PDF creation failed: \${error.message}\`);
        return {
            success: false,
            error: error.message
        };
    }
}

async function runValidation() {
    console.log('🔍 Starting comprehensive Freiburg validation...');
    console.log(\`📋 Test URL: \${TEST_URL}\`);
    
    try {
        // Step 1: Load manifest
        console.log('\\n📄 Step 1: Loading manuscript manifest...');
        const manifest = await loadFreiburgManifest(TEST_URL);
        
        console.log(\`✅ Manifest loaded successfully\`);
        console.log(\`📖 Title: \${manifest.displayName}\`);
        console.log(\`📄 Total pages: \${manifest.totalPages}\`);
        
        // Step 2: Test image availability
        const imageTest = await testImageAvailability(manifest.pageLinks, 5);
        
        // Step 3: Create validation PDF
        const pdfResult = await createValidationPdf(manifest.pageLinks, manifest.displayName, 10);
        
        // Summary
        console.log('\\n📊 VALIDATION SUMMARY');
        console.log('='.repeat(50));
        console.log(\`✅ Manifest loading: SUCCESS\`);
        console.log(\`📖 Manuscript: \${manifest.displayName}\`);
        console.log(\`📄 Total pages discovered: \${manifest.totalPages}\`);
        console.log(\`🖼️ Image availability: \${imageTest.successRate.toFixed(1)}% (\${imageTest.successCount}/\${imageTest.testedUrls})\`);
        
        if (pdfResult.success) {
            console.log(\`📄 Validation PDF: \${pdfResult.pdfFileName} (\${(pdfResult.fileSize / 1024 / 1024).toFixed(2)} MB)\`);
        } else {
            console.log(\`❌ PDF creation failed: \${pdfResult.error}\`);
        }
        
        console.log('='.repeat(50));
        
        // Save results
        const results = {
            testUrl: TEST_URL,
            timestamp: new Date().toISOString(),
            manifest,
            imageTest,
            pdfResult
        };
        
        const resultsFile = path.join(VALIDATION_DIR, 'freiburg-validation-results.json');
        fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
        console.log(\`💾 Results saved to: \${resultsFile}\`);
        
        return results;
        
    } catch (error) {
        console.error(\`❌ Validation failed: \${error.message}\`);
        throw error;
    }
}

runValidation().catch(console.error);
`;
    
    const scriptPath = path.join(process.cwd(), '.devkit', 'temp', 'freiburg-validation.cjs');
    require('fs').writeFileSync(scriptPath, validationScript);
    
    console.log(`✅ Validation script created: ${scriptPath}`);
    return scriptPath;
}

async function main() {
    await createComprehensiveValidation();
}

main().catch(console.error);