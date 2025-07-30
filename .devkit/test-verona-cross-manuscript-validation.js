const https = require('https');
const fs = require('fs');

// Disable SSL verification for testing
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

// Test multiple image service URLs from different manuscripts
const testServices = [
    {
        url: 'https://nbm.regione.veneto.it/digilib/servlet/Scaler/IIIF/documenti%2Fbibliotecadigitale%2Fnbm%2FVR0056%2FLXXXIX+%2884%29%2FVR0056-Cod._LXXXIX_%2884%29_c._001r',
        description: 'LXXXIX 84 - Page 1r'
    },
    {
        url: 'https://nbm.regione.veneto.it/digilib/servlet/Scaler/IIIF/documenti%2Fbibliotecadigitale%2Fnbm%2FVR0056%2FLXXXIX+%2884%29%2FVR0056-Cod._LXXXIX_%2884%29_c._002v',
        description: 'LXXXIX 84 - Page 2v'
    },
    {
        url: 'https://nbm.regione.veneto.it/digilib/servlet/Scaler/IIIF/documenti%2Fbibliotecadigitale%2Fnbm%2FVR0056%2FCVII+%28100%29%2FVR0056-Cod._CVII_%28100%29_c._001r',
        description: 'CVII 100 - Page 1r'
    },
    {
        url: 'https://nbm.regione.veneto.it/digilib/servlet/Scaler/IIIF/documenti%2Fbibliotecadigitale%2Fnbm%2FVR0056%2FCVII+%28100%29%2FVR0056-Cod._CVII_%28100%29_c._003r',
        description: 'CVII 100 - Page 3r'
    }
];

// Top performing patterns from previous testing
const bestPatterns = [
    'pct:0,0,100,100/8000,/0/default.jpg',      // Highest resolution
    'pct:0,0,100,100/!8000,8000/0/default.jpg', // High resolution alternative
    'pct:0,0,100,100/4000,/0/default.jpg',      // Medium-high resolution
    'pct:0,0,100,100/2000,/0/default.jpg',      // Medium resolution
    'pct:0,0,100,100/max/0/default.jpg'         // Fallback reliable pattern
];

class CrossManuscriptValidator {
    constructor() {
        this.results = [];
        this.timeout = 30000;
    }

