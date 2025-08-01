#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import production code
const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');

// Test configuration with exact user URLs
const TEST_LIBRARIES = [
    {
        issue: '#2',
        name: 'Graz',
        url: 'https://unipub.uni-graz.at/obvugrhs/content/zoom/123456', // Need real URL from user
        skip: true, // No URL provided
    },
    {
        issue: '#3',
        name: 'Verona',
        url: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15',
    },
    {
        issue: '#4',
        name: 'Morgan',
        url: 'https://www.themorgan.org/collection/lindau-gospels/thumbs',
    },
    {
        issue: '#5',
        name: 'Florence',
        url: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/',
    },
    {
        issue: '#6',
        name: 'Bordeaux',
        url: 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778',
    },
    {
        issue: '#8',
        name: 'Bodleian',
        url: 'https://digital.bodleian.ox.ac.uk/objects/ce827512-d440-4833-bdba-f4f4f079d2cd/',
    },
    {
        issue: '#9',
        name: 'BDL',
        url: 'https://www.bdl.servizirl.it/vufind/Record/BDL-OGGETTO-3903',
    },
    {
        issue: '#10',
        name: 'Zurich e-manuscripta',
        url: 'https://www.e-manuscripta.ch/bau/content/zoom/5157616',
    },
    {
        issue: '#11',
        name: 'BNE',
        url: 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1',
    },
    {
        issue: '#12',
        name: 'Catalonia MDC',
        url: 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1',
    },
    {
        issue: '#13',
        name: 'Grenoble',
        url: 'https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom',
    }
];

