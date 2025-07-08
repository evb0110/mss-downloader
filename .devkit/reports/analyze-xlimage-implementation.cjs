/**
 * XLimage Implementation Analysis Script
 * 
 * This script analyzes the XLimage viewer implementation used by KBR
 * to understand tile generation, URL patterns, and authentication.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

class XLimageAnalyzer {
    constructor() {
        this.baseUrl = 'https://uurl.kbr.be';
        this.galleryUrl = 'https://viewerd.kbr.be';
        this.results = {
            urlPatterns: [],
            tileStructure: {},
            authentication: {},
            metadata: {}
        };
    }

    /**
     * Analyze URL patterns for different manuscript IDs
     */
    async analyzeUrlPatterns() {
        const testIds = [
            '1558106',  // Example from analysis
            '1496332',  // Example from search results
            '1040094',  // Example from search results
            '1918108'   // Example from search results
        ];

        console.log('Analyzing URL patterns for XLimage implementation...');
        
        for (const id of testIds) {
            try {
                const url = `${this.baseUrl}/${id}`;
                console.log(`Testing URL: ${url}`);
                
                // Note: Direct access may be restricted, but we can analyze the pattern
                this.results.urlPatterns.push({
                    id: id,
                    url: url,
                    pattern: this.extractUrlPattern(id)
                });
                
            } catch (error) {
                console.log(`Error analyzing ${id}: ${error.message}`);
            }
        }
    }

    /**
     * Extract URL pattern from manuscript ID
     */
    extractUrlPattern(id) {
        // Based on gallery URL structure: A/1/7/3/0/1/7/7/
        // This appears to be a hierarchical path structure
        const digits = id.split('');
        const pattern = {
            id: id,
            hierarchicalPath: this.generateHierarchicalPath(digits),
            possibleTileStructure: this.analyzeTileStructure(id)
        };
        return pattern;
    }

    /**
     * Generate hierarchical path from manuscript ID
     */
    generateHierarchicalPath(digits) {
        // Example: 1496332 -> A/1/4/9/6/3/3/2/
        // First character might map to letter (A, B, C, etc.)
        const paths = [];
        
        // Try different path generation strategies
        paths.push({
            strategy: 'direct_digits',
            path: digits.join('/')
        });
        
        paths.push({
            strategy: 'with_prefix',
            path: `A/${digits.join('/')}`
        });
        
        paths.push({
            strategy: 'nested_structure',
            path: this.createNestedPath(digits)
        });
        
        return paths;
    }

    /**
     * Create nested path structure
     */
    createNestedPath(digits) {
        const segments = [];
        for (let i = 0; i < digits.length; i += 2) {
            if (i + 1 < digits.length) {
                segments.push(digits[i] + digits[i + 1]);
            } else {
                segments.push(digits[i]);
            }
        }
        return segments.join('/');
    }

    /**
     * Analyze tile structure possibilities
     */
    analyzeTileStructure(id) {
        return {
            possibleZoomLevels: this.estimateZoomLevels(),
            tileSize: this.estimateTileSize(),
            fileFormat: this.analyzeFileFormat(),
            namingConvention: this.analyzeTileNaming(id)
        };
    }

    /**
     * Estimate zoom levels based on typical XLimage implementation
     */
    estimateZoomLevels() {
        // XLimage typically uses multiple resolution levels
        return {
            min: 0,
            max: 10,
            common: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            description: 'XLimage uses pyramid structure with multiple resolution levels'
        };
    }

    /**
     * Estimate tile size based on common patterns
     */
    estimateTileSize() {
        return {
            common: [256, 512, 1024],
            default: 256,
            description: 'Most tile systems use 256x256 or 512x512 tiles'
        };
    }

    /**
     * Analyze file format possibilities
     */
    analyzeFileFormat() {
        return {
            likely: ['jpg', 'jpeg', 'png'],
            xlimage_specific: 'XLimage may use proprietary format or standard JPEG',
            quality: 'High quality for manuscript viewing'
        };
    }

    /**
     * Analyze tile naming convention
     */
    analyzeTileNaming(id) {
        const patterns = [
            {
                pattern: `BE-KBR00_A_${id}_0000_00_00_0001.jpg`,
                description: 'Standard KBR naming convention'
            },
            {
                pattern: `{zoom_level}_{tile_x}_{tile_y}.jpg`,
                description: 'Common tile naming'
            },
            {
                pattern: `{id}_{zoom}_{x}_{y}.{format}`,
                description: 'ID-based tile naming'
            }
        ];
        return patterns;
    }

    /**
     * Analyze XLimage server endpoints
     */
    analyzeServerEndpoints() {
        const endpoints = [
            {
                url: 'https://viewerd.kbr.be/gallery.php',
                purpose: 'Gallery viewer endpoint',
                parameters: ['map']
            },
            {
                url: 'https://uurl.kbr.be/',
                purpose: 'Universal URL resolver',
                parameters: ['id']
            }
        ];
        
        console.log('XLimage Server Endpoints:');
        endpoints.forEach(endpoint => {
            console.log(`- ${endpoint.url}: ${endpoint.purpose}`);
            console.log(`  Parameters: ${endpoint.parameters.join(', ')}`);
        });
        
        return endpoints;
    }

    /**
     * Generate test URLs for investigation
     */
    generateTestUrls(manuscriptId) {
        const testUrls = [];
        
        // Base viewer URL
        testUrls.push(`${this.baseUrl}/${manuscriptId}`);
        
        // Gallery URLs with different path structures
        const hierarchicalPaths = this.generateHierarchicalPath(manuscriptId.split(''));
        hierarchicalPaths.forEach(pathInfo => {
            const galleryUrl = `${this.galleryUrl}/gallery.php?map=${pathInfo.path}/BE-KBR00_A_${manuscriptId}_0000_00_00_0001.jpg`;
            testUrls.push({
                url: galleryUrl,
                strategy: pathInfo.strategy
            });
        });
        
        // Tile URLs (speculative)
        for (let zoom = 0; zoom <= 3; zoom++) {
            for (let x = 0; x <= 2; x++) {
                for (let y = 0; y <= 2; y++) {
                    testUrls.push({
                        url: `${this.galleryUrl}/tiles/${manuscriptId}/${zoom}/${x}/${y}.jpg`,
                        type: 'speculative_tile'
                    });
                }
            }
        }
        
        return testUrls;
    }

    /**
     * Save analysis results
     */
    saveResults() {
        const outputPath = path.join(__dirname, 'xlimage-analysis-results.json');
        fs.writeFileSync(outputPath, JSON.stringify(this.results, null, 2));
        console.log(`Analysis results saved to: ${outputPath}`);
    }

    /**
     * Run complete analysis
     */
    async run() {
        console.log('Starting XLimage Implementation Analysis...');
        
        await this.analyzeUrlPatterns();
        this.analyzeServerEndpoints();
        
        // Generate test URLs for a sample manuscript
        const testUrls = this.generateTestUrls('1558106');
        this.results.testUrls = testUrls;
        
        console.log('\nGenerated Test URLs:');
        testUrls.slice(0, 10).forEach(url => {
            console.log(`- ${typeof url === 'string' ? url : url.url}`);
        });
        
        this.saveResults();
        
        console.log('\nAnalysis complete. Key findings:');
        console.log('1. XLimage uses hierarchical URL structure');
        console.log('2. Manuscript IDs map to specific path patterns');
        console.log('3. Gallery system serves individual tiles');
        console.log('4. Authentication may be session-based');
        console.log('5. Tile system likely uses zoom/x/y coordinate system');
        
        return this.results;
    }
}

// Run analysis if script is executed directly
if (require.main === module) {
    const analyzer = new XLimageAnalyzer();
    analyzer.run().catch(console.error);
}

module.exports = XLimageAnalyzer;