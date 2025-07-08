#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

async function validateBelgicaKBRImplementation() {
    console.log('🔍 BELGICA KBR ADVANCED VALIDATION');
    console.log('Testing different pages and resolution options...');
    console.log('=' * 80);

    const testUrl = 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415';
    const validationDir = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/belgica-advanced-validation';
    
    try {
        await fs.mkdir(validationDir, { recursive: true });
        
        // Step 1: Extract digital document ID
        console.log('\n📋 Step 1: Extract Document Information');
        const docResponse = await fetch(testUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (!docResponse.ok) {
            throw new Error(`Failed to fetch document page: ${docResponse.status}`);
        }
        
        const docHtml = await docResponse.text();
        const digitalIdMatch = docHtml.match(/DigitalCollectionThumbnailHandler\.ashx\?documentId=(\d+)/);
        
        if (!digitalIdMatch) {
            throw new Error('Could not extract digital document ID');
        }
        
        const digitalDocumentId = digitalIdMatch[1];
        console.log(`✅ Digital Document ID: ${digitalDocumentId}`);
        
        // Step 2: Test different sizes for maximum resolution
        console.log('\n🔍 Step 2: Test All Size Options for Maximum Resolution');
        const baseUrl = 'https://belgica.kbr.be/Ils/digitalCollection/DigitalCollectionThumbnailHandler.ashx';
        const sizeOptions = ['SMALL', 'MEDIUM', 'LARGE', 'XLARGE', 'FULL', 'ORIGINAL', 'MAX', 'HIGHEST'];
        const sizeResults = {};
        
        for (const size of sizeOptions) {
            try {
                const testUrl = `${baseUrl}?documentId=${digitalDocumentId}&page=1&size=${size}`;
                const response = await fetch(testUrl, {
                    method: 'HEAD',
                    headers: {
                        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
                    }
                });
                
                if (response.ok) {
                    const contentType = response.headers.get('content-type');
                    const contentLength = parseInt(response.headers.get('content-length') || '0');
                    
                    if (contentType && contentType.startsWith('image/')) {
                        sizeResults[size] = {
                            status: 'success',
                            contentType,
                            contentLength,
                            url: testUrl
                        };
                        console.log(`  ${size.padEnd(8)}: ${contentType}, ${contentLength.toLocaleString()} bytes`);
                    }
                } else {
                    sizeResults[size] = { status: 'failed', httpStatus: response.status };
                    console.log(`  ${size.padEnd(8)}: HTTP ${response.status}`);
                }
            } catch (error) {
                sizeResults[size] = { status: 'error', error: error.message };
                console.log(`  ${size.padEnd(8)}: Error - ${error.message}`);
            }
        }
        
        // Find best size
        const successfulSizes = Object.entries(sizeResults)
            .filter(([_, result]) => result.status === 'success')
            .sort((a, b) => b[1].contentLength - a[1].contentLength);
        
        if (successfulSizes.length === 0) {
            throw new Error('No working size options found');
        }
        
        const [bestSize, bestResult] = successfulSizes[0];
        console.log(`\n✅ Best Resolution: ${bestSize} (${bestResult.contentLength.toLocaleString()} bytes)`);
        
        // Step 3: Test multiple pages to check for content variation
        console.log('\n📄 Step 3: Test Multiple Pages for Content Variation');
        const pagesToTest = [1, 2, 3, 4, 5, 10, 20, 50];
        const pageResults = {};
        const downloadedFiles = [];
        
        for (const pageNum of pagesToTest) {
            try {
                const pageUrl = `${baseUrl}?documentId=${digitalDocumentId}&page=${pageNum}&size=${bestSize}`;
                const response = await fetch(pageUrl, {
                    headers: {
                        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                
                if (response.ok) {
                    const contentType = response.headers.get('content-type');
                    const contentLength = parseInt(response.headers.get('content-length') || '0');
                    
                    if (contentType && contentType.startsWith('image/') && contentLength > 1000) {
                        // Download the image to check content
                        const imageBuffer = await response.arrayBuffer();
                        const fileName = `page-${pageNum.toString().padStart(3, '0')}.jpg`;
                        const filePath = path.join(validationDir, fileName);
                        await fs.writeFile(filePath, Buffer.from(imageBuffer));
                        downloadedFiles.push(filePath);
                        
                        pageResults[pageNum] = {
                            status: 'success',
                            contentType,
                            contentLength,
                            filePath,
                            url: pageUrl
                        };
                        
                        console.log(`  Page ${pageNum.toString().padStart(2)}: ✅ ${contentLength.toLocaleString()} bytes`);
                    } else {
                        pageResults[pageNum] = {
                            status: 'invalid_content',
                            contentType,
                            contentLength
                        };
                        console.log(`  Page ${pageNum.toString().padStart(2)}: ❌ Invalid content (${contentLength} bytes)`);
                    }
                } else {
                    pageResults[pageNum] = {
                        status: 'http_error',
                        httpStatus: response.status
                    };
                    console.log(`  Page ${pageNum.toString().padStart(2)}: ❌ HTTP ${response.status}`);
                }
            } catch (error) {
                pageResults[pageNum] = {
                    status: 'error',
                    error: error.message
                };
                console.log(`  Page ${pageNum.toString().padStart(2)}: ❌ Error - ${error.message}`);
            }
        }
        
        const validPages = Object.keys(pageResults).filter(page => pageResults[page].status === 'success');
        console.log(`\n✅ Valid Pages Found: ${validPages.length}/${pagesToTest.length}`);
        console.log(`📁 Downloaded Files: ${downloadedFiles.length}`);
        
        // Step 4: Check for duplicate content (same file sizes might indicate identical images)
        console.log('\n🔍 Step 4: Analyze Content Variation');
        const fileSizes = {};
        const validPageResults = Object.entries(pageResults).filter(([_, result]) => result.status === 'success');
        
        for (const [pageNum, result] of validPageResults) {
            const size = result.contentLength;
            if (!fileSizes[size]) {
                fileSizes[size] = [];
            }
            fileSizes[size].push(pageNum);
        }
        
        console.log('File Size Analysis:');
        for (const [size, pages] of Object.entries(fileSizes)) {
            console.log(`  ${parseInt(size).toLocaleString().padStart(8)} bytes: Pages ${pages.join(', ')}`);
        }
        
        const duplicateSizes = Object.values(fileSizes).filter(pages => pages.length > 1);
        if (duplicateSizes.length > 0) {
            console.log(`\n⚠️  WARNING: ${duplicateSizes.length} groups of pages have identical file sizes`);
            console.log('   This may indicate the same image is returned for multiple page numbers');
            console.log('   (Common for cover/binding images or restricted access)');
        } else {
            console.log('\n✅ All pages have different file sizes - indicates genuine content variation');
        }
        
        // Step 5: Generate comprehensive report
        const report = {
            timestamp: new Date().toISOString(),
            testUrl,
            digitalDocumentId,
            sizeResults,
            bestSize,
            bestResolution: bestResult,
            pageResults,
            validPages: validPages.length,
            totalPagesTested: pagesToTest.length,
            downloadedFiles: downloadedFiles.length,
            fileSizeAnalysis: fileSizes,
            potentialDuplicates: duplicateSizes.length,
            recommendations: []
        };
        
        // Generate recommendations
        if (validPages.length === 0) {
            report.recommendations.push('CRITICAL: No valid pages found - implementation may be broken');
        } else if (validPages.length < 3) {
            report.recommendations.push('LIMITED: Very few pages accessible - may indicate restrictions');
        }
        
        if (duplicateSizes.length > 0) {
            report.recommendations.push('DUPLICATE_CONTENT: Multiple pages return identical images - likely cover/binding only');
        }
        
        if (bestResult.contentLength < 10000) {
            report.recommendations.push('LOW_QUALITY: Images are very small - investigate higher resolution options');
        }
        
        const reportPath = path.join(validationDir, 'validation-report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
        console.log('\n' + '=' * 80);
        console.log('📊 VALIDATION SUMMARY');
        console.log('=' * 80);
        console.log(`Digital Document ID: ${digitalDocumentId}`);
        console.log(`Best Resolution: ${bestSize} (${bestResult.contentLength.toLocaleString()} bytes)`);
        console.log(`Valid Pages: ${validPages.length}/${pagesToTest.length}`);
        console.log(`Downloaded Images: ${downloadedFiles.length}`);
        console.log(`Potential Duplicates: ${duplicateSizes.length > 0 ? 'YES' : 'NO'}`);
        console.log(`Report Location: ${reportPath}`);
        console.log(`Images Location: ${validationDir}`);
        
        if (report.recommendations.length > 0) {
            console.log('\n🎯 RECOMMENDATIONS:');
            report.recommendations.forEach(rec => console.log(`   ${rec}`));
        }
        
        console.log('\n✅ Advanced validation completed successfully');
        return report;
        
    } catch (error) {
        console.error('\n❌ Advanced validation failed:', error.message);
        throw error;
    }
}

if (require.main === module) {
    validateBelgicaKBRImplementation()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { validateBelgicaKBRImplementation };