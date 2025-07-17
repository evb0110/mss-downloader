import { EnhancedManuscriptDownloaderService } from '../../src/main/services/EnhancedManuscriptDownloaderService';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

async function testInternetCulturele() {
    const service = new EnhancedManuscriptDownloaderService();
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
        let canvasCount = 0;
        if (manifestData.sequences && manifestData.sequences[0] && manifestData.sequences[0].canvases) {
            canvasCount = manifestData.sequences[0].canvases.length;
        } else if (manifestData.items) {
            canvasCount = manifestData.items.length;
        }
        
        console.log(`\nCanvas count: ${canvasCount}`);
        
        // Now try to load it with the service
        console.log('\nAttempting to load with service...');
        const result = await (service as any).loadManifest(testUrl);
        
        console.log('\nLoad result:');
        console.log('- Total pages:', result.totalPages);
        console.log('- Library:', result.library);
        console.log('- Display name:', result.displayName);
        
        // Download first few pages to verify content
        console.log('\nDownloading first 5 pages to verify content...');
        const pagesToTest = Math.min(5, result.pageLinks.length);
        
        for (let i = 0; i < pagesToTest; i++) {
            const pageUrl = result.pageLinks[i];
            console.log(`\nDownloading page ${i + 1}/${pagesToTest}: ${pageUrl}`);
            
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
        }
        
        // Create PDF to verify content validity
        if (result.pageLinks.length > 0) {
            console.log('\nCreating PDF from downloaded pages...');
            const pdfPath = path.join(testDir, 'test_manuscript.pdf');
            
            try {
                execSync(`convert ${testDir}/page_*.jpg "${pdfPath}"`, { stdio: 'pipe' });
                console.log('PDF created successfully');
                
                // Verify with poppler
                const pdfInfo = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf-8' });
                console.log('\nPDF info:\n', pdfInfo);
            } catch (error) {
                console.error('PDF creation failed:', error);
            }
        }
        
    } catch (error) {
        console.error('\nError occurred:', error);
        if (error instanceof Error) {
            console.error('Stack trace:', error.stack);
        }
    }
}

// Run the test
testInternetCulturele().catch(console.error);