    async testPattern(serviceUrl, pattern, description) {
        return new Promise((resolve) => {
            const imageUrl = `${serviceUrl}/${pattern}`;
            
            console.log(`🔍 Testing: ${description} - ${pattern}`);
            
            const startTime = Date.now();
            
            const req = https.get(imageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'image/*',
                    'Referer': 'https://www.nuovabibliotecamanoscritta.it/'
                }
            }, (res) => {
                let dataSize = 0;
                let chunks = [];
                
                res.on('data', (chunk) => {
                    dataSize += chunk.length;
                    chunks.push(chunk);
                });
                
                res.on('end', () => {
                    const downloadTime = Date.now() - startTime;
                    const buffer = Buffer.concat(chunks);
                    
                    const result = {
                        service: description,
                        serviceUrl: serviceUrl,
                        pattern: pattern,
                        imageUrl: imageUrl,
                        statusCode: res.statusCode,
                        isSuccess: res.statusCode === 200,
                        fileSize: dataSize,
                        downloadTime: downloadTime,
                        contentType: res.headers['content-type'],
                        error: null,
                        imageDimensions: null,
                        qualityScore: null
                    };
                    
                    if (result.isSuccess) {
                        try {
                            const dimensions = this.getImageDimensions(buffer);
                            result.imageDimensions = dimensions;
                            result.qualityScore = this.calculateQualityScore(dataSize, dimensions);
                            
                            console.log(`   ✅ Success: ${(dataSize/1024).toFixed(1)} KB, ${dimensions.width}x${dimensions.height}, ${downloadTime}ms`);
                        } catch (e) {
                            console.log(`   ✅ Success: ${(dataSize/1024).toFixed(1)} KB, ${downloadTime}ms`);
                        }
                    } else {
                        result.error = `HTTP ${res.statusCode}`;
                        console.log(`   ❌ Failed: HTTP ${res.statusCode}`);
                    }
                    
                    resolve(result);
                });
            });
            
            req.on('error', (err) => {
                console.log(`   ❌ Error: ${err.message}`);
                resolve({
                    service: description,
                    serviceUrl: serviceUrl,
                    pattern: pattern,
                    imageUrl: imageUrl,
                    statusCode: null,
                    isSuccess: false,
                    fileSize: 0,
                    downloadTime: Date.now() - startTime,
                    contentType: null,
                    error: err.message,
                    imageDimensions: null,
                    qualityScore: 0
                });
            });
            
            req.setTimeout(this.timeout, () => {
                req.destroy();
                console.log(`   ⏰ Timeout`);
                resolve({
                    service: description,
                    serviceUrl: serviceUrl,
                    pattern: pattern,
                    imageUrl: imageUrl,
                    statusCode: null,
                    isSuccess: false,
                    fileSize: 0,
                    downloadTime: Date.now() - startTime,
                    contentType: null,
                    error: 'Timeout',
                    imageDimensions: null,
                    qualityScore: 0
                });
            });
        });
    }

    getImageDimensions(buffer) {
        // JPEG dimension extraction
        if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
            for (let i = 2; i < buffer.length - 8; i++) {
                if (buffer[i] === 0xFF && (buffer[i + 1] === 0xC0 || buffer[i + 1] === 0xC2)) {
                    const height = (buffer[i + 5] << 8) | buffer[i + 6];
                    const width = (buffer[i + 7] << 8) | buffer[i + 8];
                    return { width, height };
                }
            }
        }
        
        // PNG dimension extraction
        if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
            const width = buffer.readUInt32BE(16);
            const height = buffer.readUInt32BE(20);
            return { width, height };
        }
        
        throw new Error('Unknown image format');
    }

    calculateQualityScore(fileSize, dimensions) {
        if (!dimensions) return 0;
        
        const pixels = dimensions.width * dimensions.height;
        const bytesPerPixel = fileSize / pixels;
        
        return Math.round((pixels / 1000000) * bytesPerPixel * 100) / 100;
    }

    async runValidation() {
        console.log('🔍 VERONA NBM CROSS-MANUSCRIPT VALIDATION');
        console.log('=========================================');
        console.log(`Testing ${testServices.length} manuscript pages`);
        console.log(`Testing ${bestPatterns.length} best patterns`);
        console.log(`Total tests: ${testServices.length * bestPatterns.length}`);
        console.log('');
        
        // Test each service with each pattern
        for (const service of testServices) {
            console.log(`\n📖 Testing manuscript: ${service.description}`);
            
            for (const pattern of bestPatterns) {
                const result = await this.testPattern(service.url, pattern, service.description);
                this.results.push(result);
                
                // Short delay between requests
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        this.analyzeResults();
    }

    analyzeResults() {
        console.log('\n\n📊 CROSS-MANUSCRIPT ANALYSIS');
        console.log('============================');
        
        const successful = this.results.filter(r => r.isSuccess);
        const failed = this.results.filter(r => !r.isSuccess);
        
        console.log(`✅ Total successful: ${successful.length}/${this.results.length}`);
        console.log(`❌ Total failed: ${failed.length}`);
        console.log(`📊 Success rate: ${Math.round((successful.length / this.results.length) * 100)}%`);
        
        // Analyze by pattern consistency
        const patternStats = {};
        bestPatterns.forEach(pattern => {
            const patternResults = this.results.filter(r => r.pattern === pattern);
            const patternSuccessful = patternResults.filter(r => r.isSuccess);
            
            patternStats[pattern] = {
                pattern: pattern,
                totalTests: patternResults.length,
                successful: patternSuccessful.length,
                successRate: Math.round((patternSuccessful.length / patternResults.length) * 100),
                avgFileSize: patternSuccessful.length > 0 ? 
                    Math.round(patternSuccessful.reduce((sum, r) => sum + r.fileSize, 0) / patternSuccessful.length) : 0,
                avgDownloadTime: patternSuccessful.length > 0 ? 
                    Math.round(patternSuccessful.reduce((sum, r) => sum + r.downloadTime, 0) / patternSuccessful.length) : 0,
                resolutions: patternSuccessful.filter(r => r.imageDimensions).map(r => 
                    `${r.imageDimensions.width}x${r.imageDimensions.height}`
                ),
                avgQualityScore: patternSuccessful.length > 0 ? 
                    Math.round((patternSuccessful.reduce((sum, r) => sum + (r.qualityScore || 0), 0) / patternSuccessful.length) * 100) / 100 : 0
            };
        });
        
        console.log('\n🎯 PATTERN RELIABILITY ANALYSIS:');
        Object.values(patternStats).sort((a, b) => b.successRate - a.successRate).forEach((stats, index) => {
            console.log(`${index + 1}. ${stats.pattern}`);
            console.log(`   📊 Success rate: ${stats.successful}/${stats.totalTests} (${stats.successRate}%)`);
            console.log(`   💾 Avg file size: ${(stats.avgFileSize / 1024).toFixed(1)} KB`);
            console.log(`   ⏱️ Avg download time: ${stats.avgDownloadTime}ms`);
            console.log(`   ⭐ Avg quality score: ${stats.avgQualityScore}`);
            if (stats.resolutions.length > 0) {
                const uniqueResolutions = [...new Set(stats.resolutions)];
                console.log(`   📐 Resolutions: ${uniqueResolutions.join(', ')}`);
            }
            console.log('');
        });
        
        // Analyze by manuscript consistency
        const manuscriptStats = {};
        testServices.forEach(service => {
            const serviceResults = this.results.filter(r => r.service === service.description);
            const serviceSuccessful = serviceResults.filter(r => r.isSuccess);
            
            manuscriptStats[service.description] = {
                description: service.description,
                totalTests: serviceResults.length,
                successful: serviceSuccessful.length,
                successRate: Math.round((serviceSuccessful.length / serviceResults.length) * 100),
                workingPatterns: serviceSuccessful.map(r => r.pattern)
            };
        });
        
        console.log('\n📖 MANUSCRIPT CONSISTENCY ANALYSIS:');
        Object.values(manuscriptStats).forEach((stats, index) => {
            console.log(`${index + 1}. ${stats.description}`);
            console.log(`   📊 Success rate: ${stats.successful}/${stats.totalTests} (${stats.successRate}%)`);
            console.log(`   ✅ Working patterns: ${stats.workingPatterns.length}`);
            console.log('');
        });
        
        // Find universally working patterns
        const universalPatterns = bestPatterns.filter(pattern => {
            const patternResults = this.results.filter(r => r.pattern === pattern);
            return patternResults.every(r => r.isSuccess);
        });
        
        console.log(`\n🌟 UNIVERSALLY WORKING PATTERNS: ${universalPatterns.length}`);
        universalPatterns.forEach(pattern => {
            console.log(`   ✅ ${pattern}`);
        });
        
        // Find maximum resolution achieved
        const maxResolutionResult = successful.filter(r => r.imageDimensions).reduce((max, current) => {
            const currentPixels = current.imageDimensions.width * current.imageDimensions.height;
            const maxPixels = max.imageDimensions ? max.imageDimensions.width * max.imageDimensions.height : 0;
            return currentPixels > maxPixels ? current : max;
        }, {});
        
        if (maxResolutionResult.imageDimensions) {
            console.log('\n🎖️ MAXIMUM RESOLUTION ACHIEVED:');
            console.log(`   Pattern: ${maxResolutionResult.pattern}`);
            console.log(`   Manuscript: ${maxResolutionResult.service}`);
            console.log(`   Resolution: ${maxResolutionResult.imageDimensions.width}x${maxResolutionResult.imageDimensions.height}`);
            console.log(`   Total pixels: ${(maxResolutionResult.imageDimensions.width * maxResolutionResult.imageDimensions.height).toLocaleString()}`);
            console.log(`   File size: ${(maxResolutionResult.fileSize / 1024).toFixed(1)} KB`);
            console.log(`   Quality score: ${maxResolutionResult.qualityScore}`);
        }
        
        // Save results
        const reportData = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTests: this.results.length,
                successful: successful.length,
                failed: failed.length,
                successRate: Math.round((successful.length / this.results.length) * 100)
            },
            patternStats: patternStats,
            manuscriptStats: manuscriptStats,
            universalPatterns: universalPatterns,
            maxResolution: maxResolutionResult,
            allResults: this.results
        };
        
        const jsonPath = '/Users/evb/WebstormProjects/mss-downloader/.devkit/verona-cross-manuscript-validation.json';
        fs.writeFileSync(jsonPath, JSON.stringify(reportData, null, 2));
        
        console.log(`\n📊 Validation results saved to: ${jsonPath}`);
        
        return reportData;
    }
}

// Run the validation
const validator = new CrossManuscriptValidator();
validator.runValidation().catch(console.error);