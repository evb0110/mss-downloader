const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DetailedKarlsruheAnalyzer {
    constructor() {
        this.reportDir = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports';
        this.tempDir = path.join(this.reportDir, 'karlsruhe-temp');
        
        // Create temp directory
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    async downloadImage(url, filename) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(path.join(this.tempDir, filename));
            
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
                    resolve({
                        filename,
                        size: totalBytes,
                        contentType: response.headers['content-type']
                    });
                });
            }).on('error', reject);
        });
    }

    getImageDimensions(filename) {
        try {
            const filepath = path.join(this.tempDir, filename);
            // Use ImageMagick identify command to get image dimensions
            const output = execSync(`identify -format "%wx%h" "${filepath}"`, { encoding: 'utf8' });
            const [width, height] = output.trim().split('x').map(Number);
            return { width, height };
        } catch (error) {
            console.warn(`Could not get dimensions for ${filename}: ${error.message}`);
            return null;
        }
    }

    async testDetailedResolutions() {
        console.log('=== Detailed Resolution Analysis ===\n');
        
        // Test with one sample image URL
        const baseUrl = 'https://digital.blb-karlsruhe.de/i3f/v20/192435/006_r-2';
        
        const testParams = [
            { param: 'full/full/0/default.jpg', desc: 'Original (full/full)' },
            { param: 'full/max/0/default.jpg', desc: 'Maximum (full/max)' },
            { param: 'full/1000,/0/default.jpg', desc: '1000px width' },
            { param: 'full/2000,/0/default.jpg', desc: '2000px width (current)' },
            { param: 'full/3000,/0/default.jpg', desc: '3000px width' },
            { param: 'full/4000,/0/default.jpg', desc: '4000px width' },
            { param: 'full/5000,/0/default.jpg', desc: '5000px width' },
        ];

        const results = [];

        for (let i = 0; i < testParams.length; i++) {
            const test = testParams[i];
            const filename = `test-${i}-${test.param.replace(/[\/,]/g, '_')}.jpg`;
            const url = `${baseUrl}/${test.param}`;
            
            console.log(`Testing ${test.desc}...`);
            
            try {
                const downloadResult = await this.downloadImage(url, filename);
                const dimensions = this.getImageDimensions(filename);
                
                const result = {
                    parameter: test.param,
                    description: test.desc,
                    url,
                    filename,
                    fileSize: downloadResult.size,
                    fileSizeKB: Math.round(downloadResult.size / 1024),
                    dimensions,
                    contentType: downloadResult.contentType,
                    success: true
                };
                
                results.push(result);
                
                console.log(`  ✓ Size: ${result.fileSizeKB}KB`);
                if (dimensions) {
                    console.log(`  ✓ Dimensions: ${dimensions.width}x${dimensions.height}`);
                }
                console.log();
                
            } catch (error) {
                console.log(`  ✗ Failed: ${error.message}\n`);
                results.push({
                    parameter: test.param,
                    description: test.desc,
                    url,
                    success: false,
                    error: error.message
                });
            }
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return results;
    }

    analyzeDetailedResults(results) {
        console.log('=== Detailed Analysis Results ===\n');
        
        const successful = results.filter(r => r.success && r.dimensions);
        
        if (successful.length === 0) {
            console.log('No successful results with dimensions to analyze.');
            return;
        }

        console.log('Resolution Comparison:');
        console.log('Parameter'.padEnd(25) + 'Dimensions'.padEnd(15) + 'File Size'.padEnd(12) + 'Pixels');
        console.log('-'.repeat(70));
        
        successful.forEach(result => {
            const pixels = result.dimensions ? result.dimensions.width * result.dimensions.height : 0;
            const pixelsStr = pixels > 0 ? `${Math.round(pixels / 1000000 * 10) / 10}MP` : 'Unknown';
            
            console.log(
                result.parameter.padEnd(25) +
                `${result.dimensions.width}x${result.dimensions.height}`.padEnd(15) +
                `${result.fileSizeKB}KB`.padEnd(12) +
                pixelsStr
            );
        });
        
        console.log();
        
        // Find the highest resolution
        const maxResolution = successful.reduce((max, current) => {
            if (!current.dimensions) return max;
            const currentPixels = current.dimensions.width * current.dimensions.height;
            const maxPixels = max.dimensions ? max.dimensions.width * max.dimensions.height : 0;
            return currentPixels > maxPixels ? current : max;
        }, successful[0]);

        console.log('=== Recommendations ===');
        
        if (maxResolution && maxResolution.parameter !== 'full/2000,/0/default.jpg') {
            console.log(`🔧 UPGRADE AVAILABLE`);
            console.log(`Current: full/2000,/0/default.jpg`);
            console.log(`Recommended: ${maxResolution.parameter}`);
            console.log(`Resolution: ${maxResolution.dimensions.width}x${maxResolution.dimensions.height}`);
            console.log(`File size: ${maxResolution.fileSizeKB}KB`);
            console.log(`Megapixels: ${Math.round(maxResolution.dimensions.width * maxResolution.dimensions.height / 1000000 * 10) / 10}MP`);
            
            const current2000 = successful.find(r => r.parameter === 'full/2000,/0/default.jpg');
            if (current2000 && current2000.dimensions) {
                const currentPixels = current2000.dimensions.width * current2000.dimensions.height;
                const maxPixels = maxResolution.dimensions.width * maxResolution.dimensions.height;
                const improvement = Math.round((maxPixels - currentPixels) / currentPixels * 100);
                console.log(`Improvement: +${improvement}% more pixels`);
            }
        } else {
            console.log(`✓ CURRENT SETTING IS OPTIMAL`);
            console.log(`The current 2000px setting is already using maximum available resolution.`);
        }
        
        // Check if all resolutions are identical
        const uniqueSizes = new Set(successful.map(r => `${r.dimensions?.width}x${r.dimensions?.height}`));
        if (uniqueSizes.size === 1) {
            console.log(`\n📋 NOTE: All resolution parameters return identical images.`);
            console.log(`This suggests the source images are already at maximum resolution.`);
            console.log(`Using 'full/max' would be the most appropriate parameter.`);
        }

        return maxResolution;
    }

    cleanup() {
        try {
            // Remove temporary files
            if (fs.existsSync(this.tempDir)) {
                fs.rmSync(this.tempDir, { recursive: true, force: true });
                console.log('\nCleaned up temporary files.');
            }
        } catch (error) {
            console.warn(`Cleanup warning: ${error.message}`);
        }
    }

    async saveDetailedReport(results, recommendation) {
        const report = {
            timestamp: new Date().toISOString(),
            testUrl: 'https://digital.blb-karlsruhe.de/i3f/v20/192435/006_r-2',
            results,
            recommendation,
            summary: {
                totalTests: results.length,
                successfulTests: results.filter(r => r.success).length,
                uniqueResolutions: new Set(results.filter(r => r.success && r.dimensions)
                    .map(r => `${r.dimensions.width}x${r.dimensions.height}`)).size
            }
        };

        const reportPath = path.join(this.reportDir, 'karlsruhe-detailed-resolution-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\nDetailed report saved to: ${reportPath}`);
    }
}

async function main() {
    const analyzer = new DetailedKarlsruheAnalyzer();
    
    try {
        console.log('=== Karlsruhe Detailed Resolution Analysis ===\n');
        
        const results = await analyzer.testDetailedResolutions();
        const recommendation = analyzer.analyzeDetailedResults(results);
        await analyzer.saveDetailedReport(results, recommendation);
        
        console.log('\n=== Analysis Complete ===');
        
    } catch (error) {
        console.error('Analysis failed:', error.message);
        process.exit(1);
    } finally {
        analyzer.cleanup();
    }
}

if (require.main === module) {
    main();
}