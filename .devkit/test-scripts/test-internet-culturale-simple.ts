import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

async function testInternetCulturele() {
    const testDir = path.join(__dirname, '../test-outputs/internet-culturale-test');
    
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
    }
    
    console.log('Testing Internet Culturale (DAM ICCU) URL...\n');
    
    const testUrl = 'https://dam.iccu.sbn.it/mol_46/containers/avQYk0e/manifest';
    
    try {
        // First, let's fetch the manifest directly to examine it
        console.log('Fetching manifest directly to analyze structure...');
        const response = await fetch(testUrl);
        const manifestData = await response.json();
        
        console.log('Manifest metadata:');
        console.log('- Label:', manifestData.label);
        console.log('- @id:', manifestData['@id']);
        console.log('- @type:', manifestData['@type']);
        
        if (manifestData.metadata) {
            console.log('\nMetadata fields:');
            manifestData.metadata.forEach((meta: any) => {
                const label = typeof meta.label === 'object' ? 
                    (meta.label['@value'] || meta.label.it || meta.label.en || JSON.stringify(meta.label)) : 
                    meta.label;
                const value = typeof meta.value === 'object' ? 
                    (meta.value['@value'] || meta.value.it || meta.value.en || JSON.stringify(meta.value)) : 
                    meta.value;
                console.log(`- ${label}: ${value}`);
            });
        }
        
        // Check canvas count
        let canvases: any[] = [];
        if (manifestData.sequences && manifestData.sequences[0] && manifestData.sequences[0].canvases) {
            canvases = manifestData.sequences[0].canvases;
            console.log(`\nIIIF v2 manifest - Canvas count: ${canvases.length}`);
        } else if (manifestData.items) {
            canvases = manifestData.items;
            console.log(`\nIIIF v3 manifest - Canvas count: ${canvases.length}`);
        }
        
        // Extract page URLs manually
        const pageLinks: string[] = [];
        
        for (const canvas of canvases) {
            // IIIF v2 structure
            if (canvas.images && canvas.images[0]) {
                const resource = canvas.images[0].resource;
                if (resource.service && resource.service['@id']) {
                    pageLinks.push(`${resource.service['@id']}/full/full/0/default.jpg`);
                } else if (resource['@id']) {
                    pageLinks.push(resource['@id']);
                }
            }
            
            // IIIF v3 structure
            if (canvas.items && canvas.items[0] && canvas.items[0].items && canvas.items[0].items[0]) {
                const annotation = canvas.items[0].items[0];
                if (annotation.body && annotation.body.service && annotation.body.service[0]) {
                    const serviceId = annotation.body.service[0].id || annotation.body.service[0]['@id'];
                    pageLinks.push(`${serviceId}/full/full/0/default.jpg`);
                } else if (annotation.body && annotation.body.id) {
                    pageLinks.push(annotation.body.id);
                }
            }
        }
        
        console.log(`\nExtracted ${pageLinks.length} page URLs`);
        
        // Show first few URLs
        console.log('\nFirst few page URLs:');
        pageLinks.slice(0, 3).forEach((url, i) => {
            console.log(`- Page ${i + 1}: ${url}`);
        });
        
        // Download first few pages to verify content
        console.log('\nDownloading first 5 pages to verify content...');
        const pagesToTest = Math.min(5, pageLinks.length);
        
        for (let i = 0; i < pagesToTest; i++) {
            const pageUrl = pageLinks[i];
            console.log(`\nDownloading page ${i + 1}/${pagesToTest}...`);
            
            try {
                const pageResponse = await fetch(pageUrl);
                if (pageResponse.ok) {
                    const buffer = Buffer.from(await pageResponse.arrayBuffer());
                    const outputPath = path.join(testDir, `page_${String(i + 1).padStart(3, '0')}.jpg`);
                    fs.writeFileSync(outputPath, buffer);
                    console.log(`- Saved to: ${outputPath}`);
                    console.log(`- Size: ${(buffer.length / 1024).toFixed(2)} KB`);
                } else {
                    console.log(`- Failed: HTTP ${pageResponse.status}`);
                }
            } catch (error) {
                console.log(`- Error downloading: ${error}`);
            }
        }
        
        // Create PDF to verify content validity
        if (pageLinks.length > 0) {
            console.log('\nCreating PDF from downloaded pages...');
            const pdfPath = path.join(testDir, 'test_manuscript.pdf');
            
            try {
                execSync(`convert ${testDir}/page_*.jpg "${pdfPath}"`, { stdio: 'pipe' });
                console.log('PDF created successfully');
                
                // Verify with poppler
                const pdfInfo = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf-8' });
                console.log('\nPDF info:\n', pdfInfo);
                
                // Show the output directory
                console.log(`\nTest files saved to: ${testDir}`);
            } catch (error) {
                console.error('PDF creation failed:', error);
            }
        }
        
        // Save full manifest for analysis
        fs.writeFileSync(
            path.join(testDir, 'manifest.json'), 
            JSON.stringify(manifestData, null, 2)
        );
        console.log('\nFull manifest saved to manifest.json');
        
    } catch (error) {
        console.error('\nError occurred:', error);
        if (error instanceof Error) {
            console.error('Stack trace:', error.stack);
        }
    }
}

// Run the test
testInternetCulturele().catch(console.error);