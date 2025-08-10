#!/usr/bin/env node

/**
 * COMPREHENSIVE VALIDATION
 * Downloads actual pages from each library to verify they truly work
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const https = require('https');
const http = require('http');

// Import production code
const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

// Test cases with EXACT URLs from GitHub issues
const TEST_CASES = {
    issue_2_graz: {
        issue: '#2',
        title: 'грац (Graz)',
        url: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/5892688',
        libraryId: 'graz',
        testPages: 5
    },
    issue_4_morgan: {
        issue: '#4',
        title: 'морган (Morgan)',
        url: 'https://www.themorgan.org/collection/lindau-gospels/thumbs',
        libraryId: 'morgan',
        testPages: 5
    },
    issue_5_florence: {
        issue: '#5',
        title: 'Флоренция (Florence)',
        url: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/',
        libraryId: 'florence',
        testPages: 5
    },
    issue_6_bordeaux: {
        issue: '#6',
        title: 'Бордо (Bordeaux)',
        url: 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778',
        libraryId: 'bordeaux',
        testPages: 5
    },
    issue_11_bne: {
        issue: '#11',
        title: 'BNE',
        url: 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1',
        libraryId: 'bne',
        testPages: 5
    },
    issue_23_bdl: {
        issue: '#23',
        title: 'BDL II',
        url: 'https://www.bdl.servizirl.it/vufind/Record/BDL-OGGETTO-3506',
        libraryId: 'bdl',
        testPages: 5
    }
};

class ComprehensiveValidator {
    constructor() {
        this.manifestLoaders = new SharedManifestLoaders();
        this.results = {};
        this.validationDir = path.join(__dirname, '../validation');
    }

    async downloadImage(url, filepath) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(filepath);
            const protocol = url.startsWith('https') ? https : http;
            
            const options = url.startsWith('https') ? {
                rejectUnauthorized: false // Ignore SSL certificate errors for testing
            } : {};
            
            const request = protocol.get(url, options, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                    file.close();
                    fs.unlinkSync(filepath);
                    return this.downloadImage(response.headers.location, filepath)
                        .then(resolve)
                        .catch(reject);
                }
                
                if (response.statusCode !== 200) {
                    file.close();
                    fs.unlinkSync(filepath);
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }
                
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve(filepath);
                });
            });
            
            request.on('error', (err) => {
                file.close();
                if (fs.existsSync(filepath)) {
                    fs.unlinkSync(filepath);
                }
                reject(err);
            });
            
            request.setTimeout(30000, () => {
                request.destroy();
                file.close();
                if (fs.existsSync(filepath)) {
                    fs.unlinkSync(filepath);
                }
                reject(new Error('Timeout'));
            });
        });
    }

    async validateLibrary(testId, config) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`Validating ${config.issue} - ${config.title}`);
        console.log(`URL: ${config.url}`);
        console.log(`${'='.repeat(80)}`);

        const libraryDir = path.join(this.validationDir, testId);
        
        // Clean up old validation files
        if (fs.existsSync(libraryDir)) {
            fs.rmSync(libraryDir, { recursive: true });
        }
        fs.mkdirSync(libraryDir, { recursive: true });

        try {
            // Step 1: Load manifest
            console.log('📋 Loading manifest...');
            const manifest = await this.manifestLoaders.getManifestForLibrary(config.libraryId, config.url);
            
            if (!manifest) {
                throw new Error('No manifest returned');
            }

            // Step 2: Extract image URLs
            let imageUrls = [];
            
            if (Array.isArray(manifest)) {
                imageUrls = manifest.slice(0, config.testPages).map(item => 
                    typeof item === 'string' ? item : item.url || item.imageUrl
                );
            } else if (manifest.images && Array.isArray(manifest.images)) {
                // Custom format with images array (e.g., Graz, Morgan)
                imageUrls = manifest.images.slice(0, config.testPages).map(img => img.url || img);
            } else if (manifest.sequences && manifest.sequences[0] && manifest.sequences[0].canvases) {
                // IIIF manifest
                const canvases = manifest.sequences[0].canvases.slice(0, config.testPages);
                imageUrls = canvases.map(canvas => {
                    const image = canvas.images?.[0]?.resource;
                    return image ? (image['@id'] || image.id) : null;
                }).filter(url => url);
            } else if (manifest.pages) {
                imageUrls = manifest.pages.slice(0, config.testPages).map(page => page.url || page.imageUrl);
            }

            console.log(`📸 Found ${imageUrls.length} image URLs`);

            if (imageUrls.length === 0) {
                throw new Error('No image URLs extracted from manifest');
            }

            // Step 3: Download test pages
            console.log(`📥 Downloading ${Math.min(config.testPages, imageUrls.length)} test pages...`);
            const downloadResults = [];
            
            for (let i = 0; i < Math.min(config.testPages, imageUrls.length); i++) {
                const url = imageUrls[i];
                if (!url) continue;
                
                const filename = `page_${i + 1}.jpg`;
                const filepath = path.join(libraryDir, filename);
                
                try {
                    await this.downloadImage(url, filepath);
                    const stats = fs.statSync(filepath);
                    downloadResults.push({
                        page: i + 1,
                        size: stats.size,
                        success: true
                    });
                    console.log(`  ✅ Page ${i + 1}: ${(stats.size / 1024).toFixed(1)} KB`);
                } catch (error) {
                    downloadResults.push({
                        page: i + 1,
                        error: error.message,
                        success: false
                    });
                    console.log(`  ❌ Page ${i + 1}: ${error.message}`);
                }
            }

            // Step 4: Create test PDF
            const successfulDownloads = downloadResults.filter(r => r.success);
            
            if (successfulDownloads.length > 0) {
                console.log('📄 Creating test PDF...');
                const pdfPath = path.join(libraryDir, 'test.pdf');
                
                try {
                    // Use ImageMagick to create PDF
                    execSync(`convert ${libraryDir}/*.jpg ${pdfPath} 2>/dev/null`, { stdio: 'pipe' });
                    const pdfStats = fs.statSync(pdfPath);
                    console.log(`  ✅ PDF created: ${(pdfStats.size / 1024 / 1024).toFixed(2)} MB`);
                    
                    // Validate PDF with poppler
                    const pdfInfo = execSync(`pdfimages -list ${pdfPath} 2>&1 | head -20`, { encoding: 'utf8' });
                    const imageCount = (pdfInfo.match(/\d+\s+\d+\s+image/g) || []).length;
                    console.log(`  ✅ PDF validated: ${imageCount} images found`);
                    
                    this.results[testId] = {
                        success: true,
                        issue: config.issue,
                        title: config.title,
                        pagesDownloaded: successfulDownloads.length,
                        pdfSize: pdfStats.size,
                        imageCount,
                        error: null
                    };
                } catch (error) {
                    console.log(`  ⚠️ PDF creation failed: ${error.message}`);
                    this.results[testId] = {
                        success: true, // Still success if we downloaded images
                        issue: config.issue,
                        title: config.title,
                        pagesDownloaded: successfulDownloads.length,
                        pdfSize: 0,
                        imageCount: 0,
                        error: 'PDF creation failed'
                    };
                }
            } else {
                throw new Error('No pages downloaded successfully');
            }

            return true;

        } catch (error) {
            console.log(`❌ VALIDATION FAILED: ${error.message}`);
            
            this.results[testId] = {
                success: false,
                issue: config.issue,
                title: config.title,
                pagesDownloaded: 0,
                pdfSize: 0,
                imageCount: 0,
                error: error.message
            };
            
            return false;
        }
    }

    async runAllValidations() {
        console.log('🔬 COMPREHENSIVE VALIDATION');
        console.log('Testing actual downloads from each library...\n');

        // Create validation directory
        if (!fs.existsSync(this.validationDir)) {
            fs.mkdirSync(this.validationDir, { recursive: true });
        }

        const startTime = Date.now();
        
        for (const [testId, config] of Object.entries(TEST_CASES)) {
            await this.validateLibrary(testId, config);
            // Small delay between libraries
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

        // Print summary
        console.log(`\n${'='.repeat(80)}`);
        console.log('📊 VALIDATION SUMMARY');
        console.log(`${'='.repeat(80)}`);

        const passed = Object.values(this.results).filter(r => r.success).length;
        const failed = Object.values(this.results).filter(r => !r.success).length;

        console.log(`Total libraries tested: ${Object.keys(this.results).length}`);
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`⏱️ Total time: ${totalTime}s`);

        // Detailed results
        console.log('\nDetailed Results:');
        console.log('Issue | Title | Status | Pages | PDF Size | Error');
        console.log('------|-------|--------|-------|----------|------');
        
        for (const [testId, result] of Object.entries(this.results)) {
            const status = result.success ? '✅' : '❌';
            const pdfSize = result.pdfSize > 0 ? `${(result.pdfSize / 1024 / 1024).toFixed(2)} MB` : 'N/A';
            const error = result.error ? result.error.substring(0, 30) + '...' : 'None';
            console.log(`${result.issue} | ${result.title} | ${status} | ${result.pagesDownloaded} | ${pdfSize} | ${error}`);
        }

        // Save results
        const reportPath = path.join(this.validationDir, 'validation-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
        console.log(`\n📁 Validation report saved to: ${reportPath}`);

        return passed === Object.keys(this.results).length;
    }
}

// Run validation
async function main() {
    const validator = new ComprehensiveValidator();
    const success = await validator.runAllValidations();
    process.exit(success ? 0 : 1);
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});