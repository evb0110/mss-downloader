#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class DIAMMHTTPAnalyzer {
    constructor() {
        this.results = {
            timestamp: new Date().toISOString(),
            connectivity: [],
            manifestTests: [],
            imageTests: [],
            recommendations: []
        };
    }

    async curlTest(url, options = {}) {
        const { timeout = 10 } = options;
        
        try {
            const command = `curl -s -w "\\nHTTP_CODE:%{http_code}\\nTIME_TOTAL:%{time_total}\\nCONTENT_TYPE:%{content_type}\\n" --max-time ${timeout} -L "${url}"`;
            const result = execSync(command, { 
                encoding: 'utf8',
                timeout: (timeout + 5) * 1000,
                maxBuffer: 5 * 1024 * 1024
            });

            const lines = result.split('\n');
            const httpCodeLine = lines.find(line => line.startsWith('HTTP_CODE:'));
            const timeLines = lines.find(line => line.startsWith('TIME_TOTAL:'));
            const contentTypeLine = lines.find(line => line.startsWith('CONTENT_TYPE:'));
            
            const httpCode = httpCodeLine ? httpCodeLine.split(':')[1] : 'N/A';
            const timeTotal = timeLines ? timeLines.split(':')[1] : 'N/A';
            const contentType = contentTypeLine ? contentTypeLine.split(':')[1] : 'N/A';
            
            const contentEndIndex = lines.findIndex(line => line.startsWith('HTTP_CODE:'));
            const content = lines.slice(0, contentEndIndex).join('\n');

            return {
                success: true,
                httpCode,
                timeTotal,
                contentType,
                content,
                command
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                command: `curl -s -w "\\nHTTP_CODE:%{http_code}\\nTIME_TOTAL:%{time_total}\\nCONTENT_TYPE:%{content_type}\\n" --max-time ${timeout} -L "${url}"`
            };
        }
    }

    async testBasicConnectivity() {
        console.log('=== Testing Basic DIAMM Connectivity ===');
        
        const testUrls = [
            'https://www.diamm.ac.uk',
            'https://iiif.diamm.net',
            'https://www.diamm.ac.uk/sources',
            'https://www.diamm.ac.uk/sources/1',
            'https://www.diamm.ac.uk/sources/2',
            'https://www.diamm.ac.uk/sources/3'
        ];

        for (const url of testUrls) {
            console.log(`Testing: ${url}`);
            const result = await this.curlTest(url, { timeout: 15 });
            
            this.results.connectivity.push({
                url,
                success: result.success,
                httpCode: result.httpCode,
                timeTotal: result.timeTotal,
                contentType: result.contentType,
                error: result.error || null,
                hasContent: result.content && result.content.length > 0
            });

            if (result.success && result.httpCode === '200') {
                console.log(`  ✓ HTTP ${result.httpCode} - ${result.timeTotal}s - ${result.contentType}`);
            } else {
                console.log(`  ✗ ${result.success ? `HTTP ${result.httpCode}` : `Error: ${result.error?.slice(0, 100)}`}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    async testManifestEndpoints() {
        console.log('\n=== Testing Manifest Endpoints ===');
        
        const manifestUrls = [
            'https://iiif.diamm.net/manifests/1',
            'https://iiif.diamm.net/manifests/1/manifest.json',
            'https://iiif.diamm.net/manifests/source/1',
            'https://iiif.diamm.net/manifests/source/1/manifest.json',
            'https://iiif.diamm.net/source/1/manifest.json',
            'https://iiif.diamm.net/iiif/1/manifest',
            'https://iiif.diamm.net/iiif/1/manifest.json'
        ];

        for (const url of manifestUrls) {
            console.log(`Testing: ${url}`);
            const result = await this.curlTest(url, { timeout: 10 });
            
            this.results.manifestTests.push({
                url,
                success: result.success,
                httpCode: result.httpCode,
                contentType: result.contentType,
                isJson: result.contentType && result.contentType.includes('json'),
                hasIIIFContext: result.content && result.content.includes('@context'),
                error: result.error || null
            });

            if (result.success && result.httpCode === '200') {
                console.log(`  ✓ HTTP ${result.httpCode} - ${result.contentType}`);
                if (result.content && result.content.includes('@context')) {
                    console.log(`    Contains IIIF @context`);
                }
            } else {
                console.log(`  ✗ ${result.success ? `HTTP ${result.httpCode}` : 'Connection failed'}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    async testImageService() {
        console.log('\n=== Testing Image Service ===');
        
        const imageUrls = [
            'https://iiif.diamm.net/iiif/1/info.json',
            'https://iiif.diamm.net/iiif/image/1/info.json',
            'https://iiif.diamm.net/iiif/2/1/info.json',
            'https://iiif.diamm.net/iiif/3/1/info.json',
            'https://iiif.diamm.net/image/1/info.json'
        ];

        for (const url of imageUrls) {
            console.log(`Testing: ${url}`);
            const result = await this.curlTest(url, { timeout: 10 });
            
            this.results.imageTests.push({
                url,
                success: result.success,
                httpCode: result.httpCode,
                contentType: result.contentType,
                error: result.error || null
            });

            if (result.success && result.httpCode === '200') {
                console.log(`  ✓ HTTP ${result.httpCode} - ${result.contentType}`);
            } else {
                console.log(`  ✗ ${result.success ? `HTTP ${result.httpCode}` : 'Connection failed'}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    async generateRecommendations() {
        console.log('\n=== Generating Recommendations ===');
        
        const workingConnections = this.results.connectivity.filter(r => r.success && r.httpCode === '200');
        const workingManifests = this.results.manifestTests.filter(r => r.success && r.httpCode === '200');
        const workingImages = this.results.imageTests.filter(r => r.success && r.httpCode === '200');
        
        if (workingConnections.length > 0) {
            this.results.recommendations.push({
                category: 'Connectivity',
                status: 'Working',
                message: `Found ${workingConnections.length} working DIAMM endpoints`,
                urls: workingConnections.map(c => c.url)
            });
        } else {
            this.results.recommendations.push({
                category: 'Connectivity',
                status: 'Failed',
                message: 'No working DIAMM endpoints found - may need VPN or authentication',
                urls: []
            });
        }

        if (workingManifests.length > 0) {
            this.results.recommendations.push({
                category: 'Manifests',
                status: 'Working',
                message: `Found ${workingManifests.length} working manifest endpoints`,
                urls: workingManifests.map(m => m.url)
            });
        } else {
            this.results.recommendations.push({
                category: 'Manifests',
                status: 'Failed',
                message: 'No working manifest endpoints found - need to investigate DIAMM API',
                urls: []
            });
        }

        if (workingImages.length > 0) {
            this.results.recommendations.push({
                category: 'Images',
                status: 'Working',
                message: `Found ${workingImages.length} working image service endpoints`,
                urls: workingImages.map(i => i.url)
            });
        } else {
            this.results.recommendations.push({
                category: 'Images',
                status: 'Failed',
                message: 'No working image service endpoints found',
                urls: []
            });
        }

        // Print recommendations
        this.results.recommendations.forEach(rec => {
            console.log(`${rec.category}: ${rec.status} - ${rec.message}`);
            if (rec.urls.length > 0) {
                rec.urls.forEach(url => console.log(`  - ${url}`));
            }
        });
    }

    async saveResults() {
        const outputPath = path.join(__dirname, '../reports/agent3-diamm-http-analysis.json');
        await fs.promises.writeFile(outputPath, JSON.stringify(this.results, null, 2));
        console.log(`\nResults saved to: ${outputPath}`);
    }

    async run() {
        console.log('Starting DIAMM HTTP Analysis...\n');
        
        try {
            await this.testBasicConnectivity();
            await this.testManifestEndpoints();
            await this.testImageService();
            await this.generateRecommendations();
            await this.saveResults();
            
            console.log('\n=== Analysis Complete ===');
            
        } catch (error) {
            console.error('Analysis failed:', error);
            this.results.error = error.message;
        }
    }
}

// Run analysis
const analyzer = new DIAMMHTTPAnalyzer();
analyzer.run().catch(console.error);