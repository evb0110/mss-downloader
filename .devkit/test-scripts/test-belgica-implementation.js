const path = require('path');
const fs = require('fs').promises;

// Import the service
const { EnhancedManuscriptDownloaderService } = require('../../dist/main/services/EnhancedManuscriptDownloaderService');

async function testBelgicaImplementation() {
    console.log('Testing Belgica KBR implementation...\n');
    
    const downloader = new EnhancedManuscriptDownloaderService();
    
    const testUrls = [
        'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415',
        'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16073935',
        'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/15949802'
    ];
    
    for (const url of testUrls) {
        console.log(`\nTesting URL: ${url}`);
        console.log('=' * 60);
        
        try {
            // Load manifest
            console.log('Loading manifest...');
            const manifest = await downloader.loadManifest(url);
            
            console.log('Manifest loaded successfully:');
            console.log(`- Display Name: ${manifest.displayName}`);
            console.log(`- Total Pages: ${manifest.totalPages}`);
            console.log(`- Library: ${manifest.library}`);
            console.log(`- Metadata:`, manifest.metadata);
            console.log(`- Sample page URLs:`);
            for (let i = 0; i < Math.min(3, manifest.pageLinks.length); i++) {
                console.log(`  Page ${i + 1}: ${manifest.pageLinks[i]}`);
            }
            
            // Test downloading a few pages
            console.log('\nTesting page downloads...');
            const outputDir = path.join(__dirname, '../../.devkit/test-outputs/belgica-implementation', path.basename(url));
            await fs.mkdir(outputDir, { recursive: true });
            
            let successCount = 0;
            const testPages = Math.min(10, manifest.totalPages);
            
            for (let i = 0; i < testPages; i++) {
                const pageUrl = manifest.pageLinks[i];
                const pageNum = String(i + 1).padStart(4, '0');
                
                try {
                    console.log(`Downloading page ${i + 1}/${testPages}...`);
                    const imageBuffer = await downloader.downloadImage(pageUrl);
                    
                    const filename = path.join(outputDir, `page_${pageNum}.jpg`);
                    await fs.writeFile(filename, Buffer.from(imageBuffer));
                    
                    successCount++;
                    console.log(`  ✓ Page ${i + 1} downloaded (${(imageBuffer.byteLength / 1024).toFixed(1)} KB)`);
                } catch (error) {
                    console.error(`  ✗ Page ${i + 1} failed: ${error.message}`);
                }
            }
            
            console.log(`\nDownload success rate: ${successCount}/${testPages} (${(successCount/testPages*100).toFixed(1)}%)`);
            
            // Create a test PDF
            if (successCount > 0) {
                console.log('\nCreating test PDF...');
                const PDFDocument = require('pdfkit');
                const sharp = require('sharp');
                
                const doc = new PDFDocument({ autoFirstPage: false });
                const pdfPath = path.join(outputDir, 'test.pdf');
                doc.pipe(fs.createWriteStream(pdfPath));
                
                const files = await fs.readdir(outputDir);
                const imageFiles = files.filter(f => f.startsWith('page_') && f.endsWith('.jpg')).sort();
                
                for (const file of imageFiles) {
                    const imagePath = path.join(outputDir, file);
                    const metadata = await sharp(imagePath).metadata();
                    
                    doc.addPage({
                        size: [metadata.width, metadata.height]
                    });
                    
                    doc.image(imagePath, 0, 0, {
                        width: metadata.width,
                        height: metadata.height
                    });
                }
                
                doc.end();
                console.log(`PDF created: ${pdfPath}`);
            }
            
        } catch (error) {
            console.error(`\nError testing ${url}:`, error.message);
        }
    }
    
    console.log('\n\nTest complete!');
}

// Run the test
testBelgicaImplementation().catch(console.error);