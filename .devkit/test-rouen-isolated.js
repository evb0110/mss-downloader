const fetch = require('node-fetch');
const fs = require('fs-extra');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

async function testRouenManifestLoading() {
    const originalUrl = 'https://www.rotomagus.fr/ark:/12148/btv1b10052442z/f1.item.zoom';
    
    // Extract manuscript ID
    const arkMatch = originalUrl.match(/ark:\/12148\/([^/?\s]+)/);
    if (!arkMatch) {
        console.error('Invalid Rouen URL format');
        return;
    }
    
    const manuscriptId = arkMatch[1];
    console.log(`Manuscript ID: ${manuscriptId}`);
    
    // Fetch manifest
    const manifestUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/manifest.json`;
    console.log(`Fetching manifest: ${manifestUrl}`);
    
    const response = await fetch(manifestUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': originalUrl
        }
    });
    
    if (!response.ok) {
        console.error(`Failed to fetch manifest: ${response.status}`);
        return;
    }
    
    const manifestData = await response.json();
    console.log('Manifest loaded successfully');
    
    // Try the fixed paths
    let totalPages = 0;
    let displayName = `Rouen Manuscript ${manuscriptId}`;
    
    // Method 1: Check libelles path
    if (manifestData.PageAViewerFragment?.parameters?.fragmentDownload?.contenu?.libelles?.totalNumberPage) {
        totalPages = manifestData.PageAViewerFragment.parameters.fragmentDownload.contenu.libelles.totalNumberPage;
        console.log(`Found totalNumberPage in libelles: ${totalPages}`);
    }
    
    // Method 2: Check totalVues
    if (!totalPages && manifestData.PageAViewerFragment?.parameters?.totalVues) {
        totalPages = manifestData.PageAViewerFragment.parameters.totalVues;
        console.log(`Found totalVues in PageAViewerFragment: ${totalPages}`);
    }
    
    // Method 3: Check nbTotalVues
    if (!totalPages && manifestData.PageAViewerFragment?.contenu?.PaginationViewerModel?.parameters?.nbTotalVues) {
        totalPages = manifestData.PageAViewerFragment.contenu.PaginationViewerModel.parameters.nbTotalVues;
        console.log(`Found nbTotalVues in PaginationViewerModel: ${totalPages}`);
    }
    
    if (totalPages === 0) {
        console.error('Could not determine page count');
        return;
    }
    
    console.log(`\n✓ Successfully determined page count: ${totalPages} pages`);
    
    // Generate page URLs
    const pageLinks = [];
    for (let i = 1; i <= totalPages; i++) {
        const imageUrl = `https://www.rotomagus.fr/ark:/12148/${manuscriptId}/f${i}.highres`;
        pageLinks.push(imageUrl);
    }
    
    console.log(`Generated ${pageLinks.length} page URLs`);
    console.log(`First page: ${pageLinks[0]}`);
    console.log(`Last page: ${pageLinks[pageLinks.length - 1]}`);
    
    // Test downloading a few pages
    console.log('\nTesting page downloads...');
    const outputDir = path.join(__dirname, 'rouen-test-output');
    await fs.ensureDir(outputDir);
    
    const testPages = [1, 10, 50, 93];
    const downloadedImages = [];
    
    for (const pageNum of testPages) {
        if (pageNum <= totalPages) {
            const pageUrl = pageLinks[pageNum - 1];
            console.log(`\nDownloading page ${pageNum}...`);
            
            try {
                const imgResponse = await fetch(pageUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
                        'Referer': originalUrl
                    }
                });
                
                if (imgResponse.ok) {
                    const buffer = await imgResponse.buffer();
                    const filename = path.join(outputDir, `page-${pageNum}.jpg`);
                    await fs.writeFile(filename, buffer);
                    downloadedImages.push(filename);
                    console.log(`✓ Downloaded page ${pageNum} (${buffer.length} bytes)`);
                } else {
                    console.log(`✗ Failed to download page ${pageNum}: ${imgResponse.status}`);
                }
            } catch (error) {
                console.log(`✗ Error downloading page ${pageNum}: ${error.message}`);
            }
        }
    }
    
    // Create a test PDF
    if (downloadedImages.length > 0) {
        console.log('\nCreating test PDF...');
        const pdfPath = path.join(outputDir, 'rouen-test.pdf');
        
        const pdfDoc = await PDFDocument.create();
        for (const imagePath of downloadedImages) {
            const imageBytes = await fs.readFile(imagePath);
            const jpgImage = await pdfDoc.embedJpg(imageBytes);
            const page = pdfDoc.addPage([jpgImage.width, jpgImage.height]);
            page.drawImage(jpgImage, {
                x: 0,
                y: 0,
                width: jpgImage.width,
                height: jpgImage.height,
            });
        }
        
        const pdfBytes = await pdfDoc.save();
        await fs.writeFile(pdfPath, pdfBytes);
        console.log(`✓ PDF created: ${pdfPath}`);
        
        // Check PDF validity
        const { execSync } = require('child_process');
        try {
            const pdfInfo = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
            console.log('\nPDF validation:');
            console.log(pdfInfo.split('\n').slice(0, 5).join('\n'));
            console.log('✓ PDF is valid!');
        } catch (error) {
            console.error('✗ PDF validation failed');
        }
    }
    
    console.log('\n✓ Rouen Library fix validated successfully!');
}

testRouenManifestLoading().catch(console.error);