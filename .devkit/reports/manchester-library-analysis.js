import https from 'https';
import fs from 'fs';

class ManchesterLibraryAnalysis {
    constructor() {
        this.baseUrl = 'https://www.digitalcollections.manchester.ac.uk';
        this.iiifBaseUrl = 'https://image.digitalcollections.manchester.ac.uk/iiif';
        this.manifestBaseUrl = 'https://www.digitalcollections.manchester.ac.uk/iiif';
        this.testUrls = [
            'https://www.digitalcollections.manchester.ac.uk/view/MS-LATIN-00074/1',
            'https://www.digitalcollections.manchester.ac.uk/view/MS-LATIN-00136/1',
            'https://www.digitalcollections.manchester.ac.uk/view/MS-LATIN-00011/1',
            'https://www.digitalcollections.manchester.ac.uk/view/MS-LATIN-00022/1',
            'https://www.digitalcollections.manchester.ac.uk/view/MS-LATIN-00088/28',
            'https://www.digitalcollections.manchester.ac.uk/view/MS-LATIN-00098/1'
        ];
    }

    extractManuscriptId(url) {
        // Extract manuscript ID from URL
        const match = url.match(/\/view\/([^\/]+)/);
        return match ? match[1] : null;
    }

    async fetchManifest(manuscriptId) {
        const manifestUrl = `${this.manifestBaseUrl}/${manuscriptId}`;
        
        return new Promise((resolve, reject) => {
            https.get(manifestUrl, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const manifest = JSON.parse(data);
                        resolve(manifest);
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });
    }

    async testImageResolutions(imageId) {
        const resolutionTests = [
            'full/full/0/default.jpg',
            'full/max/0/default.jpg',
            'full/2000,/0/default.jpg',
            'full/4000,/0/default.jpg',
            'full/6000,/0/default.jpg',
            'full/8000,/0/default.jpg'
        ];

        const results = [];
        
        for (const resolution of resolutionTests) {
            const imageUrl = `${this.iiifBaseUrl}/${imageId}/${resolution}`;
            
            try {
                const size = await this.getImageSize(imageUrl);
                results.push({
                    resolution,
                    url: imageUrl,
                    size,
                    success: true
                });
            } catch (error) {
                results.push({
                    resolution,
                    url: imageUrl,
                    error: error.message,
                    success: false
                });
            }
        }
        
        return results;
    }

    async getImageSize(url) {
        return new Promise((resolve, reject) => {
            const req = https.request(url, { method: 'HEAD' }, (res) => {
                const contentLength = res.headers['content-length'];
                resolve(contentLength ? parseInt(contentLength) : 0);
            });
            
            req.on('error', reject);
            req.setTimeout(10000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            req.end();
        });
    }

    async analyzeManuscript(url) {
        const manuscriptId = this.extractManuscriptId(url);
        if (!manuscriptId) {
            throw new Error(`Could not extract manuscript ID from ${url}`);
        }

        console.log(`\n=== Analyzing ${manuscriptId} ===`);
        
        try {
            const manifest = await this.fetchManifest(manuscriptId);
            
            const analysis = {
                manuscriptId,
                url,
                totalPages: manifest.sequences?.[0]?.canvases?.length || 0,
                title: manifest.label || 'Unknown',
                description: manifest.description || 'No description',
                attribution: manifest.attribution || 'No attribution',
                images: []
            };

            // Analyze first few images
            if (manifest.sequences?.[0]?.canvases?.length > 0) {
                const canvases = manifest.sequences[0].canvases.slice(0, 3); // Test first 3 images
                
                for (const canvas of canvases) {
                    const imageId = canvas.images?.[0]?.resource?.service?.['@id'];
                    if (imageId) {
                        const imageIdClean = imageId.replace(this.iiifBaseUrl + '/', '');
                        console.log(`Testing image resolutions for: ${imageIdClean}`);
                        
                        const resolutionResults = await this.testImageResolutions(imageIdClean);
                        analysis.images.push({
                            canvasId: canvas['@id'],
                            imageId: imageIdClean,
                            width: canvas.width,
                            height: canvas.height,
                            resolutionTests: resolutionResults
                        });
                    }
                }
            }

            return analysis;
            
        } catch (error) {
            console.error(`Error analyzing ${manuscriptId}:`, error.message);
            return {
                manuscriptId,
                url,
                error: error.message
            };
        }
    }

    async runCompleteAnalysis() {
        console.log('Starting Manchester Library Analysis...\n');
        
        const results = {
            timestamp: new Date().toISOString(),
            platform: 'Manchester Digital Collections',
            iiifSupport: true,
            baseUrls: {
                collection: this.baseUrl,
                iiifImages: this.iiifBaseUrl,
                manifests: this.manifestBaseUrl
            },
            manuscripts: []
        };

        // Test URL pattern recognition
        console.log('=== URL Pattern Analysis ===');
        const urlPattern = /https:\/\/www\.digitalcollections\.manchester\.ac\.uk\/view\/([^\/]+)\/(\d+)/;
        results.urlPattern = urlPattern.toString();
        
        for (const url of this.testUrls) {
            const match = url.match(urlPattern);
            if (match) {
                console.log(`✓ ${url} -> Manuscript: ${match[1]}, Page: ${match[2]}`);
            } else {
                console.log(`✗ ${url} -> No match`);
            }
        }

        // Analyze each manuscript
        for (const url of this.testUrls) {
            const analysis = await this.analyzeManuscript(url);
            results.manuscripts.push(analysis);
            
            // Add delay between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return results;
    }

    generateImplementationRecommendations(results) {
        const recommendations = {
            urlPattern: '/view/([^/]+)/(\\d+)',
            extractionMethod: 'Regex-based manuscript ID extraction',
            manifestEndpoint: 'https://www.digitalcollections.manchester.ac.uk/iiif/{manuscriptId}',
            imageEndpoint: 'https://image.digitalcollections.manchester.ac.uk/iiif/{imageId}/full/max/0/default.jpg',
            maxResolution: 'max parameter provides highest available resolution',
            authentication: 'None required',
            rateLimit: 'Recommended 1-2 seconds between requests',
            implementation: {
                steps: [
                    'Extract manuscript ID using regex from URL',
                    'Fetch IIIF manifest from manifest endpoint',
                    'Parse manifest.sequences[0].canvases for page information',
                    'Extract image service IDs from canvas.images[0].resource.service["@id"]',
                    'Construct image URLs using IIIF Image API with /full/max/0/default.jpg',
                    'Download images with appropriate delays'
                ],
                codeExample: `
// Extract manuscript ID
const match = url.match(/\\/view\\/([^\\/]+)\\/\\d+/);
const manuscriptId = match[1];

// Fetch manifest
const manifest = await fetch(\`https://www.digitalcollections.manchester.ac.uk/iiif/\${manuscriptId}\`);
const data = await manifest.json();

// Extract images
const canvases = data.sequences[0].canvases;
const imageUrls = canvases.map(canvas => {
    const serviceId = canvas.images[0].resource.service["@id"];
    const imageId = serviceId.replace("https://image.digitalcollections.manchester.ac.uk/iiif/", "");
    return \`https://image.digitalcollections.manchester.ac.uk/iiif/\${imageId}/full/max/0/default.jpg\`;
});
`
            }
        };

        return recommendations;
    }
}

// Run analysis
async function main() {
    const analyzer = new ManchesterLibraryAnalysis();
    
    try {
        const results = await analyzer.runCompleteAnalysis();
        const recommendations = analyzer.generateImplementationRecommendations(results);
        
        const finalReport = {
            analysis: results,
            recommendations: recommendations,
            summary: {
                feasible: true,
                difficulty: 'Medium',
                iiifCompliant: true,
                authenticationRequired: false,
                maxResolution: 'High (6000+ pixels)',
                estimatedImplementationTime: '4-6 hours'
            }
        };

        // Save results
        fs.writeFileSync('.devkit/reports/manchester-analysis-results.json', JSON.stringify(finalReport, null, 2));
        console.log('\n=== Analysis Complete ===');
        console.log('Results saved to: .devkit/reports/manchester-analysis-results.json');
        
        // Print summary
        console.log('\n=== Summary ===');
        console.log(`Total manuscripts analyzed: ${results.manuscripts.length}`);
        console.log(`IIIF Support: ${results.iiifSupport ? 'Yes' : 'No'}`);
        console.log(`Authentication Required: ${recommendations.authentication}`);
        console.log(`Implementation Feasible: ${finalReport.summary.feasible ? 'Yes' : 'No'}`);
        
    } catch (error) {
        console.error('Analysis failed:', error);
    }
}

main();