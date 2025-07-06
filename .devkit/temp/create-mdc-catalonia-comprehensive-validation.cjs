const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Create comprehensive validation for MDC Catalonia
const testUrl = 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1';

console.log('Creating comprehensive MDC Catalonia validation...');

class MDCValidator {
    
    async fetchDirect(url, options = {}) {
        return new Promise((resolve, reject) => {
            const client = https;
            const requestOptions = {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    ...options.headers
                }
            };
            
            const req = client.get(url, requestOptions, (res) => {
                let data = Buffer.alloc(0);
                
                res.on('data', chunk => {
                    data = Buffer.concat([data, chunk]);
                });
                
                res.on('end', () => {
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        statusText: res.statusMessage,
                        headers: {
                            get: (name) => res.headers[name.toLowerCase()]
                        },
                        json: async () => JSON.parse(data.toString()),
                        text: async () => data.toString(),
                        buffer: async () => data
                    });
                });
            });
            
            req.on('error', (err) => {
                reject(err);
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }
    
    async loadMdcCataloniaManifest(originalUrl) {
        try {
            console.log('\\n=== Loading MDC Catalonia Manifest ===');
            
            // Extract collection and item ID from URL
            const urlMatch = originalUrl.match(/mdc\.csuc\.cat\/digital\/collection\/([^\/]+)\/id\/(\d+)(?:\/rec\/(\d+))?/);
            if (!urlMatch) {
                throw new Error('Could not extract collection and item ID from MDC Catalonia URL');
            }
            
            const collection = urlMatch[1];
            const itemId = urlMatch[2];
            console.log(`Collection: ${collection}, Item ID: ${itemId}`);
            
            // Get compound object structure
            const compoundUrl = `https://mdc.csuc.cat/digital/bl/dmwebservices/index.php?q=dmGetCompoundObjectInfo/${collection}/${itemId}/json`;
            console.log('Fetching compound object structure...');
            
            const compoundResponse = await this.fetchDirect(compoundUrl);
            if (!compoundResponse.ok) {
                throw new Error(`Failed to fetch compound object info: ${compoundResponse.status}`);
            }
            
            const compoundData = await compoundResponse.json();
            let pageArray = compoundData.page;
            if (!pageArray && compoundData.node && compoundData.node.page) {
                pageArray = compoundData.node.page;
            }
            
            if (!pageArray || !Array.isArray(pageArray)) {
                throw new Error('Not a compound object - single page documents not supported for validation');
            }
            
            console.log(`Found compound object with ${pageArray.length} pages`);
            
            // Process all pages to get complete manifest
            const pageLinks = [];
            let validPages = 0;
            
            for (let i = 0; i < pageArray.length; i++) {
                const page = pageArray[i];
                if (!page.pageptr) {
                    console.log(`Skipping page ${i+1} without pageptr`);
                    continue;
                }
                
                const pageId = page.pageptr;
                const imageUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${pageId}/full/,2000/0/default.jpg`;
                pageLinks.push(imageUrl);
                validPages++;
                
                if (i < 5) {
                    console.log(`Page ${i+1}: ${page.pagetitle || 'No title'} (${pageId})`);
                }
                
                // Small delay to avoid overwhelming the server
                if (i % 50 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
            
            console.log(`Successfully processed ${validPages} pages`);
            
            return {
                pageLinks: pageLinks,
                totalPages: pageArray.length,
                library: 'mdc_catalonia',
                displayName: `MDC Catalonia ${collection} ${itemId}`,
                originalUrl: originalUrl,
            };
            
        } catch (error) {
            console.error('❌ loadMdcCataloniaManifest failed:', error.message);
            throw error;
        }
    }
    
    async downloadImages(manifest, maxPages = 10) {
        console.log(`\\n=== Downloading ${maxPages} Images ===`);
        
        const outputDir = path.join(__dirname, '..', 'validation-artifacts', 'MDC-CATALONIA-VALIDATION');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const downloadedFiles = [];
        
        for (let i = 0; i < Math.min(maxPages, manifest.pageLinks.length); i++) {
            const imageUrl = manifest.pageLinks[i];
            const fileName = `page_${String(i + 1).padStart(3, '0')}.jpg`;
            const filePath = path.join(outputDir, fileName);
            
            console.log(`Downloading page ${i + 1}/${maxPages}...`);
            
            try {
                const response = await this.fetchDirect(imageUrl);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const buffer = await response.buffer();
                fs.writeFileSync(filePath, buffer);
                
                console.log(`  ✅ Downloaded: ${fileName} (${(buffer.length / 1024).toFixed(2)}KB)`);
                downloadedFiles.push(filePath);
                
            } catch (error) {
                console.error(`  ❌ Failed to download page ${i + 1}: ${error.message}`);
            }
            
            // Small delay between downloads
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return downloadedFiles;
    }
    
    async createValidationPdf(downloadedFiles, outputPath) {
        console.log('\\n=== Creating Validation PDF ===');
        
        if (downloadedFiles.length === 0) {
            throw new Error('No images downloaded for PDF creation');
        }
        
        try {
            // Use img2pdf to create PDF
            const imageList = downloadedFiles.map(f => `"${f}"`).join(' ');
            const command = `img2pdf ${imageList} --output "${outputPath}"`;
            
            console.log('Creating PDF with img2pdf...');
            execSync(command, { stdio: 'inherit' });
            
            console.log(`✅ PDF created: ${outputPath}`);
            
            // Verify PDF
            const stats = fs.statSync(outputPath);
            console.log(`PDF size: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
            
            // Test PDF validity with poppler
            try {
                const pdfInfo = execSync(`pdfinfo "${outputPath}"`, { encoding: 'utf8' });
                console.log('✅ PDF validation successful');
                console.log('PDF info:', pdfInfo.split('\\n').slice(0, 5).join('\\n'));
                
                return true;
            } catch (error) {
                console.error('❌ PDF validation failed:', error.message);
                return false;
            }
            
        } catch (error) {
            console.error('❌ PDF creation failed:', error.message);
            throw error;
        }
    }
}

async function runValidation() {
    const validator = new MDCValidator();
    
    try {
        // Load manifest
        const manifest = await validator.loadMdcCataloniaManifest(testUrl);
        
        // Download images
        const downloadedFiles = await validator.downloadImages(manifest, 10);
        
        if (downloadedFiles.length === 0) {
            throw new Error('No images downloaded successfully');
        }
        
        // Create PDF
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const pdfPath = path.join(__dirname, '..', 'validation-artifacts', 'MDC-CATALONIA-VALIDATION', `MDC-CATALONIA-VALIDATION-${timestamp}.pdf`);
        
        const pdfValid = await validator.createValidationPdf(downloadedFiles, pdfPath);
        
        console.log('\\n=== VALIDATION RESULTS ===');
        console.log('✅ MDC Catalonia validation completed successfully');
        console.log(`Total pages available: ${manifest.totalPages}`);
        console.log(`Pages downloaded: ${downloadedFiles.length}`);
        console.log(`PDF created: ${pdfPath}`);
        console.log(`PDF valid: ${pdfValid}`);
        
        return {
            success: true,
            manifest,
            downloadedFiles,
            pdfPath,
            pdfValid
        };
        
    } catch (error) {
        console.error('❌ Validation failed:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

runValidation().then(result => {
    console.log('\\n=== FINAL RESULT ===');
    console.log('Validation success:', result.success);
    if (result.success) {
        console.log('PDF ready for user validation at:', result.pdfPath);
    }
}).catch(console.error);