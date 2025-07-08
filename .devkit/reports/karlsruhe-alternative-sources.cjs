const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class KarlsruheAlternativeSourceAnalyzer {
    constructor() {
        this.reportDir = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports';
        this.tempDir = path.join(this.reportDir, 'karlsruhe-alternative');
        
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    async testUrl(url, description) {
        return new Promise((resolve) => {
            const request = https.get(url, (response) => {
                let totalBytes = 0;
                response.on('data', chunk => totalBytes += chunk.length);
                response.on('end', () => {
                    resolve({
                        url,
                        description,
                        status: response.statusCode,
                        contentType: response.headers['content-type'],
                        contentLength: totalBytes,
                        success: response.statusCode === 200
                    });
                });
            });
            
            request.on('error', () => {
                resolve({
                    url,
                    description,
                    success: false,
                    error: 'Connection failed'
                });
            });
            
            request.setTimeout(10000, () => {
                request.destroy();
                resolve({
                    url,
                    description,
                    success: false,
                    error: 'Timeout'
                });
            });
        });
    }

    async downloadAndAnalyze(url, filename, description) {
        return new Promise((resolve) => {
            const file = fs.createWriteStream(path.join(this.tempDir, filename));
            
            https.get(url, (response) => {
                if (response.statusCode !== 200) {
                    resolve({
                        description,
                        success: false,
                        status: response.statusCode,
                        error: `HTTP ${response.statusCode}`
                    });
                    return;
                }
                
                let totalBytes = 0;
                response.on('data', chunk => totalBytes += chunk.length);
                response.pipe(file);
                
                file.on('finish', () => {
                    file.close();
                    
                    try {
                        const filepath = path.join(this.tempDir, filename);
                        const output = execSync(`identify -format "%wx%h" "${filepath}"`, { encoding: 'utf8' });
                        const [width, height] = output.trim().split('x').map(Number);
                        
                        resolve({
                            description,
                            filename,
                            success: true,
                            fileSize: totalBytes,
                            fileSizeKB: Math.round(totalBytes / 1024),
                            dimensions: { width, height },
                            megapixels: (width * height / 1000000).toFixed(1)
                        });
                    } catch (error) {
                        resolve({
                            description,
                            filename,
                            success: true,
                            fileSize: totalBytes,
                            fileSizeKB: Math.round(totalBytes / 1024),
                            error: `Could not analyze image: ${error.message}`
                        });
                    }
                });
            }).on('error', () => {
                resolve({
                    description,
                    success: false,
                    error: 'Download failed'
                });
            });
        });
    }

    async testAlternativeImageSources() {
        console.log('=== Testing Alternative High-Resolution Sources ===\n');
        
        // Base URLs extracted from the analysis
        const baseImageUrl = 'https://digital.blb-karlsruhe.de/download/webcache/1000/221191';
        const imageId = '221191';
        
        console.log(`Base image ID: ${imageId}`);
        console.log(`Current source: ${baseImageUrl}\n`);
        
        // Test different potential high-resolution sources
        const testUrls = [
            {
                url: `https://digital.blb-karlsruhe.de/download/webcache/2000/${imageId}`,
                description: 'Webcache 2000px'
            },
            {
                url: `https://digital.blb-karlsruhe.de/download/webcache/3000/${imageId}`,
                description: 'Webcache 3000px'
            },
            {
                url: `https://digital.blb-karlsruhe.de/download/webcache/4000/${imageId}`,
                description: 'Webcache 4000px'
            },
            {
                url: `https://digital.blb-karlsruhe.de/download/webcache/max/${imageId}`,
                description: 'Webcache maximum'
            },
            {
                url: `https://digital.blb-karlsruhe.de/download/original/${imageId}`,
                description: 'Original file'
            },
            {
                url: `https://digital.blb-karlsruhe.de/i3f/v20/192435/006_r-2/full/max/0/default.jpg`,
                description: 'IIIF API maximum'
            },
            {
                url: `https://digital.blb-karlsruhe.de/i3f/v20/192435/006_r-2/full/3000,/0/default.jpg`,
                description: 'IIIF API 3000px'
            }
        ];
        
        const results = [];
        
        for (let i = 0; i < testUrls.length; i++) {
            const test = testUrls[i];
            console.log(`Testing ${test.description}...`);
            
            const filename = `test-${i}-${test.description.replace(/\s+/g, '_')}.jpg`;
            const result = await this.downloadAndAnalyze(test.url, filename, test.description);
            
            if (result.success && result.dimensions) {
                console.log(`  ✓ ${result.fileSizeKB}KB - ${result.dimensions.width}x${result.dimensions.height} (${result.megapixels}MP)`);
            } else if (result.success) {
                console.log(`  ✓ ${result.fileSizeKB}KB - ${result.error || 'Could not analyze'}`);
            } else {
                console.log(`  ✗ ${result.error || 'Failed'}`);
            }
            
            results.push(result);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        return results;
    }

    analyzeAlternativeResults(results) {
        console.log('\n=== Alternative Source Analysis ===\n');
        
        const successful = results.filter(r => r.success && r.dimensions);
        
        if (successful.length === 0) {
            console.log('❌ No alternative high-resolution sources found');
            console.log('✅ Current IIIF implementation is optimal');
            return null;
        }
        
        // Sort by resolution
        successful.sort((a, b) => {
            const aPixels = a.dimensions.width * a.dimensions.height;
            const bPixels = b.dimensions.width * b.dimensions.height;
            return bPixels - aPixels;
        });
        
        console.log('High-Resolution Sources Found:');
        console.log('Source'.padEnd(25) + 'Dimensions'.padEnd(15) + 'Size'.padEnd(10) + 'Megapixels');
        console.log('-'.repeat(65));
        
        successful.forEach(result => {
            const source = result.description.padEnd(25);
            const dims = `${result.dimensions.width}x${result.dimensions.height}`.padEnd(15);
            const size = `${result.fileSizeKB}KB`.padEnd(10);
            const mp = `${result.megapixels}MP`;
            
            console.log(source + dims + size + mp);
        });
        
        // Compare with current resolution
        const currentResolution = { width: 1000, height: 1425 }; // From previous analysis
        const currentPixels = currentResolution.width * currentResolution.height;
        
        const bestAlternative = successful[0];
        const bestPixels = bestAlternative.dimensions.width * bestAlternative.dimensions.height;
        
        console.log('\n=== Recommendations ===');
        
        if (bestPixels > currentPixels) {
            const improvement = Math.round((bestPixels - currentPixels) / currentPixels * 100);
            
            console.log('🚀 SIGNIFICANT UPGRADE AVAILABLE!');
            console.log(`Current IIIF: ${currentResolution.width}x${currentResolution.height} (${(currentPixels/1000000).toFixed(1)}MP)`);
            console.log(`Best alternative: ${bestAlternative.dimensions.width}x${bestAlternative.dimensions.height} (${bestAlternative.megapixels}MP)`);
            console.log(`Improvement: +${improvement}% pixels`);
            console.log(`Size difference: ${bestAlternative.fileSizeKB - 269}KB`);
            console.log();
            console.log('📝 Implementation Required:');
            console.log('The current IIIF API is serving downscaled images.');
            console.log('Consider implementing direct access to higher resolution sources.');
            console.log(`Recommended URL pattern: ${bestAlternative.description}`);
            
            return bestAlternative;
        } else {
            console.log('✅ Current IIIF implementation provides optimal resolution');
            console.log('No higher resolution sources found.');
            return null;
        }
    }

    cleanup() {
        try {
            if (fs.existsSync(this.tempDir)) {
                const files = fs.readdirSync(this.tempDir);
                if (files.length > 0) {
                    console.log(`\nCleaning up ${files.length} test files...`);
                    fs.rmSync(this.tempDir, { recursive: true, force: true });
                }
            }
        } catch (error) {
            console.warn(`Cleanup warning: ${error.message}`);
        }
    }

    async saveReport(results, recommendation) {
        const report = {
            timestamp: new Date().toISOString(),
            analysis: 'Alternative high-resolution source investigation',
            baseImageId: '221191',
            currentIIIFResolution: '1000x1425 (1.4MP)',
            alternativeSourceTests: results,
            recommendation: recommendation ? {
                source: recommendation.description,
                resolution: `${recommendation.dimensions.width}x${recommendation.dimensions.height}`,
                megapixels: recommendation.megapixels,
                fileSize: `${recommendation.fileSizeKB}KB`,
                improvementRequired: true
            } : {
                improvementRequired: false,
                message: 'Current IIIF implementation is optimal'
            }
        };

        const reportPath = path.join(this.reportDir, 'karlsruhe-alternative-sources-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\nAlternative sources report saved: ${reportPath}`);
    }
}

async function main() {
    const analyzer = new KarlsruheAlternativeSourceAnalyzer();
    
    try {
        const results = await analyzer.testAlternativeImageSources();
        const recommendation = analyzer.analyzeAlternativeResults(results);
        await analyzer.saveReport(results, recommendation);
        
        console.log('\n=== Analysis Complete ===');
        if (recommendation) {
            console.log('⚠️  Higher resolution sources found - implementation update recommended');
        } else {
            console.log('✅ Current IIIF implementation is optimal');
        }
        
    } catch (error) {
        console.error(`Analysis failed: ${error.message}`);
        process.exit(1);
    } finally {
        analyzer.cleanup();
    }
}

if (require.main === module) {
    main();
}