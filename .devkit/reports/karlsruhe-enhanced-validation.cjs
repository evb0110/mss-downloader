const https = require('https');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { execSync } = require('child_process');

class KarlsruheEnhancedValidator {
    constructor() {
        this.reportDir = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports';
        this.validationDir = path.join(this.reportDir, 'karlsruhe-enhanced-validation');
        
        if (!fs.existsSync(this.validationDir)) {
            fs.mkdirSync(this.validationDir, { recursive: true });
        }
    }

    async fetchJson(url) {
        return new Promise((resolve, reject) => {
            https.get(url, (response) => {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    try {
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            resolve(JSON.parse(data));
                        } else {
                            reject(new Error(`HTTP ${response.statusCode}`));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            }).on('error', reject);
        });
    }

    async downloadImage(url, filename) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(path.join(this.validationDir, filename));
            
            const startTime = Date.now();
            https.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }
                
                let totalBytes = 0;
                response.on('data', (chunk) => {
                    totalBytes += chunk.length;
                });
                
                response.pipe(file);
                
                file.on('finish', () => {
                    file.close();
                    const downloadTime = Date.now() - startTime;
                    resolve({
                        filename,
                        size: totalBytes,
                        downloadTime
                    });
                });
            }).on('error', reject);
        });
    }

    getImageDimensions(filename) {
        try {
            const filepath = path.join(this.validationDir, filename);
            const output = execSync(`identify -format "%wx%h" "${filepath}"`, { encoding: 'utf8' });
            const [width, height] = output.trim().split('x').map(Number);
            return { width, height };
        } catch (error) {
            console.warn(`Could not get dimensions for ${filename}: ${error.message}`);
            return null;
        }
    }

    // Simulate the enhanced loadKarlsruheManifest implementation
    generateEnhancedImageUrl(originalUrl) {
        // Extract webcache ID from URL like: https://digital.blb-karlsruhe.de/download/webcache/1000/221191
        const webcacheMatch = originalUrl.match(/webcache\/\d+\/(\d+)/);
        if (webcacheMatch) {
            return `https://digital.blb-karlsruhe.de/download/webcache/2000/${webcacheMatch[1]}`;
        }
        // Fallback to IIIF parameter (shouldn't happen with Karlsruhe)
        return originalUrl.replace('/full/full/0/default.jpg', '/full/2000,/0/default.jpg');
    }

    async validateEnhancedImplementation() {
        console.log('=== Karlsruhe Enhanced Implementation Validation ===\n');
        
        const testUrls = [
            'https://i3f.vls.io/?collection=i3fblbk&id=https%3A%2F%2Fdigital.blb-karlsruhe.de%2Fi3f%2Fv20%2F192435%2Fmanifest',
            'https://i3f.vls.io/?collection=i3fblbk&id=https%3A%2F%2Fdigital.blb-karlsruhe.de%2Fi3f%2Fv20%2F3464606%2Fmanifest'
        ];
        
        const allResults = [];
        
        for (let testIndex = 0; testIndex < testUrls.length; testIndex++) {
            const karlsruheUrl = testUrls[testIndex];
            console.log(`\nTesting manuscript ${testIndex + 1}:`);
            console.log(`URL: ${karlsruheUrl}`);
            
            try {
                // Extract manifest URL (simulate loadKarlsruheManifest logic)
                const urlParams = new URLSearchParams(new URL(karlsruheUrl).search);
                const encodedManifestUrl = urlParams.get('id');
                
                if (!encodedManifestUrl) {
                    throw new Error('Could not extract manifest URL');
                }
                
                const manifestUrl = decodeURIComponent(encodedManifestUrl);
                console.log(`Loading manifest: ${manifestUrl}`);
                
                const manifest = await this.fetchJson(manifestUrl);
                console.log('✓ Manifest loaded successfully');
                
                const manifestTitle = this.extractLabel(manifest);
                console.log(`✓ Title: ${manifestTitle}`);
                
                if (!manifest.sequences || manifest.sequences.length === 0) {
                    throw new Error('No sequences found');
                }
                
                const sequence = manifest.sequences[0];
                const canvases = sequence.canvases || [];
                console.log(`✓ Found ${canvases.length} pages`);
                
                // Test with multiple pages from this manuscript
                const testPages = Math.min(5, canvases.length);
                const manuscriptResults = [];
                
                console.log(`\nTesting ${testPages} pages with enhanced implementation:`);
                
                for (let i = 0; i < testPages; i++) {
                    const canvas = canvases[i];
                    const pageLabel = canvas.label || `Page ${i + 1}`;
                    
                    if (!canvas.images || canvas.images.length === 0) {
                        console.log(`  ✗ ${pageLabel}: No images found`);
                        continue;
                    }
                    
                    const image = canvas.images[0];
                    if (!image.resource || !image.resource['@id']) {
                        console.log(`  ✗ ${pageLabel}: No image resource found`);
                        continue;
                    }
                    
                    const originalUrl = image.resource['@id'];
                    const enhancedUrl = this.generateEnhancedImageUrl(originalUrl);
                    const filename = `manuscript-${testIndex + 1}-page-${i + 1}.jpg`;
                    
                    try {
                        const downloadResult = await this.downloadImage(enhancedUrl, filename);
                        const dimensions = this.getImageDimensions(filename);
                        
                        const result = {
                            manuscriptIndex: testIndex + 1,
                            manuscriptTitle: manifestTitle,
                            page: i + 1,
                            pageLabel,
                            originalUrl,
                            enhancedUrl,
                            filename,
                            size: downloadResult.size,
                            downloadTime: downloadResult.downloadTime,
                            dimensions,
                            success: true
                        };
                        
                        manuscriptResults.push(result);
                        
                        const sizeKB = Math.round(downloadResult.size / 1024);
                        const megapixels = dimensions ? 
                            ((dimensions.width * dimensions.height) / 1000000).toFixed(1) : 
                            'Unknown';
                        
                        console.log(`  ✓ ${pageLabel}: ${sizeKB}KB, ${dimensions?.width}x${dimensions?.height} (${megapixels}MP), ${downloadResult.downloadTime}ms`);
                        
                    } catch (error) {
                        console.log(`  ✗ ${pageLabel}: ${error.message}`);
                        manuscriptResults.push({
                            manuscriptIndex: testIndex + 1,
                            manuscriptTitle: manifestTitle,
                            page: i + 1,
                            pageLabel,
                            originalUrl,
                            enhancedUrl,
                            success: false,
                            error: error.message
                        });
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
                
                allResults.push(...manuscriptResults);
                
            } catch (error) {
                console.error(`  ✗ Manuscript ${testIndex + 1} failed: ${error.message}`);
                allResults.push({
                    manuscriptIndex: testIndex + 1,
                    success: false,
                    error: error.message
                });
            }
        }
        
        return allResults;
    }

    extractLabel(manifest) {
        if (!manifest.label) return 'Unknown';
        
        if (typeof manifest.label === 'string') {
            return manifest.label;
        } else if (Array.isArray(manifest.label)) {
            return manifest.label[0]?.['@value'] || manifest.label[0] || 'Unknown';
        } else if (manifest.label['@value']) {
            return manifest.label['@value'];
        }
        
        return 'Unknown';
    }

    analyzeValidationResults(results) {
        console.log('\n=== Enhanced Implementation Analysis ===\n');
        
        const successful = results.filter(r => r.success && r.dimensions);
        const failed = results.filter(r => !r.success);
        
        console.log(`✓ Successful downloads: ${successful.length}`);
        console.log(`✗ Failed downloads: ${failed.length}`);
        console.log(`📊 Success rate: ${Math.round((successful.length / results.length) * 100)}%\n`);
        
        if (successful.length === 0) {
            console.log('❌ No successful downloads to analyze');
            return { success: false };
        }
        
        // Analyze quality metrics
        const avgSize = successful.reduce((sum, r) => sum + r.size, 0) / successful.length;
        const avgTime = successful.reduce((sum, r) => sum + r.downloadTime, 0) / successful.length;
        
        // Check resolution consistency
        const resolutions = successful.map(r => `${r.dimensions.width}x${r.dimensions.height}`);
        const uniqueResolutions = new Set(resolutions);
        
        console.log('Quality Metrics:');
        console.log(`Average file size: ${Math.round(avgSize / 1024)}KB`);
        console.log(`Average download time: ${Math.round(avgTime)}ms`);
        console.log(`Unique resolutions: ${uniqueResolutions.size}`);
        
        // Display resolution breakdown
        if (uniqueResolutions.size > 0) {
            console.log('\nResolution Analysis:');
            Array.from(uniqueResolutions).forEach(resolution => {
                const count = resolutions.filter(r => r === resolution).length;
                const [width, height] = resolution.split('x').map(Number);
                const megapixels = ((width * height) / 1000000).toFixed(1);
                console.log(`  ${resolution} (${megapixels}MP): ${count} pages`);
            });
        }
        
        // Check if we achieved the expected high resolution
        const highResPages = successful.filter(r => 
            r.dimensions.width >= 2000 && r.dimensions.height >= 2000
        );
        
        console.log('\n=== Resolution Upgrade Verification ===');
        
        if (highResPages.length > 0) {
            console.log(`🚀 SUCCESS: ${highResPages.length}/${successful.length} pages achieved ultra-high resolution (≥2000px)`);
            console.log(`Expected: 2000x2801 (5.6MP)`);
            
            const samplePage = highResPages[0];
            const actualPixels = samplePage.dimensions.width * samplePage.dimensions.height;
            const expectedPixels = 2000 * 2801;
            const match = Math.abs(actualPixels - expectedPixels) / expectedPixels < 0.1;
            
            console.log(`Actual: ${samplePage.dimensions.width}x${samplePage.dimensions.height} (${(actualPixels/1000000).toFixed(1)}MP)`);
            console.log(`Match expected: ${match ? '✅ YES' : '❌ NO'}`);
        } else {
            console.log('❌ FAILED: No pages achieved expected ultra-high resolution');
            console.log('Implementation may need debugging');
        }
        
        if (failed.length > 0) {
            console.log('\nFailed Downloads:');
            failed.forEach(failure => {
                console.log(`  ✗ Manuscript ${failure.manuscriptIndex} ${failure.pageLabel || 'Unknown'}: ${failure.error}`);
            });
        }
        
        return {
            success: successful.length > 0,
            successRate: Math.round((successful.length / results.length) * 100),
            avgSizeKB: Math.round(avgSize / 1024),
            avgTimeMs: Math.round(avgTime),
            highResCount: highResPages.length,
            expectedResolution: highResPages.length > 0
        };
    }

    async createValidationPDF(results) {
        console.log('\n=== Creating Validation PDF ===');
        
        const successful = results.filter(r => r.success && r.filename);
        
        if (successful.length === 0) {
            console.log('❌ No successful downloads to include in PDF');
            return null;
        }
        
        const pdfPath = path.join(this.validationDir, 'karlsruhe-enhanced-validation.pdf');
        
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ autoFirstPage: false });
            doc.pipe(fs.createWriteStream(pdfPath));
            
            // Title page
            doc.addPage();
            doc.fontSize(20).text('Karlsruhe BLB Enhanced Resolution Validation', 50, 50);
            doc.fontSize(12).text(`Generated: ${new Date().toISOString()}`, 50, 80);
            doc.text(`Enhanced implementation with webcache/2000/ direct access`, 50, 100);
            doc.text(`Pages validated: ${successful.length}`, 50, 120);
            
            // Add each page
            successful.forEach((result, index) => {
                const imagePath = path.join(this.validationDir, result.filename);
                
                if (fs.existsSync(imagePath)) {
                    doc.addPage();
                    
                    // Page info
                    const title = `${result.manuscriptTitle} - ${result.pageLabel}`;
                    const info = `${Math.round(result.size / 1024)}KB - ${result.dimensions?.width}x${result.dimensions?.height}`;
                    
                    doc.fontSize(12).text(title, 50, 50);
                    doc.fontSize(10).text(info, 50, 70);
                    
                    try {
                        doc.image(imagePath, 50, 90, { fit: [495, 700] });
                    } catch (error) {
                        doc.text(`Error loading image: ${error.message}`, 50, 90);
                    }
                }
            });
            
            doc.end();
            doc.on('end', () => {
                console.log(`✓ Validation PDF created: ${pdfPath}`);
                resolve(pdfPath);
            });
            doc.on('error', reject);
        });
    }

    async saveValidationReport(results, analysis) {
        const report = {
            timestamp: new Date().toISOString(),
            validationType: 'Karlsruhe Enhanced Implementation',
            implementation: {
                description: 'Direct webcache/2000/ access for ultra-high resolution',
                expectedResolution: '2000x2801 (5.6MP)',
                expectedImprovement: '+305% file size vs IIIF API'
            },
            results,
            analysis,
            conclusion: analysis.expectedResolution ? 
                'Enhanced implementation successfully provides ultra-high resolution' :
                'Enhanced implementation needs debugging'
        };

        const reportPath = path.join(this.reportDir, 'karlsruhe-enhanced-validation-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\nValidation report saved: ${reportPath}`);
    }

    cleanup() {
        // Keep validation files for user inspection
        console.log(`\nValidation files preserved in: ${this.validationDir}`);
        console.log('Files ready for user inspection and quality verification');
    }
}

async function main() {
    const validator = new KarlsruheEnhancedValidator();
    
    try {
        const results = await validator.validateEnhancedImplementation();
        const analysis = validator.analyzeValidationResults(results);
        const pdfPath = await validator.createValidationPDF(results);
        await validator.saveValidationReport(results, analysis);
        
        console.log('\n=== Enhanced Implementation Validation Complete ===');
        
        if (analysis.success && analysis.expectedResolution) {
            console.log('🎉 SUCCESS: Enhanced implementation working correctly');
            console.log(`✓ ${analysis.successRate}% success rate`);
            console.log(`✓ ${analysis.highResCount} pages achieved ultra-high resolution`);
            console.log(`✓ Average: ${analysis.avgSizeKB}KB per page`);
            if (pdfPath) {
                console.log(`✓ Validation PDF ready for user inspection`);
            }
        } else {
            console.log('⚠️  Enhanced implementation needs debugging');
            console.log(`Success rate: ${analysis.successRate}%`);
        }
        
        validator.cleanup();
        
    } catch (error) {
        console.error(`Validation failed: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}