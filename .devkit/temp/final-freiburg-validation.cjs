#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const TEST_URL = 'https://dl.ub.uni-freiburg.de/diglit/hs360a/0001';
const VALIDATION_DIR = path.join(process.cwd(), 'CURRENT-VALIDATION');

async function loadFreiburgManifest(originalUrl) {
    try {
        console.log(`Loading Freiburg manuscript from: ${originalUrl}`);
        
        const manuscriptMatch = originalUrl.match(/\/diglit\/([^/?]+)/);
        if (!manuscriptMatch) {
            throw new Error('Invalid Freiburg URL format - cannot extract manuscript ID');
        }
        
        const manuscriptId = manuscriptMatch[1];
        console.log(`Extracted manuscript ID: ${manuscriptId}`);
        
        // Get manuscript metadata from the main page
        const metadataUrl = `https://dl.ub.uni-freiburg.de/diglit/${manuscriptId}`;
        console.log(`Fetching metadata from: ${metadataUrl}`);
        
        const metadataResponse = await fetch(metadataUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!metadataResponse.ok) {
            throw new Error(`HTTP ${metadataResponse.status}: ${metadataResponse.statusText}`);
        }
        
        const metadataHtml = await metadataResponse.text();
        
        // Parse metadata to extract title
        let displayName = `Freiburg Manuscript ${manuscriptId}`;
        
        // Extract title from HTML - look for the text content
        const titleMatch = metadataHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i) || 
                          metadataHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1].trim()) {
            displayName = titleMatch[1].trim();
        }
        
        console.log(`Extracted display name: ${displayName}`);
        
        // Fetch METS XML metadata for page information
        const metsUrl = `https://dl.ub.uni-freiburg.de/diglit/${manuscriptId}/mets`;
        console.log(`Fetching METS XML from: ${metsUrl}`);
        
        const metsResponse = await fetch(metsUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/xml,text/xml,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!metsResponse.ok) {
            throw new Error(`Failed to fetch METS XML: HTTP ${metsResponse.status}`);
        }
        
        const metsXml = await metsResponse.text();
        console.log(`METS XML length: ${metsXml.length} characters`);
        console.log(`Final METS URL after redirect: ${metsResponse.url}`);
        
        // Extract title from MODS if available
        const modsTitle = metsXml.match(/<mods:title[^>]*>([^<]+)<\/mods:title>/);
        if (modsTitle && modsTitle[1].trim()) {
            displayName = modsTitle[1].trim();
            console.log(`Updated display name from MODS: ${displayName}`);
        }
        
        // Parse METS to find maximum resolution images
        const pageLinks = [];
        
        // Look for fileGrp USE="MAX" first (highest resolution)
        const maxFileGrpMatch = metsXml.match(/<mets:fileGrp[^>]+USE="MAX"[^>]*>(.*?)<\/mets:fileGrp>/s);
        
        if (maxFileGrpMatch) {
            console.log('Found MAX resolution file group');
            
            // Extract all file entries from MAX group
            const fileMatches = maxFileGrpMatch[1].match(/<mets:file[^>]*>.*?<\/mets:file>/gs);
            
            if (fileMatches) {
                fileMatches.forEach((fileBlock, index) => {
                    const hrefMatch = fileBlock.match(/xlink:href="([^"]+)"/);
                    if (hrefMatch && hrefMatch[1].includes('.jpg')) {
                        pageLinks.push(hrefMatch[1]);
                        if (index < 5) {
                            console.log(`Added page ${index + 1}: ${hrefMatch[1].split('/').pop()}`);
                        }
                    }
                });
            }
        }
        
        // Fallback to any file group if MAX not found
        if (pageLinks.length === 0) {
            console.log('MAX group not found, using fallback approach');
            
            const allFileMatches = metsXml.match(/<mets:file[^>]*MIMETYPE="image\/jpg"[^>]*>.*?<\/mets:file>/gs);
            if (allFileMatches) {
                // Take every 4th file to get highest resolution (assuming groups are MIN, DEFAULT, PRINT, MAX)
                for (let i = 3; i < allFileMatches.length; i += 4) {
                    const hrefMatch = allFileMatches[i].match(/xlink:href="([^"]+)"/);
                    if (hrefMatch && hrefMatch[1].includes('.jpg')) {
                        pageLinks.push(hrefMatch[1]);
                    }
                }
            }
        }
        
        if (pageLinks.length === 0) {
            throw new Error('No valid pages found in METS XML structure');
        }
        
        if (pageLinks.length > 5) {
            console.log(`... and ${pageLinks.length - 5} more pages`);
        }
        
        console.log(`Successfully extracted ${pageLinks.length} page links`);
        
        return {
            pageLinks: pageLinks,
            totalPages: pageLinks.length,
            library: 'freiburg',
            displayName: displayName,
            originalUrl: originalUrl
        };
        
    } catch (error) {
        console.error('Freiburg manifest loading error:', error);
        throw new Error(`Failed to load Freiburg manuscript: ${error.message}`);
    }
}

