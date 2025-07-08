const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class KarlsruheManifestAnalyzer {
    constructor() {
        this.reportDir = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports';
        this.tempDir = path.join(this.reportDir, 'karlsruhe-images');
        
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
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
            const output = execSync(`identify -format "%wx%h" "${filepath}"`, { encoding: 'utf8' });
            const [width, height] = output.trim().split('x').map(Number);
            return { width, height };
        } catch (error) {
            console.warn(`Could not get dimensions for ${filename}: ${error.message}`);
            return null;
        }
    }

    generateResolutionVariants(baseImageUrl) {
        const resolutionParams = [
            'full/full/0/default.jpg',
            'full/max/0/default.jpg',
            'full/1000,/0/default.jpg',
            'full/1500,/0/default.jpg',
            'full/2000,/0/default.jpg',
            'full/2500,/0/default.jpg',
            'full/3000,/0/default.jpg',
            'full/4000,/0/default.jpg',
            'full/5000,/0/default.jpg',
            'full/6000,/0/default.jpg'
        ];

        return resolutionParams.map(param => {
            const testUrl = baseImageUrl.replace(/\/full\/[^\/]+\/0\/default\.jpg$/, `/${param}`);
            return {
                parameter: param,
                url: testUrl,
                description: this.getParameterDescription(param)
            };
        });
    }

    getParameterDescription(param) {
        const descriptions = {
            'full/full/0/default.jpg': 'Original manifest size',
            'full/max/0/default.jpg': 'Maximum available',
            'full/1000,/0/default.jpg': '1000px width',
            'full/1500,/0/default.jpg': '1500px width',
            'full/2000,/0/default.jpg': '2000px width (current)',
            'full/2500,/0/default.jpg': '2500px width',
            'full/3000,/0/default.jpg': '3000px width',
            'full/4000,/0/default.jpg': '4000px width',
            'full/5000,/0/default.jpg': '5000px width',
            'full/6000,/0/default.jpg': '6000px width'
        };
        return descriptions[param] || param;
    }

    async analyzeManifestAndTest() {
        console.log('=== Karlsruhe IIIF Manifest Analysis ===\n');
        
        const manifestUrl = 'https://digital.blb-karlsruhe.de/i3f/v20/192435/manifest';
        console.log(`Loading manifest: ${manifestUrl}`);
        
        try {
            const manifest = await this.fetchJson(manifestUrl);
            console.log('✓ Manifest loaded successfully\n');
            
            // Extract basic info
            const info = {
                type: manifest['@type'] || 'Unknown',
                label: this.extractLabel(manifest),
                sequences: manifest.sequences?.length || 0
            };
            
            console.log(`Title: ${info.label}`);
            console.log(`Type: ${info.type}`);
            console.log(`Sequences: ${info.sequences}`);
            
            if (!manifest.sequences || manifest.sequences.length === 0) {
                throw new Error('No sequences found in manifest');
            }
            
            const sequence = manifest.sequences[0];
            const canvases = sequence.canvases || [];
            console.log(`Pages: ${canvases.length}\n`);
            
            if (canvases.length === 0) {
                throw new Error('No canvases found in sequence');
            }
            
            // Test with first image
            const firstCanvas = canvases[0];
            console.log('=== Testing First Page Resolution Options ===');
            console.log(`Canvas: ${firstCanvas.label || 'Page 1'}`);
            
            if (!firstCanvas.images || firstCanvas.images.length === 0) {
                throw new Error('No images found in first canvas');
            }
            
            const firstImage = firstCanvas.images[0];
            if (!firstImage.resource || !firstImage.resource['@id']) {
                throw new Error('No image resource found');
            }
            
            const baseImageUrl = firstImage.resource['@id'];
            console.log(`Base URL: ${baseImageUrl}\n`);
            
            // Test different resolutions
            const variants = this.generateResolutionVariants(baseImageUrl);
            const results = [];
            
            for (let i = 0; i < variants.length; i++) {
                const variant = variants[i];
                const filename = `page1-${i}-${variant.parameter.replace(/[\/,]/g, '_')}.jpg`;
                
                console.log(`Testing ${variant.description}...`);
                
                try {
                    const downloadResult = await this.downloadImage(variant.url, filename);
                    const dimensions = this.getImageDimensions(filename);
                    
                    const result = {
                        parameter: variant.parameter,
                        description: variant.description,
                        url: variant.url,
                        filename,
                        fileSize: downloadResult.size,
                        fileSizeKB: Math.round(downloadResult.size / 1024),
                        dimensions,
                        success: true
                    };
                    
                    results.push(result);
                    
                    console.log(`  ✓ Downloaded: ${result.fileSizeKB}KB`);
                    if (dimensions) {
                        const megapixels = (dimensions.width * dimensions.height / 1000000).toFixed(1);
                        console.log(`  ✓ Dimensions: ${dimensions.width}x${dimensions.height} (${megapixels}MP)`);
                    }
                    
                } catch (error) {
                    console.log(`  ✗ Failed: ${error.message}`);
                    results.push({
                        parameter: variant.parameter,
                        description: variant.description,
                        url: variant.url,
                        success: false,
                        error: error.message
                    });
                }
                
                console.log();
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            return this.analyzeResults(results, baseImageUrl);
            
        } catch (error) {
            console.error('Manifest analysis failed:', error.message);
            throw error;
        }
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

    analyzeResults(results, baseUrl) {
        console.log('=== Analysis Results ===\n');
        
        const successful = results.filter(r => r.success && r.dimensions);
        
        if (successful.length === 0) {
            console.log('❌ No successful downloads with valid dimensions');
            return null;
        }
        
        // Sort by total pixels (resolution)
        successful.sort((a, b) => {
            const aPixels = a.dimensions.width * a.dimensions.height;
            const bPixels = b.dimensions.width * b.dimensions.height;
            return bPixels - aPixels;
        });
        
        console.log('Resolution Ranking (highest to lowest):');
        console.log('Rank'.padEnd(6) + 'Parameter'.padEnd(26) + 'Dimensions'.padEnd(15) + 'Size'.padEnd(10) + 'Megapixels');
        console.log('-'.repeat(75));
        
        successful.forEach((result, index) => {
            const pixels = result.dimensions.width * result.dimensions.height;
            const megapixels = (pixels / 1000000).toFixed(1);
            
            const rank = (index + 1).toString().padEnd(6);
            const param = result.parameter.padEnd(26);
            const dims = `${result.dimensions.width}x${result.dimensions.height}`.padEnd(15);
            const size = `${result.fileSizeKB}KB`.padEnd(10);
            
            console.log(rank + param + dims + size + megapixels + 'MP');
        });
        
        console.log('\n=== Recommendations ===');
        
        const highest = successful[0];
        const current2000 = successful.find(r => r.parameter === 'full/2000,/0/default.jpg');
        
        if (!current2000) {
            console.log('❌ Current 2000px parameter failed - need to investigate');
            return highest;
        }
        
        const highestPixels = highest.dimensions.width * highest.dimensions.height;
        const currentPixels = current2000.dimensions.width * current2000.dimensions.height;
        
        if (highest.parameter !== 'full/2000,/0/default.jpg') {
            const improvement = Math.round((highestPixels - currentPixels) / currentPixels * 100);
            const sizeDiff = highest.fileSizeKB - current2000.fileSizeKB;
            
            console.log('🔧 RESOLUTION UPGRADE AVAILABLE');
            console.log(`Current: ${current2000.parameter}`);
            console.log(`  └─ Resolution: ${current2000.dimensions.width}x${current2000.dimensions.height} (${(currentPixels/1000000).toFixed(1)}MP)`);
            console.log(`  └─ File size: ${current2000.fileSizeKB}KB`);
            console.log();
            console.log(`Recommended: ${highest.parameter}`);
            console.log(`  └─ Resolution: ${highest.dimensions.width}x${highest.dimensions.height} (${(highestPixels/1000000).toFixed(1)}MP)`);
            console.log(`  └─ File size: ${highest.fileSizeKB}KB`);
            console.log(`  └─ Improvement: +${improvement}% pixels, ${sizeDiff > 0 ? '+' : ''}${sizeDiff}KB`);
            console.log();
            console.log('📝 Implementation:');
            console.log('Update line 1665 in EnhancedManuscriptDownloaderService.ts:');
            console.log(`const maxResUrl = imageId.replace('/full/full/0/default.jpg', '/${highest.parameter}');`);
            
        } else {
            console.log('✅ CURRENT SETTING IS OPTIMAL');
            console.log(`The 2000px parameter is already providing the highest resolution available.`);
            console.log(`Resolution: ${current2000.dimensions.width}x${current2000.dimensions.height} (${(currentPixels/1000000).toFixed(1)}MP)`);
        }
        
        // Check for identical results
        const uniqueResolutions = new Set(successful.map(r => `${r.dimensions.width}x${r.dimensions.height}`));
        if (uniqueResolutions.size === 1) {
            console.log('\n📋 NOTE: All parameters return identical resolutions');
            console.log('Consider using "full/max" for semantic clarity');
        }
        
        return highest;
    }

    cleanup() {
        try {
            if (fs.existsSync(this.tempDir)) {
                const files = fs.readdirSync(this.tempDir);
                console.log(`\nCleaning up ${files.length} temporary files...`);
                fs.rmSync(this.tempDir, { recursive: true, force: true });
            }
        } catch (error) {
            console.warn(`Cleanup warning: ${error.message}`);
        }
    }

    async saveReport(results, recommendation) {
        const report = {
            timestamp: new Date().toISOString(),
            manifestUrl: 'https://digital.blb-karlsruhe.de/i3f/v20/192435/manifest',
            results,
            recommendation,
            implementation: recommendation ? {
                currentParameter: 'full/2000,/0/default.jpg',
                recommendedParameter: recommendation.parameter,
                codeLocation: 'EnhancedManuscriptDownloaderService.ts line 1665',
                improvement: recommendation.dimensions ? {
                    resolution: `${recommendation.dimensions.width}x${recommendation.dimensions.height}`,
                    megapixels: (recommendation.dimensions.width * recommendation.dimensions.height / 1000000).toFixed(1),
                    fileSize: `${recommendation.fileSizeKB}KB`
                } : null
            } : null
        };

        const reportPath = path.join(this.reportDir, 'karlsruhe-validation-results.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\nDetailed report saved: ${reportPath}`);
    }
}

async function main() {
    const analyzer = new KarlsruheManifestAnalyzer();
    
    try {
        const recommendation = await analyzer.analyzeManifestAndTest();
        await analyzer.saveReport(analyzer.results || [], recommendation);
        
        console.log('\n=== Analysis Complete ===');
        console.log('✓ Resolution testing completed');
        console.log('✓ Recommendations generated');
        console.log('✓ Report saved');
        
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