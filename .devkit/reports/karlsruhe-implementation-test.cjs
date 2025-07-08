const https = require('https');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

class KarlsruheImplementationTester {
    constructor() {
        this.reportDir = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports';
        this.validationDir = path.join(this.reportDir, 'karlsruhe-validation');
        
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

    extractWebcacheId(iiifUrl) {
        // Current implementation extracts from IIIF URLs like:
        // https://digital.blb-karlsruhe.de/download/webcache/1000/221191
        const match = iiifUrl.match(/webcache\/\d+\/(\d+)/);
        return match ? match[1] : null;
    }

    createHighResolutionUrl(originalUrl) {
        // Convert IIIF URL to high-resolution webcache URL
        const webcacheId = this.extractWebcacheId(originalUrl);
        if (webcacheId) {
            return `https://digital.blb-karlsruhe.de/download/webcache/2000/${webcacheId}`;
        }
        return null;
    }

    async testCurrentImplementation() {
        console.log('=== Testing Current Karlsruhe Implementation ===\n');
        
        const manifestUrl = 'https://digital.blb-karlsruhe.de/i3f/v20/192435/manifest';
        console.log(`Loading manifest: ${manifestUrl}`);
        
        try {
            const manifest = await this.fetchJson(manifestUrl);
            console.log('✓ Manifest loaded successfully');
            
            if (!manifest.sequences || manifest.sequences.length === 0) {
                throw new Error('No sequences found');
            }
            
            const sequence = manifest.sequences[0];
            const canvases = sequence.canvases || [];
            console.log(`✓ Found ${canvases.length} pages`);
            
            // Test with first 5 pages
            const testPages = Math.min(5, canvases.length);
            const currentResults = [];
            const upgradedResults = [];
            
            console.log(`\nTesting ${testPages} pages with both implementations:\n`);
            
            for (let i = 0; i < testPages; i++) {
                const canvas = canvases[i];
                const pageLabel = canvas.label || `Page ${i + 1}`;
                
                console.log(`Testing ${pageLabel}:`);
                
                if (!canvas.images || canvas.images.length === 0) {
                    console.log('  ✗ No images found in canvas');
                    continue;
                }
                
                const image = canvas.images[0];
                if (!image.resource || !image.resource['@id']) {
                    console.log('  ✗ No image resource found');
                    continue;
                }
                
                const originalUrl = image.resource['@id'];
                
                // Test current implementation (2000px IIIF parameter)
                const currentUrl = originalUrl.replace('/full/full/0/default.jpg', '/full/2000,/0/default.jpg');
                const currentFilename = `current-page-${i + 1}.jpg`;
                
                try {
                    const currentResult = await this.downloadImage(currentUrl, currentFilename);
                    currentResults.push({
                        page: i + 1,
                        pageLabel,
                        url: currentUrl,
                        filename: currentFilename,
                        size: currentResult.size,
                        downloadTime: currentResult.downloadTime,
                        success: true
                    });
                    console.log(`  ✓ Current (IIIF 2000px): ${Math.round(currentResult.size / 1024)}KB (${currentResult.downloadTime}ms)`);
                } catch (error) {
                    console.log(`  ✗ Current failed: ${error.message}`);
                    currentResults.push({
                        page: i + 1,
                        pageLabel,
                        success: false,
                        error: error.message
                    });
                }
                
                // Test upgraded implementation (webcache 2000px)
                const upgradedUrl = this.createHighResolutionUrl(originalUrl);
                if (upgradedUrl) {
                    const upgradedFilename = `upgraded-page-${i + 1}.jpg`;
                    
                    try {
                        const upgradedResult = await this.downloadImage(upgradedUrl, upgradedFilename);
                        upgradedResults.push({
                            page: i + 1,
                            pageLabel,
                            url: upgradedUrl,
                            filename: upgradedFilename,
                            size: upgradedResult.size,
                            downloadTime: upgradedResult.downloadTime,
                            success: true
                        });
                        console.log(`  ✓ Upgraded (webcache 2000px): ${Math.round(upgradedResult.size / 1024)}KB (${upgradedResult.downloadTime}ms)`);
                    } catch (error) {
                        console.log(`  ✗ Upgraded failed: ${error.message}`);
                        upgradedResults.push({
                            page: i + 1,
                            pageLabel,
                            success: false,
                            error: error.message
                        });
                    }
                } else {
                    console.log('  ✗ Could not create upgraded URL');
                }
                
                console.log();
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            return { currentResults, upgradedResults };
            
        } catch (error) {
            console.error(`Implementation test failed: ${error.message}`);
            throw error;
        }
    }

    analyzeImplementationResults(currentResults, upgradedResults) {
        console.log('=== Implementation Comparison ===\n');
        
        const successfulCurrent = currentResults.filter(r => r.success);
        const successfulUpgraded = upgradedResults.filter(r => r.success);
        
        if (successfulCurrent.length === 0 && successfulUpgraded.length === 0) {
            console.log('❌ Both implementations failed');
            return null;
        }
        
        console.log('Performance Comparison:');
        console.log('Page'.padEnd(6) + 'Current Size'.padEnd(14) + 'Upgraded Size'.padEnd(16) + 'Improvement'.padEnd(14) + 'Time Diff');
        console.log('-'.repeat(70));
        
        let totalCurrentSize = 0;
        let totalUpgradedSize = 0;
        let totalCurrentTime = 0;
        let totalUpgradedTime = 0;
        let comparedPages = 0;
        
        for (let i = 0; i < Math.max(successfulCurrent.length, successfulUpgraded.length); i++) {
            const current = successfulCurrent[i];
            const upgraded = successfulUpgraded[i];
            
            if (current && upgraded) {
                const improvement = Math.round((upgraded.size - current.size) / current.size * 100);
                const timeDiff = upgraded.downloadTime - current.downloadTime;
                
                console.log(
                    `${current.page}`.padEnd(6) +
                    `${Math.round(current.size / 1024)}KB`.padEnd(14) +
                    `${Math.round(upgraded.size / 1024)}KB`.padEnd(16) +
                    `+${improvement}%`.padEnd(14) +
                    `${timeDiff > 0 ? '+' : ''}${timeDiff}ms`
                );
                
                totalCurrentSize += current.size;
                totalUpgradedSize += upgraded.size;
                totalCurrentTime += current.downloadTime;
                totalUpgradedTime += upgraded.downloadTime;
                comparedPages++;
            }
        }
        
        if (comparedPages > 0) {
            const avgImprovement = Math.round((totalUpgradedSize - totalCurrentSize) / totalCurrentSize * 100);
            const avgTimeDiff = Math.round((totalUpgradedTime - totalCurrentTime) / comparedPages);
            
            console.log('-'.repeat(70));
            console.log(
                'Avg'.padEnd(6) +
                `${Math.round(totalCurrentSize / comparedPages / 1024)}KB`.padEnd(14) +
                `${Math.round(totalUpgradedSize / comparedPages / 1024)}KB`.padEnd(16) +
                `+${avgImprovement}%`.padEnd(14) +
                `${avgTimeDiff > 0 ? '+' : ''}${avgTimeDiff}ms`
            );
            
            console.log('\n=== Recommendations ===');
            
            if (avgImprovement > 50) {
                console.log('🚀 MAJOR IMPROVEMENT AVAILABLE');
                console.log(`Average file size increase: +${avgImprovement}%`);
                console.log(`Average download time change: ${avgTimeDiff > 0 ? '+' : ''}${avgTimeDiff}ms`);
                console.log();
                console.log('📝 Implementation Update Required:');
                console.log('Replace the IIIF URL construction in loadKarlsruheManifest()');
                console.log('Use webcache/2000/ instead of IIIF parameters for higher resolution');
                
                return {
                    upgradeRecommended: true,
                    improvement: avgImprovement,
                    timeDifference: avgTimeDiff,
                    currentAvgSize: Math.round(totalCurrentSize / comparedPages / 1024),
                    upgradedAvgSize: Math.round(totalUpgradedSize / comparedPages / 1024)
                };
            } else {
                console.log('✅ Current implementation is adequate');
                console.log(`Improvement available but modest: +${avgImprovement}%`);
                return {
                    upgradeRecommended: false,
                    improvement: avgImprovement
                };
            }
        }
        
        return null;
    }

    async createValidationPDFs(currentResults, upgradedResults) {
        console.log('\n=== Creating Validation PDFs ===');
        
        const successfulCurrent = currentResults.filter(r => r.success);
        const successfulUpgraded = upgradedResults.filter(r => r.success);
        
        // Create current implementation PDF
        if (successfulCurrent.length > 0) {
            await this.createPDF(successfulCurrent, 'karlsruhe-current-implementation.pdf', 'Current Implementation (IIIF 2000px)');
            console.log('✓ Current implementation PDF created');
        }
        
        // Create upgraded implementation PDF
        if (successfulUpgraded.length > 0) {
            await this.createPDF(successfulUpgraded, 'karlsruhe-upgraded-implementation.pdf', 'Upgraded Implementation (webcache 2000px)');
            console.log('✓ Upgraded implementation PDF created');
        }
        
        console.log(`\nValidation PDFs saved in: ${this.validationDir}`);
    }

    async createPDF(results, filename, title) {
        return new Promise((resolve, reject) => {
            const pdfPath = path.join(this.validationDir, filename);
            const doc = new PDFDocument({ autoFirstPage: false });
            doc.pipe(fs.createWriteStream(pdfPath));
            
            results.forEach((result, index) => {
                const imagePath = path.join(this.validationDir, result.filename);
                
                if (fs.existsSync(imagePath)) {
                    doc.addPage();
                    
                    // Add title on first page
                    if (index === 0) {
                        doc.fontSize(16).text(title, 50, 50);
                        doc.fontSize(12).text(`Generated: ${new Date().toISOString()}`, 50, 80);
                        doc.text('', 50, 120); // Line break
                    }
                    
                    // Add page info
                    doc.fontSize(10).text(`${result.pageLabel} - ${Math.round(result.size / 1024)}KB`, 50, doc.y + 10);
                    
                    try {
                        // Add image (fit to page with margins)
                        doc.image(imagePath, 50, doc.y + 10, { fit: [495, 700] });
                    } catch (error) {
                        doc.text(`Error loading image: ${error.message}`, 50, doc.y + 10);
                    }
                }
            });
            
            doc.end();
            doc.on('end', resolve);
            doc.on('error', reject);
        });
    }

    async saveReport(results, recommendation) {
        const report = {
            timestamp: new Date().toISOString(),
            testType: 'Karlsruhe Implementation Comparison',
            manifestUrl: 'https://digital.blb-karlsruhe.de/i3f/v20/192435/manifest',
            currentImplementation: {
                description: 'IIIF API with 2000px parameter',
                results: results.currentResults
            },
            upgradedImplementation: {
                description: 'Direct webcache/2000/ access',
                results: results.upgradedResults
            },
            recommendation
        };

        const reportPath = path.join(this.reportDir, 'karlsruhe-implementation-comparison.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\nImplementation comparison report saved: ${reportPath}`);
    }
}

async function main() {
    const tester = new KarlsruheImplementationTester();
    
    try {
        const results = await tester.testCurrentImplementation();
        const recommendation = tester.analyzeImplementationResults(results.currentResults, results.upgradedResults);
        await tester.createValidationPDFs(results.currentResults, results.upgradedResults);
        await tester.saveReport(results, recommendation);
        
        console.log('\n=== Implementation Test Complete ===');
        if (recommendation && recommendation.upgradeRecommended) {
            console.log('⚠️  Significant improvement available - code update recommended');
        } else {
            console.log('✅ Current implementation is satisfactory');
        }
        
    } catch (error) {
        console.error(`Implementation test failed: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}