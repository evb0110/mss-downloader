#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class DIAMMHTTPAnalyzer {
    constructor() {
        this.results = {
            timestamp: new Date().toISOString(),
            baseUrls: [
                'https://iiif.diamm.net',
                'https://iiif.diamm.net/manifests',
                'https://www.diamm.ac.uk'
            ],
            manifestTests: [],
            imageTests: [],
            httpAnalysis: [],
            errorAnalysis: [],
            recommendations: []
        };
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async curlTest(url, options = {}) {
        const {
            userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            timeout = 30,
            followRedirects = true,
            headers = {},
            verbose = false
        } = options;

        const curlCommand = [
            'curl',
            '-s',
            '-w', '"HTTP_CODE:%{http_code}\\nTIME_TOTAL:%{time_total}\\nTIME_CONNECT:%{time_connect}\\nTIME_NAMELOOKUP:%{time_namelookup}\\nSIZE_DOWNLOAD:%{size_download}\\nSIZE_HEADER:%{size_header}\\nCONTENT_TYPE:%{content_type}\\nREDIRECT_URL:%{redirect_url}\\n"',
            '-H', `"User-Agent: ${userAgent}"`,
            '-H', '"Accept: */*"',
            '-H', '"Accept-Language: en-US,en;q=0.9"',
            '-H', '"Accept-Encoding: gzip, deflate, br"',
            '-H', '"Connection: keep-alive"',
            '-H', '"Upgrade-Insecure-Requests: 1"',
            '-H', '"Cache-Control: no-cache"',
            '-H', '"Pragma: no-cache"',
            timeout ? `--max-time ${timeout}` : '',
            followRedirects ? '-L' : '',
            verbose ? '-v' : '',
            `"${url}"`
        ].filter(Boolean).join(' ');

        try {
            const result = execSync(curlCommand, { 
                encoding: 'utf8',
                timeout: (timeout + 10) * 1000,
                maxBuffer: 10 * 1024 * 1024 // 10MB
            });

            const lines = result.split('\n');
            const contentStartIndex = lines.findIndex(line => line.startsWith('HTTP_CODE:'));
            const content = lines.slice(0, contentStartIndex).join('\n');
            const stats = {};

            for (let i = contentStartIndex; i < lines.length; i++) {
                const line = lines[i];
                if (line.includes(':')) {
                    const [key, value] = line.split(':', 2);
                    stats[key] = value;
                }
            }

            return {
                success: true,
                content,
                stats,
                command: curlCommand
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                command: curlCommand
            };
        }
    }

    async testDIAMMConnectivity() {
        console.log('\n=== DIAMM Connectivity Testing ===');
        
        const testUrls = [
            'https://iiif.diamm.net',
            'https://iiif.diamm.net/manifests',
            'https://www.diamm.ac.uk',
            'https://www.diamm.ac.uk/sources',
            'https://www.diamm.ac.uk/sources/1',
            'https://www.diamm.ac.uk/sources/2',
            'https://www.diamm.ac.uk/sources/3',
            'https://www.diamm.ac.uk/sources/4',
            'https://www.diamm.ac.uk/sources/5'
        ];

        for (const url of testUrls) {
            console.log(`Testing: ${url}`);
            const result = await this.curlTest(url, { timeout: 15 });
            
            this.results.httpAnalysis.push({
                url,
                success: result.success,
                httpCode: result.stats?.HTTP_CODE || 'N/A',
                timeTotal: result.stats?.TIME_TOTAL || 'N/A',
                timeConnect: result.stats?.TIME_CONNECT || 'N/A',
                contentType: result.stats?.CONTENT_TYPE || 'N/A',
                sizeDownload: result.stats?.SIZE_DOWNLOAD || 'N/A',
                redirectUrl: result.stats?.REDIRECT_URL || 'N/A',
                error: result.error || null,
                contentPreview: result.content?.slice(0, 500) || null
            });

            if (result.success) {
                console.log(`  ✓ HTTP ${result.stats?.HTTP_CODE} - ${result.stats?.TIME_TOTAL}s - ${result.stats?.CONTENT_TYPE}`);
            } else {
                console.log(`  ✗ Failed: ${result.error}`);
            }

            await this.sleep(1000); // Rate limiting
        }
    }

    async testDIAMMManifestSearch() {
        console.log('\n=== DIAMM Manifest Discovery ===');
        
        // Test potential manifest endpoint patterns
        const manifestPatterns = [
            'https://iiif.diamm.net/manifests/1',
            'https://iiif.diamm.net/manifests/1/manifest.json',
            'https://iiif.diamm.net/manifests/1/manifest',
            'https://iiif.diamm.net/manifests/source/1',
            'https://iiif.diamm.net/manifests/source/1/manifest.json',
            'https://iiif.diamm.net/source/1/manifest.json',
            'https://iiif.diamm.net/source/1/manifest',
            'https://iiif.diamm.net/iiif/1/manifest',
            'https://iiif.diamm.net/iiif/1/manifest.json',
            'https://iiif.diamm.net/iiif/collection/1',
            'https://iiif.diamm.net/iiif/collection/1/manifest.json'
        ];

        for (const url of manifestPatterns) {
            console.log(`Testing manifest: ${url}`);
            const result = await this.curlTest(url, { timeout: 10 });
            
            this.results.manifestTests.push({
                url,
                success: result.success,
                httpCode: result.stats?.HTTP_CODE || 'N/A',
                contentType: result.stats?.CONTENT_TYPE || 'N/A',
                sizeDownload: result.stats?.SIZE_DOWNLOAD || 'N/A',
                isJsonContent: result.stats?.CONTENT_TYPE?.includes('json') || false,
                contentPreview: result.content?.slice(0, 1000) || null,
                error: result.error || null
            });

            if (result.success && result.stats?.HTTP_CODE === '200') {
                console.log(`  ✓ Found manifest: ${result.stats?.CONTENT_TYPE} - ${result.stats?.SIZE_DOWNLOAD} bytes`);
                if (result.content?.includes('@context')) {
                    console.log(`  ✓ Contains IIIF context - looks like valid manifest`);
                }
            } else {
                console.log(`  ✗ HTTP ${result.stats?.HTTP_CODE || 'Error'}`);
            }

            await this.sleep(500);
        }
    }

    async testDIAMMImageService() {
        console.log('\n=== DIAMM Image Service Testing ===');
        
        // Test potential image service endpoints
        const imageServicePatterns = [
            'https://iiif.diamm.net/iiif/1/info.json',
            'https://iiif.diamm.net/iiif/source/1/info.json',
            'https://iiif.diamm.net/iiif/image/1/info.json',
            'https://iiif.diamm.net/iiif/2/1/info.json',
            'https://iiif.diamm.net/iiif/3/1/info.json',
            'https://iiif.diamm.net/image/1/info.json',
            'https://iiif.diamm.net/image/iiif/1/info.json'
        ];

        for (const url of imageServicePatterns) {
            console.log(`Testing image service: ${url}`);
            const result = await this.curlTest(url, { timeout: 10 });
            
            this.results.imageTests.push({
                url,
                success: result.success,
                httpCode: result.stats?.HTTP_CODE || 'N/A',
                contentType: result.stats?.CONTENT_TYPE || 'N/A',
                sizeDownload: result.stats?.SIZE_DOWNLOAD || 'N/A',
                isJsonContent: result.stats?.CONTENT_TYPE?.includes('json') || false,
                contentPreview: result.content?.slice(0, 1000) || null,
                error: result.error || null
            });

            if (result.success && result.stats?.HTTP_CODE === '200') {
                console.log(`  ✓ Found image service: ${result.stats?.CONTENT_TYPE} - ${result.stats?.SIZE_DOWNLOAD} bytes`);
                if (result.content?.includes('@context')) {
                    console.log(`  ✓ Contains IIIF context - looks like valid image service`);
                }
            } else {
                console.log(`  ✗ HTTP ${result.stats?.HTTP_CODE || 'Error'}`);
            }

            await this.sleep(500);
        }
    }

    async testDIAMMWebsiteStructure() {
        console.log('\n=== DIAMM Website Structure Analysis ===');
        
        const websiteUrl = 'https://www.diamm.ac.uk';
        const result = await this.curlTest(websiteUrl, { timeout: 15 });
        
        if (result.success && result.content) {
            // Look for IIIF-related patterns in the website
            const iiifPatterns = [
                /iiif\.diamm\.net/g,
                /manifest\.json/g,
                /iiif\/[^"'\s]+/g,
                /sources\/\d+/g,
                /viewer/g,
                /mirador/g,
                /collection/g
            ];

            console.log('Looking for IIIF patterns in website...');
            for (const pattern of iiifPatterns) {
                const matches = result.content.match(pattern);
                if (matches) {
                    console.log(`  ✓ Found pattern ${pattern.toString()}: ${matches.length} matches`);
                    console.log(`    Examples: ${matches.slice(0, 3).join(', ')}`);
                }
            }

            // Look for specific source URLs
            const sourceUrls = result.content.match(/\/sources\/\d+/g) || [];
            if (sourceUrls.length > 0) {
                console.log(`  ✓ Found ${sourceUrls.length} source URLs`);
                console.log(`    Examples: ${sourceUrls.slice(0, 5).join(', ')}`);
            }
        }
    }

    async testUserAgentVariations() {
        console.log('\n=== User Agent Testing ===');
        
        const testUrl = 'https://www.diamm.ac.uk';
        const userAgents = [
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
            'IIIF-Manifest-Downloader/1.0',
            'curl/8.0.0',
            'Wget/1.21.0'
        ];

        for (const userAgent of userAgents) {
            console.log(`Testing User-Agent: ${userAgent.slice(0, 50)}...`);
            const result = await this.curlTest(testUrl, { userAgent, timeout: 10 });
            
            if (result.success) {
                console.log(`  ✓ HTTP ${result.stats?.HTTP_CODE} - ${result.stats?.TIME_TOTAL}s`);
            } else {
                console.log(`  ✗ Failed: ${result.error}`);
            }

            await this.sleep(1000);
        }
    }

    async testRateLimiting() {
        console.log('\n=== Rate Limiting Testing ===');
        
        const testUrl = 'https://www.diamm.ac.uk';
        const rapidRequests = [];
        
        // Test with 10 rapid requests
        for (let i = 0; i < 10; i++) {
            const startTime = Date.now();
            const result = await this.curlTest(testUrl, { timeout: 5 });
            const endTime = Date.now();
            
            rapidRequests.push({
                requestNumber: i + 1,
                success: result.success,
                httpCode: result.stats?.HTTP_CODE || 'N/A',
                timeTotal: result.stats?.TIME_TOTAL || 'N/A',
                responseTime: endTime - startTime,
                error: result.error || null
            });

            console.log(`Request ${i + 1}: HTTP ${result.stats?.HTTP_CODE || 'Error'} in ${endTime - startTime}ms`);
            
            // Small delay between requests
            await this.sleep(100);
        }

        // Analyze rate limiting patterns
        const successfulRequests = rapidRequests.filter(r => r.success);
        const avgResponseTime = successfulRequests.reduce((sum, r) => sum + r.responseTime, 0) / successfulRequests.length;
        
        console.log(`\nRate Limiting Analysis:`);
        console.log(`  - Successful requests: ${successfulRequests.length}/10`);
        console.log(`  - Average response time: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`  - Failed requests: ${rapidRequests.filter(r => !r.success).length}`);
        
        this.results.rateLimitingAnalysis = {
            totalRequests: rapidRequests.length,
            successfulRequests: successfulRequests.length,
            avgResponseTime: avgResponseTime,
            requests: rapidRequests
        };
    }

    async generateRecommendations() {
        console.log('\n=== Generating HTTP Implementation Recommendations ===');
        
        const recommendations = [];
        
        // Analyze successful endpoints
        const successfulEndpoints = this.results.httpAnalysis.filter(r => r.success && r.httpCode === '200');
        const manifestEndpoints = this.results.manifestTests.filter(r => r.success && r.httpCode === '200');
        const imageEndpoints = this.results.imageTests.filter(r => r.success && r.httpCode === '200');
        
        if (successfulEndpoints.length > 0) {
            recommendations.push({
                category: 'Base Connectivity',
                priority: 'High',
                recommendation: `DIAMM services are accessible. Base URL patterns work: ${successfulEndpoints.map(e => e.url).join(', ')}`
            });
            
            const avgResponseTime = successfulEndpoints.reduce((sum, e) => sum + parseFloat(e.timeTotal || '0'), 0) / successfulEndpoints.length;
            recommendations.push({
                category: 'Performance',
                priority: 'Medium',
                recommendation: `Average response time is ${avgResponseTime.toFixed(2)}s. Consider implementing timeout of 15-30s for reliability.`
            });
        }

        if (manifestEndpoints.length > 0) {
            recommendations.push({
                category: 'Manifest Discovery',
                priority: 'High',
                recommendation: `Found working manifest endpoints: ${manifestEndpoints.map(e => e.url).join(', ')}`
            });
        } else {
            recommendations.push({
                category: 'Manifest Discovery',
                priority: 'Critical',
                recommendation: 'No working manifest endpoints found. Need to investigate DIAMM API documentation or contact DIAMM team.'
            });
        }

        if (imageEndpoints.length > 0) {
            recommendations.push({
                category: 'Image Service',
                priority: 'High',
                recommendation: `Found working image service endpoints: ${imageEndpoints.map(e => e.url).join(', ')}`
            });
        } else {
            recommendations.push({
                category: 'Image Service',
                priority: 'Critical',
                recommendation: 'No working image service endpoints found. Need to investigate DIAMM IIIF implementation.'
            });
        }

        // HTTP Headers recommendations
        recommendations.push({
            category: 'HTTP Headers',
            priority: 'Medium',
            recommendation: 'Use standard browser User-Agent for best compatibility. Include Accept-Language and standard browser headers.'
        });

        recommendations.push({
            category: 'Error Handling',
            priority: 'High',
            recommendation: 'Implement robust error handling with retry logic. Use exponential backoff for rate limiting.'
        });

        recommendations.push({
            category: 'Rate Limiting',
            priority: 'Medium',
            recommendation: 'Implement delays between requests (500-1000ms) to be respectful to DIAMM servers.'
        });

        this.results.recommendations = recommendations;
        
        recommendations.forEach(rec => {
            console.log(`${rec.category} (${rec.priority}): ${rec.recommendation}`);
        });
    }

    async runAnalysis() {
        console.log('Starting DIAMM HTTP Analysis...');
        
        try {
            await this.testDIAMMConnectivity();
            await this.testDIAMMManifestSearch();
            await this.testDIAMMImageService();
            await this.testDIAMMWebsiteStructure();
            await this.testUserAgentVariations();
            await this.testRateLimiting();
            await this.generateRecommendations();
            
            console.log('\n=== Analysis Complete ===');
            return this.results;
            
        } catch (error) {
            console.error('Analysis failed:', error);
            this.results.error = error.message;
            return this.results;
        }
    }

    async saveResults() {
        const outputPath = path.join(__dirname, '../reports/agent3-diamm-http-analysis.json');
        await fs.promises.writeFile(outputPath, JSON.stringify(this.results, null, 2));
        console.log(`\nResults saved to: ${outputPath}`);
    }
}

// Run the analysis
async function main() {
    const analyzer = new DIAMMHTTPAnalyzer();
    const results = await analyzer.runAnalysis();
    await analyzer.saveResults();
    
    console.log('\n=== DIAMM HTTP Analysis Summary ===');
    console.log(`Tested ${results.httpAnalysis.length} connectivity endpoints`);
    console.log(`Tested ${results.manifestTests.length} manifest endpoints`);
    console.log(`Tested ${results.imageTests.length} image service endpoints`);
    console.log(`Generated ${results.recommendations.length} recommendations`);
    
    process.exit(0);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = DIAMMHTTPAnalyzer;