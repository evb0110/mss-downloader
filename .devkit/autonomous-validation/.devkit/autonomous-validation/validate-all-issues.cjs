const { SharedManifestLoaders } = require('../../src/shared/SharedManifestLoaders.js');
const fs = require('fs').promises;
const { execSync } = require('child_process');
const path = require('path');

// Issue URLs from GitHub
const issueTests = [
    {
        issue: 5,
        library: 'Florence',
        url: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/',
        expectedPages: 10
    },
    {
        issue: 4,
        library: 'Morgan',
        url: 'https://www.themorgan.org/collection/lindau-gospels/thumbs',
        expectedPages: 5
    },
    {
        issue: 3,
        library: 'Verona',
        url: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15',
        expectedPages: 10
    },
    {
        issue: 2,
        library: 'Graz',
        url: 'https://digital.ub.uni-graz.at/viewer/image/AC00050147/1/',
        expectedPages: 10
    },
    {
        issue: 1,
        library: 'HHU Düsseldorf',
        url: 'https://digital.ulb.hhu.de/ms/content/titleinfo/7674176',
        expectedPages: 5
    }
];

async function downloadImage(url, outputPath) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const buffer = await response.arrayBuffer();
        await fs.writeFile(outputPath, Buffer.from(buffer));
        return true;
    } catch (error) {
        console.error(`Download failed: ${error.message}`);
        return false;
    }
}

async function createPDF(imagePaths, outputPdf) {
    try {
        const convertCmd = `convert ${imagePaths.join(' ')} "${outputPdf}"`;
        execSync(convertCmd, { maxBuffer: 50 * 1024 * 1024 });
        return true;
    } catch (error) {
        console.error(`PDF creation failed: ${error.message}`);
        return false;
    }
}

async function validateIssueFix(test) {
    console.log(`\n=== Validating Issue #${test.issue} - ${test.library} ===`);
    console.log(`URL: ${test.url}`);
    
    const loaders = new SharedManifestLoaders();
    const outputDir = `issue-${test.issue}-${test.library.toLowerCase().replace(/\s+/g, '-')}`;
    
    try {
        await fs.mkdir(outputDir, { recursive: true });
        
        // Get manifest
        console.log('Fetching manifest...');
        const manifest = await loaders.getManifestForUrl(test.url);
        
        if (!manifest || !manifest.items || manifest.items.length === 0) {
            console.error('❌ No manifest items found');
            return { success: false, error: 'No manifest items' };
        }
        
        console.log(`Found ${manifest.items.length} pages in manifest`);
        
        // Download pages
        const pagesToDownload = Math.min(test.expectedPages, manifest.items.length);
        const imagePaths = [];
        let successCount = 0;
        
        for (let i = 0; i < pagesToDownload; i++) {
            const item = manifest.items[i];
            let imageUrl = null;
            
            if (item.body?.id) {
                imageUrl = item.body.id;
            } else if (item.items?.[0]?.items?.[0]?.body?.id) {
                imageUrl = item.items[0].items[0].body.id;
            }
            
            if (!imageUrl) {
                console.error(`Page ${i + 1}: No image URL found`);
                continue;
            }
            
            const imagePath = path.join(outputDir, `page-${String(i + 1).padStart(3, '0')}.jpg`);
            console.log(`Downloading page ${i + 1}/${pagesToDownload}...`);
            
            if (await downloadImage(imageUrl, imagePath)) {
                imagePaths.push(imagePath);
                successCount++;
            }
        }
        
        if (successCount === 0) {
            console.error('❌ No pages downloaded successfully');
            return { success: false, error: 'No pages downloaded' };
        }
        
        // Create PDF
        const pdfPath = path.join(outputDir, `${test.library.toLowerCase()}-issue-${test.issue}.pdf`);
        console.log(`Creating PDF with ${successCount} pages...`);
        
        if (!await createPDF(imagePaths, pdfPath)) {
            return { success: false, error: 'PDF creation failed' };
        }
        
        // Validate PDF
        try {
            const pdfInfo = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
            const pageMatch = pdfInfo.match(/Pages:\s+(\d+)/);
            const pages = pageMatch ? parseInt(pageMatch[1]) : 0;
            
            if (pages === successCount) {
                console.log(`✅ PDF validated: ${pages} pages`);
                
                // Check file size
                const stats = await fs.stat(pdfPath);
                const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
                console.log(`PDF size: ${sizeMB} MB`);
                
                return { 
                    success: true, 
                    pages: pages,
                    size: sizeMB,
                    path: pdfPath
                };
            } else {
                return { success: false, error: `Page count mismatch: ${pages} vs ${successCount}` };
            }
        } catch (error) {
            return { success: false, error: `PDF validation failed: ${error.message}` };
        }
        
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function runAllValidations() {
    console.log('Starting autonomous validation of all GitHub issues...\n');
    
    const results = [];
    
    for (const test of issueTests) {
        const result = await validateIssueFix(test);
        results.push({
            ...test,
            ...result
        });
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Summary
    console.log('\n\n=== VALIDATION SUMMARY ===');
    console.log('Issue | Library        | Status | Pages | Size   | Error');
    console.log('------|----------------|--------|-------|--------|-------');
    
    let successCount = 0;
    for (const result of results) {
        const status = result.success ? '✅' : '❌';
        if (result.success) successCount++;
        
        console.log(
            `#${String(result.issue).padEnd(4)} | ` +
            `${result.library.padEnd(14)} | ` +
            `${status.padEnd(6)} | ` +
            `${String(result.pages || '-').padEnd(5)} | ` +
            `${(result.size || '-').padEnd(6)} | ` +
            `${result.error || 'Success'}`
        );
    }
    
    console.log(`\nOverall success rate: ${successCount}/${results.length} (${Math.round(successCount/results.length*100)}%)`);
    
    // Save results
    await fs.writeFile('validation-results.json', JSON.stringify(results, null, 2));
    
    return results;
}

// Run validation
runAllValidations().catch(console.error);