async function testImageAvailability(pageLinks, sampleSize = 5) {
    console.log(`\\n🖼️ Testing image availability (${sampleSize} samples)...`);
    
    const testUrls = pageLinks.slice(0, sampleSize);
    const results = [];
    
    for (let i = 0; i < testUrls.length; i++) {
        const url = testUrls[i];
        try {
            const startTime = Date.now();
            const response = await fetch(url, {
                method: 'HEAD',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'image/*,*/*;q=0.8'
                }
            });
            const loadTime = Date.now() - startTime;
            
            const success = response.ok;
            const status = response.status;
            const contentLength = response.headers.get('content-length');
            const sizeKB = contentLength ? Math.round(parseInt(contentLength) / 1024) : null;
            
            if (success) {
                console.log(`  ✅ Page ${i + 1}: ${status} - ${sizeKB ? sizeKB + 'KB' : 'unknown size'} (${loadTime}ms)`);
            } else {
                console.log(`  ❌ Page ${i + 1}: ${status} ${response.statusText} (${loadTime}ms)`);
            }
            
            results.push({
                pageIndex: i + 1,
                url,
                success,
                status,
                loadTime,
                sizeKB
            });
            
        } catch (error) {
            console.log(`  ❌ Page ${i + 1}: Error - ${error.message}`);
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
    
    console.log(`📊 Image availability: ${successCount}/${results.length} successful (${successRate.toFixed(1)}%)`);
    
    return {
        results,
        successCount,
        successRate,
        testedUrls: testUrls.length
    };
}

async function downloadImage(url, filepath) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'image/*,*/*;q=0.8'
        }
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(filepath, Buffer.from(arrayBuffer));
}