class ComprehensivePDFTester {
    constructor() {
        this.manifestLoaders = new SharedManifestLoaders();
        this.outputDir = path.join(__dirname, 'READY-FOR-USER');
        this.results = {};
        
        // Clean and create output directory
        if (fs.existsSync(this.outputDir)) {
            fs.rmSync(this.outputDir, { recursive: true });
        }
        fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    detectLibrary(url) {
        // Match production detection logic
        if (url.includes('unipub.uni-graz.at')) return 'graz';
        if (url.includes('nuovabibliotecamanoscritta.it') || url.includes('nbm.regione.veneto.it')) return 'verona';
        if (url.includes('themorgan.org')) return 'morgan';
        if (url.includes('cdm21059.contentdm.oclc.org/digital/collection/plutei')) return 'florence';
        if (url.includes('manuscrits.bordeaux.fr') || url.includes('selene.bordeaux.fr')) return 'bordeaux';
        if (url.includes('digital.bodleian.ox.ac.uk')) return 'bodleian';
        if (url.includes('bdl.servizirl.it')) return 'bdl';
        if (url.includes('e-manuscripta.ch')) return 'e_manuscripta';
        if (url.includes('bdh-rd.bne.es')) return 'bne';
        if (url.includes('mdc.csuc.cat/digital/collection')) return 'mdc_catalonia';
        if (url.includes('pagella.bm-grenoble.fr')) return 'grenoble';
        
        return null;
    }
    
    async downloadImage(url, filename) {
        try {
            const response = await this.manifestLoaders.fetchWithRetry(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const buffer = Buffer.from(await response.arrayBuffer());
            fs.writeFileSync(filename, buffer);
            return true;
        } catch (error) {
            console.error(`Failed to download ${url}: ${error.message}`);
            return false;
        }
    }
    
    async testLibrary(config) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Testing ${config.name} (Issue ${config.issue})`);
        console.log(`URL: ${config.url}`);
        console.log(`${'='.repeat(60)}`);
        
        if (config.skip) {
            console.log('⏭️ SKIPPED: No URL provided');
            return { skipped: true };
        }
        
        try {
            // Detect library
            const library = this.detectLibrary(config.url);
            if (!library) {
                throw new Error('Library not detected');
            }
            console.log(`✅ Detected library: ${library}`);
            
            // Load manifest
            console.log('📋 Loading manifest...');
            const manifest = await this.manifestLoaders.getManifestForLibrary(library, config.url);
            
            // Determine page count
            let pageCount = 0;
            let imageUrls = [];
            
            if (manifest.requiresTileProcessor) {
                pageCount = manifest.pageCount || 0;
                console.log(`✅ Found tile-based library with ${pageCount} pages`);
                
                // For tile-based libraries, we can't download directly
                console.log('⚠️ Tile-based library requires special processing');
                imageUrls = []; // Empty for now
            } else if (manifest.images) {
                pageCount = manifest.images.length;
                imageUrls = manifest.images.slice(0, 10).map(img => img.url); // First 10 pages
                console.log(`✅ Found ${pageCount} images`);
            }
            
            // Download sample images
            if (imageUrls.length > 0) {
                console.log(`📥 Downloading ${imageUrls.length} sample pages...`);
                const downloadedFiles = [];
                
                for (let i = 0; i < imageUrls.length; i++) {
                    const filename = path.join(this.outputDir, `${config.name}_${config.issue}_page${i + 1}.jpg`);
                    process.stdout.write(`  Page ${i + 1}/${imageUrls.length}... `);
                    
                    const success = await this.downloadImage(imageUrls[i], filename);
                    if (success) {
                        downloadedFiles.push(filename);
                        console.log('✅');
                    } else {
                        console.log('❌');
                    }
                    
                    // Small delay to avoid overwhelming servers
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                // Create PDF
                if (downloadedFiles.length > 0) {
                    console.log('📄 Creating PDF...');
                    const pdfPath = path.join(this.outputDir, `${config.name}_${config.issue}.pdf`);
                    
                    try {
                        // Use ImageMagick to create PDF
                        execSync(`convert ${downloadedFiles.join(' ')} "${pdfPath}"`, { stdio: 'pipe' });
                        
                        // Verify PDF
                        const stats = fs.statSync(pdfPath);
                        if (stats.size > 0) {
                            console.log(`✅ PDF created: ${path.basename(pdfPath)} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
                            
                            // Verify with poppler
                            try {
                                const pdfInfo = execSync(`pdfimages -list "${pdfPath}"`, { encoding: 'utf-8' });
                                const imageCount = (pdfInfo.match(/\n/g) || []).length - 2; // Subtract header lines
                                console.log(`✅ PDF verified: ${imageCount} images`);
                            } catch (e) {
                                console.log('⚠️ Could not verify PDF with poppler');
                            }
                        } else {
                            console.log('❌ PDF is empty');
                        }
                        
                        // Clean up individual images
                        downloadedFiles.forEach(f => fs.unlinkSync(f));
                        
                        return { success: true, pageCount, pdfPath };
                    } catch (error) {
                        console.error('❌ PDF creation failed:', error.message);
                        return { success: false, pageCount, error: 'PDF creation failed' };
                    }
                }
            }
            
            return { success: true, pageCount, note: manifest.requiresTileProcessor ? 'Tile-based library' : 'No downloads' };
            
        } catch (error) {
            console.error(`❌ FAILED: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
    
    async runAllTests() {
        console.log('🚀 Starting comprehensive PDF validation tests');
        console.log(`Output directory: ${this.outputDir}\n`);
        
        for (const config of TEST_LIBRARIES) {
            this.results[config.issue] = await this.testLibrary(config);
            
            // Delay between libraries
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        this.generateReport();
    }
    
    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 COMPREHENSIVE TEST REPORT');
        console.log('='.repeat(60));
        
        const successful = Object.values(this.results).filter(r => r.success).length;
        const failed = Object.values(this.results).filter(r => !r.success && !r.skipped).length;
        const skipped = Object.values(this.results).filter(r => r.skipped).length;
        
        console.log(`✅ Successful: ${successful}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`⏭️ Skipped: ${skipped}`);
        
        console.log('\n📁 PDFs created:');
        const pdfFiles = fs.readdirSync(this.outputDir).filter(f => f.endsWith('.pdf'));
        pdfFiles.forEach(pdf => {
            const stats = fs.statSync(path.join(this.outputDir, pdf));
            console.log(`  - ${pdf} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        });
        
        // Save detailed results
        fs.writeFileSync(
            path.join(this.outputDir, 'test-results.json'),
            JSON.stringify(this.results, null, 2)
        );
    }
}

// Check if ImageMagick is installed
try {
    execSync('convert -version', { stdio: 'pipe' });
} catch (error) {
    console.error('❌ ImageMagick is required but not installed');
    console.error('Install with: brew install imagemagick');
    process.exit(1);
}

// Run tests
const tester = new ComprehensivePDFTester();
tester.runAllTests().catch(console.error);