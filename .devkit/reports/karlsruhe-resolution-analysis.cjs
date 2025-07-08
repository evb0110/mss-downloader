const https = require('https');
const fs = require('fs');
const path = require('path');

class KarlsruheResolutionAnalyzer {
    constructor() {
        this.reportDir = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports';
        this.results = {
            manifestAnalysis: null,
            resolutionTests: [],
            recommendations: []
        };
    }

    async fetchWithFallback(url, options = {}) {
        return new Promise((resolve, reject) => {
            const request = https.get(url, options, (response) => {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    try {
                        resolve({
                            ok: response.statusCode >= 200 && response.statusCode < 300,
                            status: response.statusCode,
                            headers: response.headers,
                            data: data,
                            json: () => JSON.parse(data)
                        });
                    } catch (error) {
                        resolve({
                            ok: response.statusCode >= 200 && response.statusCode < 300,
                            status: response.statusCode,
                            headers: response.headers,
                            data: data
                        });
                    }
                });
            });
            
            request.on('error', reject);
            request.setTimeout(30000, () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }

    async analyzeManifest(manifestUrl) {
        console.log('Analyzing IIIF manifest:', manifestUrl);
        
        try {
            const response = await this.fetchWithFallback(manifestUrl);
            if (!response.ok) {
                throw new Error(`Failed to load manifest: HTTP ${response.status}`);
            }

            const manifest = response.json();
            console.log('Manifest loaded successfully');
            
            // Analyze manifest structure
            const analysis = {
                type: manifest['@type'] || 'Unknown',
                label: this.extractLabel(manifest),
                sequences: manifest.sequences?.length || 0,
                canvases: 0,
                sampleImageUrls: []
            };

            if (manifest.sequences && manifest.sequences.length > 0) {
                const sequence = manifest.sequences[0];
                if (sequence.canvases && Array.isArray(sequence.canvases)) {
                    analysis.canvases = sequence.canvases.length;
                    
                    // Extract first few image URLs for testing
                    const maxSamples = Math.min(3, sequence.canvases.length);
                    for (let i = 0; i < maxSamples; i++) {
                        const canvas = sequence.canvases[i];
                        if (canvas.images && canvas.images.length > 0) {
                            const image = canvas.images[0];
                            if (image.resource && image.resource['@id']) {
                                analysis.sampleImageUrls.push({
                                    canvasIndex: i,
                                    originalUrl: image.resource['@id'],
                                    canvasLabel: canvas.label || `Page ${i + 1}`
                                });
                            }
                        }
                    }
                }
            }

            this.results.manifestAnalysis = analysis;
            console.log(`Found ${analysis.canvases} pages in manifest`);
            console.log(`Extracted ${analysis.sampleImageUrls.length} sample image URLs`);
            
            return analysis;
        } catch (error) {
            console.error('Failed to analyze manifest:', error.message);
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

    generateResolutionVariants(baseImageUrl) {
        // Test different IIIF size parameters
        const resolutionParams = [
            'full/full/0/default.jpg',      // Original (what's currently in manifest)
            'full/max/0/default.jpg',       // Maximum available
            'full/1000,/0/default.jpg',     // 1000px width
            'full/1500,/0/default.jpg',     // 1500px width
            'full/2000,/0/default.jpg',     // 2000px width (current implementation)
            'full/2500,/0/default.jpg',     // 2500px width
            'full/3000,/0/default.jpg',     // 3000px width
            'full/4000,/0/default.jpg',     // 4000px width
            'full/5000,/0/default.jpg',     // 5000px width
            'full/6000,/0/default.jpg',     // 6000px width
        ];

        const variants = [];
        for (const param of resolutionParams) {
            // Replace the size parameter in the URL
            const testUrl = baseImageUrl.replace(/\/full\/[^\/]+\/0\/default\.jpg$/, `/${param}`);
            variants.push({
                parameter: param,
                url: testUrl,
                description: this.getParameterDescription(param)
            });
        }

        return variants;
    }

    getParameterDescription(param) {
        const descriptions = {
            'full/full/0/default.jpg': 'Original manifest resolution',
            'full/max/0/default.jpg': 'Maximum available resolution',
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

    async testImageResolution(imageUrl, parameter, description) {
        try {
            console.log(`Testing ${description}: ${parameter}`);
            
            const startTime = Date.now();
            const response = await this.fetchWithFallback(imageUrl, { method: 'HEAD' });
            const responseTime = Date.now() - startTime;

            const result = {
                parameter,
                description,
                url: imageUrl,
                success: response.ok,
                status: response.status,
                responseTime,
                contentLength: null,
                contentType: null,
                errorMessage: null
            };

            if (response.ok) {
                result.contentLength = parseInt(response.headers['content-length']) || null;
                result.contentType = response.headers['content-type'] || null;
                
                console.log(`✓ ${description}: ${result.contentLength ? `${Math.round(result.contentLength / 1024)}KB` : 'Size unknown'} (${responseTime}ms)`);
            } else {
                result.errorMessage = `HTTP ${response.status}`;
                console.log(`✗ ${description}: HTTP ${response.status} (${responseTime}ms)`);
            }

            return result;
        } catch (error) {
            console.log(`✗ ${description}: ${error.message}`);
            return {
                parameter,
                description,
                url: imageUrl,
                success: false,
                status: null,
                responseTime: null,
                contentLength: null,
                contentType: null,
                errorMessage: error.message
            };
        }
    }

    async testAllResolutions() {
        if (!this.results.manifestAnalysis || this.results.manifestAnalysis.sampleImageUrls.length === 0) {
            throw new Error('No sample image URLs available for testing');
        }

        console.log('\n=== Testing Resolution Parameters ===');
        
        for (const sampleImage of this.results.manifestAnalysis.sampleImageUrls) {
            console.log(`\nTesting ${sampleImage.canvasLabel} (Canvas ${sampleImage.canvasIndex + 1}):`);
            
            const variants = this.generateResolutionVariants(sampleImage.originalUrl);
            const testResults = [];

            for (const variant of variants) {
                const result = await this.testImageResolution(variant.url, variant.parameter, variant.description);
                testResults.push(result);
                
                // Add small delay between requests
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            this.results.resolutionTests.push({
                canvasIndex: sampleImage.canvasIndex,
                canvasLabel: sampleImage.canvasLabel,
                originalUrl: sampleImage.originalUrl,
                testResults
            });
        }
    }

    analyzeResults() {
        console.log('\n=== Analysis Results ===');
        
        // Find best performing resolutions
        const successfulResults = [];
        const failedResolutions = new Set();

        for (const test of this.results.resolutionTests) {
            for (const result of test.testResults) {
                if (result.success && result.contentLength) {
                    successfulResults.push({
                        ...result,
                        canvasIndex: test.canvasIndex,
                        canvasLabel: test.canvasLabel
                    });
                } else if (!result.success) {
                    failedResolutions.add(result.parameter);
                }
            }
        }

        // Group by parameter and calculate averages
        const parameterStats = {};
        for (const result of successfulResults) {
            if (!parameterStats[result.parameter]) {
                parameterStats[result.parameter] = {
                    parameter: result.parameter,
                    description: result.description,
                    totalSize: 0,
                    totalTime: 0,
                    count: 0,
                    sizes: []
                };
            }
            
            parameterStats[result.parameter].totalSize += result.contentLength;
            parameterStats[result.parameter].totalTime += result.responseTime;
            parameterStats[result.parameter].count++;
            parameterStats[result.parameter].sizes.push(result.contentLength);
        }

        // Calculate averages and find best options
        const statsSummary = Object.values(parameterStats).map(stat => ({
            parameter: stat.parameter,
            description: stat.description,
            avgSize: Math.round(stat.totalSize / stat.count),
            avgTime: Math.round(stat.totalTime / stat.count),
            maxSize: Math.max(...stat.sizes),
            minSize: Math.min(...stat.sizes),
            count: stat.count
        })).sort((a, b) => b.avgSize - a.avgSize);

        console.log('\nResolution Performance Ranking (by average file size):');
        statsSummary.forEach((stat, index) => {
            console.log(`${index + 1}. ${stat.description}`);
            console.log(`   Parameter: ${stat.parameter}`);
            console.log(`   Avg Size: ${Math.round(stat.avgSize / 1024)}KB`);
            console.log(`   Max Size: ${Math.round(stat.maxSize / 1024)}KB`);
            console.log(`   Avg Time: ${stat.avgTime}ms`);
            console.log(`   Tested: ${stat.count}/${this.results.resolutionTests.length} pages`);
            console.log();
        });

        if (failedResolutions.size > 0) {
            console.log('Failed resolution parameters:');
            Array.from(failedResolutions).forEach(param => {
                console.log(`- ${param}`);
            });
            console.log();
        }

        // Generate recommendations
        this.generateRecommendations(statsSummary, failedResolutions);
    }

    generateRecommendations(statsSummary, failedResolutions) {
        const recommendations = [];
        
        if (statsSummary.length === 0) {
            recommendations.push({
                type: 'error',
                message: 'No successful resolution tests found. Keep current implementation.',
                action: 'No changes needed'
            });
        } else {
            const best = statsSummary[0];
            const current = statsSummary.find(s => s.parameter === 'full/2000,/0/default.jpg');
            
            if (best.parameter !== 'full/2000,/0/default.jpg') {
                const improvement = current ? 
                    Math.round(((best.avgSize - current.avgSize) / current.avgSize) * 100) : 
                    'unknown';
                
                recommendations.push({
                    type: 'improvement',
                    message: `Higher resolution available: ${best.description}`,
                    currentParam: 'full/2000,/0/default.jpg',
                    recommendedParam: best.parameter,
                    improvementPercent: improvement,
                    avgSizeIncrease: `${Math.round((best.avgSize - (current?.avgSize || 0)) / 1024)}KB`,
                    action: `Update line 1665 in EnhancedManuscriptDownloaderService.ts`
                });
            } else {
                recommendations.push({
                    type: 'optimal',
                    message: 'Current 2000px setting is already optimal',
                    action: 'No changes needed'
                });
            }

            // Check for max resolution
            const maxParam = statsSummary.find(s => s.parameter === 'full/max/0/default.jpg');
            if (maxParam && maxParam.parameter !== best.parameter) {
                recommendations.push({
                    type: 'alternative',
                    message: 'Consider testing /full/max/ parameter for future optimizations',
                    details: `Max resolution: ${Math.round(maxParam.avgSize / 1024)}KB avg`
                });
            }
        }

        this.results.recommendations = recommendations;
        
        console.log('=== Recommendations ===');
        recommendations.forEach((rec, index) => {
            console.log(`${index + 1}. [${rec.type.toUpperCase()}] ${rec.message}`);
            if (rec.currentParam) console.log(`   Current: ${rec.currentParam}`);
            if (rec.recommendedParam) console.log(`   Recommended: ${rec.recommendedParam}`);
            if (rec.improvementPercent) console.log(`   Improvement: +${rec.improvementPercent}%`);
            if (rec.avgSizeIncrease) console.log(`   Size increase: ${rec.avgSizeIncrease}`);
            if (rec.action) console.log(`   Action: ${rec.action}`);
            if (rec.details) console.log(`   Details: ${rec.details}`);
            console.log();
        });
    }

    async saveReport() {
        const reportPath = path.join(this.reportDir, 'karlsruhe-resolution-analysis-results.json');
        fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
        console.log(`Report saved to: ${reportPath}`);
    }

    async analyzeDirectAccess(directUrl) {
        console.log('\n=== Testing Direct Access URL ===');
        console.log('URL:', directUrl);
        
        try {
            const response = await this.fetchWithFallback(directUrl);
            console.log(`Status: ${response.status}`);
            console.log(`Content-Type: ${response.headers['content-type'] || 'Unknown'}`);
            console.log(`Content-Length: ${response.headers['content-length'] || 'Unknown'}`);
            
            if (response.ok) {
                const contentType = response.headers['content-type'] || '';
                if (contentType.includes('text/html')) {
                    console.log('Direct URL returns HTML page (likely a viewer interface)');
                } else if (contentType.includes('image/')) {
                    console.log('Direct URL returns image file');
                } else {
                    console.log('Direct URL returns other content type');
                }
            } else {
                console.log(`Direct URL failed with HTTP ${response.status}`);
            }
        } catch (error) {
            console.log(`Direct URL test failed: ${error.message}`);
        }
    }
}

async function main() {
    const analyzer = new KarlsruheResolutionAnalyzer();
    
    try {
        console.log('=== Karlsruhe Library Resolution Analysis ===\n');
        
        // Test provided URLs
        const manifestUrl = 'https://digital.blb-karlsruhe.de/i3f/v20/192435/manifest';
        const directUrl = 'https://digital.blb-karlsruhe.de/blbhs/content/pageview/221207';
        
        // Analyze IIIF manifest
        await analyzer.analyzeManifest(manifestUrl);
        
        // Test direct access URL
        await analyzer.analyzeDirectAccess(directUrl);
        
        // Test all resolution parameters
        await analyzer.testAllResolutions();
        
        // Analyze results and generate recommendations
        analyzer.analyzeResults();
        
        // Save detailed report
        await analyzer.saveReport();
        
        console.log('\n=== Analysis Complete ===');
        console.log('Check the generated report for detailed findings.');
        
    } catch (error) {
        console.error('Analysis failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}