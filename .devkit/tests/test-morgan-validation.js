const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Import the service
const { EnhancedManuscriptDownloaderService } = require('../../dist/main/services/EnhancedManuscriptDownloaderService');

async function validateMorganLibrary() {
    console.log('🔍 Testing Morgan Library manuscript downloads...\n');
    
    const service = new EnhancedManuscriptDownloaderService();
    
    // Test manuscripts
    const testUrls = [
        {
            url: 'https://www.themorgan.org/collection/lindau-gospels',
            name: 'Lindau Gospels',
            expectedMinPages: 10
        },
        {
            url: 'https://www.themorgan.org/collection/arenberg-gospels',
            name: 'Arenberg Gospels', 
            expectedMinPages: 10
        },
        {
            url: 'https://www.themorgan.org/collection/hours-of-catherine-of-cleves',
            name: 'Hours of Catherine of Cleves',
            expectedMinPages: 10
        }
    ];
    
    // Create output directory
    const outputDir = path.join(__dirname, 'morgan-validation-pdfs');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    console.log(`📁 Output directory: ${outputDir}\n`);
    
    for (const test of testUrls) {
        console.log(`\n📚 Testing: ${test.name}`);
        console.log(`URL: ${test.url}`);
        
        try {
            // Load manifest
            console.log('Loading manifest...');
            const manifest = await service.loadMorganManifest(test.url);
            
            console.log(`✅ Found ${manifest.totalPages} pages`);
            console.log(`Title: ${manifest.displayName}`);
            
            if (manifest.totalPages < test.expectedMinPages) {
                console.error(`❌ ERROR: Expected at least ${test.expectedMinPages} pages, but found only ${manifest.totalPages}`);
                console.log('Page links found:', manifest.pageLinks);
                continue;
            }
            
            // Download first 5 pages for validation
            const pagesToDownload = Math.min(5, manifest.totalPages);
            console.log(`\nDownloading first ${pagesToDownload} pages for validation...`);
            
            const downloadedImages = [];
            
            for (let i = 0; i < pagesToDownload; i++) {
                const pageUrl = manifest.pageLinks[i];
                console.log(`  Page ${i + 1}: ${pageUrl}`);
                
                try {
                    const response = await fetch(pageUrl);
                    if (!response.ok) {
                        console.error(`    ❌ Failed to download: ${response.status}`);
                        continue;
                    }
                    
                    const buffer = await response.arrayBuffer();
                    const imageBuffer = Buffer.from(buffer);
                    
                    // Save image
                    const imagePath = path.join(outputDir, `${test.name.replace(/\s+/g, '-')}-page-${i + 1}.jpg`);
                    fs.writeFileSync(imagePath, imageBuffer);
                    downloadedImages.push(imagePath);
                    
                    const stats = fs.statSync(imagePath);
                    console.log(`    ✅ Downloaded: ${(stats.size / 1024).toFixed(2)} KB`);
                    
                } catch (error) {
                    console.error(`    ❌ Error downloading page ${i + 1}:`, error.message);
                }
            }
            
            // Create PDF from downloaded images
            if (downloadedImages.length > 0) {
                const pdfPath = path.join(outputDir, `${test.name.replace(/\s+/g, '-')}.pdf`);
                console.log(`\nCreating PDF: ${pdfPath}`);
                
                try {
                    const convertCmd = `convert ${downloadedImages.map(p => `"${p}"`).join(' ')} "${pdfPath}"`;
                    await execAsync(convertCmd);
                    
                    const pdfStats = fs.statSync(pdfPath);
                    console.log(`✅ PDF created: ${(pdfStats.size / 1024 / 1024).toFixed(2)} MB`);
                    
                    // Validate PDF with poppler
                    const { stdout } = await execAsync(`pdfinfo "${pdfPath}"`);
                    console.log('PDF validation:', stdout.split('\n').find(line => line.includes('Pages:')));
                    
                } catch (error) {
                    console.error('❌ Error creating PDF:', error.message);
                }
            }
            
        } catch (error) {
            console.error(`❌ Error testing ${test.name}:`, error.message);
        }
    }
    
    console.log('\n\n✅ Validation complete!');
    console.log(`Check PDFs in: ${outputDir}`);
}

// Run validation
validateMorganLibrary().catch(console.error);