async function createValidationPdf(pageLinks, displayName, maxPages = 10) {
    console.log(`\\n📄 Creating validation PDF with ${Math.min(maxPages, pageLinks.length)} pages...`);
    
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
        
        console.log(`📥 Downloading ${selectedPages.length} images...`);
        
        const imagePaths = [];
        
        for (let i = 0; i < selectedPages.length; i++) {
            const url = selectedPages[i];
            const filename = `page_${String(i + 1).padStart(3, '0')}.jpg`;
            const filepath = path.join(tempDir, filename);
            
            try {
                await downloadImage(url, filepath);
                imagePaths.push(filepath);
                console.log(`✅ Downloaded page ${i + 1}/${selectedPages.length}: ${url.split('/').pop()}`);
            } catch (error) {
                console.log(`❌ Failed to download page ${i + 1}: ${error.message}`);
            }
        }
        
        if (imagePaths.length === 0) {
            throw new Error('No images downloaded successfully');
        }
        
        console.log(`Creating PDF with ${imagePaths.length} images...`);
        
        // Use ImageMagick to create PDF
        return new Promise((resolve, reject) => {
            const convertArgs = [...imagePaths, pdfPath];
            const convert = spawn('convert', convertArgs);
            
            let stderr = '';
            convert.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            convert.on('close', (code) => {
                // Clean up temp directory
                try {
                    fs.rmSync(tempDir, { recursive: true, force: true });
                } catch (e) {
                    console.log('Note: Could not clean up temp directory');
                }
                
                if (code === 0) {
                    console.log(`✅ PDF created successfully: ${pdfFileName}`);
                    
                    // Verify PDF
                    if (fs.existsSync(pdfPath)) {
                        const stats = fs.statSync(pdfPath);
                        console.log(`📄 PDF size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
                        
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
                    reject(new Error(`ImageMagick convert failed with code ${code}: ${stderr}`));
                }
            });
            
            convert.on('error', (error) => {
                reject(new Error(`Failed to spawn convert: ${error.message}`));
            });
        });
        
    } catch (error) {
        console.log(`❌ PDF creation failed: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}

async function runValidation() {
    console.log('🔍 COMPREHENSIVE FREIBURG VALIDATION');
    console.log('='.repeat(50));
    console.log(`📋 Test URL: ${TEST_URL}`);
    console.log(`📁 Validation folder: ${VALIDATION_DIR}`);
    
    const startTime = Date.now();
    
    try {
        // Step 1: Load manifest
        console.log('\\n📄 Step 1: Loading manuscript manifest...');
        const manifest = await loadFreiburgManifest(TEST_URL);
        
        console.log(`✅ Manifest loaded successfully`);
        console.log(`📖 Title: ${manifest.displayName}`);
        console.log(`📄 Total pages: ${manifest.totalPages}`);
        
        // Step 2: Test image availability
        const imageTest = await testImageAvailability(manifest.pageLinks, 5);
        
        // Step 3: Create validation PDF
        const pdfResult = await createValidationPdf(manifest.pageLinks, manifest.displayName, 10);
        
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        
        // Summary
        console.log('\\n📊 VALIDATION SUMMARY');
        console.log('='.repeat(50));
        console.log(`✅ Manifest loading: SUCCESS`);
        console.log(`📖 Manuscript: ${manifest.displayName}`);
        console.log(`📄 Total pages discovered: ${manifest.totalPages}`);
        console.log(`🖼️ Image availability: ${imageTest.successRate.toFixed(1)}% (${imageTest.successCount}/${imageTest.testedUrls})`);
        
        if (pdfResult.success) {
            console.log(`📄 Validation PDF: ${pdfResult.pdfFileName} (${(pdfResult.fileSize / 1024 / 1024).toFixed(2)} MB)`);
            console.log(`📄 PDF pages: ${pdfResult.pageCount}`);
        } else {
            console.log(`❌ PDF creation failed: ${pdfResult.error}`);
        }
        
        console.log(`⏱️ Total validation time: ${totalTime}s`);
        console.log('='.repeat(50));
        
        // Save results
        const results = {
            testUrl: TEST_URL,
            timestamp: new Date().toISOString(),
            validationTimeSeconds: parseFloat(totalTime),
            manifest,
            imageTest,
            pdfResult
        };
        
        const resultsFile = path.join(VALIDATION_DIR, 'freiburg-validation-results.json');
        fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
        console.log(`💾 Detailed results saved to: ${resultsFile}`);
        
        // Final assessment
        const overallSuccess = manifest.totalPages > 0 && 
                              imageTest.successRate >= 80 && 
                              pdfResult.success;
        
        if (overallSuccess) {
            console.log('\\n🎉 VALIDATION PASSED!');
            console.log('University of Freiburg implementation is working correctly.');
            console.log('✅ METS XML parsing successful');
            console.log('✅ Maximum resolution images accessible');  
            console.log('✅ PDF generation successful');
            console.log('\\n📂 Ready for user validation of PDF files');
        } else {
            console.log('\\n⚠️ VALIDATION ISSUES DETECTED');
            if (manifest.totalPages === 0) console.log('❌ No pages discovered');
            if (imageTest.successRate < 80) console.log('❌ Low image accessibility');
            if (!pdfResult.success) console.log('❌ PDF creation failed');
        }
        
        return results;
        
    } catch (error) {
        console.error(`\\n❌ VALIDATION FAILED: ${error.message}`);
        throw error;
    }
}

runValidation().catch((error) => {
    console.error('Fatal validation error:', error);
    process.exit(1);
});