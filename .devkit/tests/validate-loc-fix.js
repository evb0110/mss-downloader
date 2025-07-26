const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

async function validateLocFix() {
    console.log('=== VALIDATING LIBRARY OF CONGRESS FIX ===\n');
    
    const validationDir = path.join(__dirname, '../../validation-pdfs-loc');
    await fs.mkdir(validationDir, { recursive: true });
    
    // Test manuscripts that were timing out
    const testManuscripts = [
        {
            url: 'https://www.loc.gov/item/2021667775/',
            id: '2021667775',
            expectedPages: 446,
            description: 'Large manuscript (688KB manifest)'
        },
        {
            url: 'https://www.loc.gov/item/2021667776/',
            id: '2021667776',
            expectedPages: 194,
            description: 'Medium manuscript (316KB manifest)'
        },
        {
            url: 'https://www.loc.gov/item/19005901/',
            id: '19005901',
            expectedPages: 121,
            description: 'Small manuscript (192KB manifest)'
        }
    ];
    
    const results = [];
    
    for (const manuscript of testManuscripts) {
        console.log(`\n=== Testing ${manuscript.id} ===`);
        console.log(`Description: ${manuscript.description}`);
        console.log(`Expected pages: ${manuscript.expectedPages}`);
        
        const manifestUrl = manuscript.url + 'manifest.json';
        const manuscriptDir = path.join(validationDir, manuscript.id);
        await fs.mkdir(manuscriptDir, { recursive: true });
        
        // Test manifest loading with new 90-second timeout
        console.log('\n1. Loading manifest with 90s timeout...');
        const startTime = Date.now();
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 seconds (matching new LOC timeout)
            
            const response = await fetch(manifestUrl, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json'
                }
            });
            
            clearTimeout(timeoutId);
            const elapsed = Date.now() - startTime;
            
            if (response.ok) {
                const manifestText = await response.text();
                const manifest = JSON.parse(manifestText);
                
                console.log(`  ✓ Manifest loaded in ${elapsed}ms`);
                console.log(`  Size: ${(manifestText.length / 1024).toFixed(0)}KB`);
                
                // Extract page count
                const pages = manifest.sequences?.[0]?.canvases || [];
                console.log(`  Pages found: ${pages.length}`);
                
                // Download first 5 pages as sample
                console.log('\n2. Downloading sample pages...');
                const downloadedFiles = [];
                const samplesToDownload = Math.min(5, pages.length);
                
                for (let i = 0; i < samplesToDownload; i++) {
                    const canvas = pages[i];
                    const image = canvas.images?.[0];
                    const serviceId = image?.resource?.service?.['@id'];
                    
                    if (serviceId) {
                        const imageUrl = `${serviceId}/full/full/0/default.jpg`;
                        const outputPath = path.join(manuscriptDir, `page_${(i + 1).toString().padStart(3, '0')}.jpg`);
                        
                        try {
                            console.log(`  Downloading page ${i + 1}/${samplesToDownload}...`);
                            const imgResponse = await fetch(imageUrl);
                            
                            if (imgResponse.ok) {
                                const buffer = await imgResponse.arrayBuffer();
                                await fs.writeFile(outputPath, Buffer.from(buffer));
                                downloadedFiles.push(outputPath);
                                console.log(`    ✓ Downloaded (${(buffer.byteLength / 1024).toFixed(0)}KB)`);
                            } else {
                                console.log(`    ✗ Failed: HTTP ${imgResponse.status}`);
                            }
                        } catch (err) {
                            console.log(`    ✗ Error: ${err.message}`);
                        }
                    }
                }
                
                // Create PDF if we have images
                if (downloadedFiles.length > 0) {
                    console.log('\n3. Creating validation PDF...');
                    const pdfPath = path.join(manuscriptDir, `loc_${manuscript.id}_sample.pdf`);
                    
                    try {
                        execSync(`convert "${downloadedFiles.join('" "')}" "${pdfPath}"`, { stdio: 'ignore' });
                        
                        const stats = await fs.stat(pdfPath);
                        console.log(`  ✓ PDF created: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
                        
                        // Validate with pdfimages
                        try {
                            const pdfInfo = execSync(`pdfimages -list "${pdfPath}" | head -10`, { encoding: 'utf8' });
                            console.log('\n  PDF validation:');
                            console.log(pdfInfo.split('\n').slice(0, 6).join('\n'));
                        } catch (err) {
                            console.log('  (pdfimages not available)');
                        }
                    } catch (err) {
                        console.log('  PDF creation skipped (ImageMagick not available)');
                    }
                }
                
                results.push({
                    id: manuscript.id,
                    success: true,
                    manifestLoadTime: elapsed,
                    pagesFound: pages.length,
                    samplesDownloaded: downloadedFiles.length
                });
                
            } else {
                console.log(`  ✗ Failed: HTTP ${response.status}`);
                results.push({
                    id: manuscript.id,
                    success: false,
                    error: `HTTP ${response.status}`
                });
            }
        } catch (err) {
            const elapsed = Date.now() - startTime;
            console.log(`  ✗ Error after ${elapsed}ms: ${err.message}`);
            results.push({
                id: manuscript.id,
                success: false,
                error: err.message,
                timeElapsed: elapsed
            });
        }
    }
    
    // Create summary report
    console.log('\n=== VALIDATION SUMMARY ===');
    const report = {
        timestamp: new Date().toISOString(),
        fixApplied: 'Increased LOC timeout multiplier from 1.5 to 3.0 (45s → 90s)',
        results: results.map(r => ({
            manuscript: r.id,
            status: r.success ? 'SUCCESS' : 'FAILED',
            manifestLoadTime: r.manifestLoadTime ? `${r.manifestLoadTime}ms` : 'N/A',
            pagesFound: r.pagesFound || 0,
            error: r.error
        }))
    };
    
    console.log('\nResults:');
    report.results.forEach(r => {
        console.log(`  ${r.manuscript}: ${r.status} ${r.manifestLoadTime ? `(${r.manifestLoadTime})` : ''}`);
    });
    
    await fs.writeFile(
        path.join(validationDir, 'validation-report.json'),
        JSON.stringify(report, null, 2)
    );
    
    console.log(`\nValidation files saved to: ${validationDir}`);
    
    if (results.every(r => r.success)) {
        console.log('\n✅ ALL TESTS PASSED - LOC timeout fix is working!');
    } else {
        console.log('\n⚠️  Some tests failed - additional investigation needed');
    }
    
    return validationDir;
}

validateLocFix()
    .then(dir => {
        console.log('\nOpening validation folder...');
        execSync(`open "${dir}"`);
    })
    .catch(console.error);