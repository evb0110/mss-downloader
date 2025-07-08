#!/usr/bin/env node

// Create actual validation PDFs for all 5 newly implemented libraries
// This script creates small sample PDFs (3-5 pages) for user validation

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const VALIDATION_DIR = path.join(__dirname, '..', 'validation-final', 'FINAL-PDFS-FOR-INSPECTION');
const BASE_DIR = path.join(__dirname, '..', '..');

// Sample manuscript URLs for validation PDFs (limited pages for quick validation)
const VALIDATION_TESTS = [
    {
        library: 'karlsruhe',
        name: 'Karlsruhe_BLB_Sample',
        url: 'https://i3f.vls.io/?collection=i3fblbk&id=https%3A%2F%2Fdigital.blb-karlsruhe.de%2Fi3f%2Fv20%2F3464606%2Fmanifest',
        maxPages: 5,
        description: 'IIIF v2.0, 2000px resolution'
    },
    {
        library: 'manchester',
        name: 'Manchester_JohnRylands_Sample',
        url: 'https://www.digitalcollections.manchester.ac.uk/view/MS-LATIN-00074/1',
        maxPages: 5,
        description: 'Ultra-high resolution 4000-6500px, Fixed 0-byte issue'
    },
    {
        library: 'saint_omer',
        name: 'SaintOmer_Medieval_Sample',
        url: 'https://bibliotheque-numerique.bibliotheque-agglo-stomer.fr/viewer/22581/',
        maxPages: 5,
        description: 'Medieval manuscripts 5000-7000px'
    },
    {
        library: 'toronto',
        name: 'Toronto_Fisher_Sample',
        url: 'https://iiif.library.utoronto.ca/presentation/v2/mscodex0001/manifest',
        maxPages: 5,
        description: 'Thomas Fisher Rare Book Library, maximum IIIF resolution'
    },
    {
        library: 'grenoble',
        name: 'Grenoble_Gallica_Sample',
        url: 'https://pagella.bm-grenoble.fr/ark:/12148/btv1b10663927k/f1.item.zoom',
        maxPages: 3,
        description: 'Gallica infrastructure with SSL bypass (may fail due to server issues)'
    }
];

function createValidationScript(test) {
    const scriptContent = `
const { EnhancedManuscriptDownloaderService } = require('${path.join(BASE_DIR, 'src', 'main', 'services', 'EnhancedManuscriptDownloaderService.ts')}');
const { createProgressMonitor } = require('${path.join(BASE_DIR, 'src', 'main', 'services', 'IntelligentProgressMonitor.js')}');
const path = require('path');

async function createValidationPDF() {
    console.log('Creating ${test.name} validation PDF...');
    console.log('Library: ${test.library}');
    console.log('URL: ${test.url}');
    console.log('Max pages: ${test.maxPages}');
    
    const service = new EnhancedManuscriptDownloaderService();
    const outputPath = path.join('${VALIDATION_DIR}', '${test.name}.pdf');
    
    try {
        // Parse manifest first
        console.log('Parsing manuscript URL...');
        const manifest = await service.parseManuscriptUrl('${test.url}');
        console.log(\`Found \${manifest.totalPages} pages: \${manifest.displayName}\`);
        
        // Limit pages for validation
        const limitedManifest = {
            ...manifest,
            pageLinks: manifest.pageLinks.slice(0, ${test.maxPages}),
            totalPages: Math.min(manifest.totalPages, ${test.maxPages})
        };
        
        console.log(\`Creating PDF with \${limitedManifest.totalPages} pages for validation...\`);
        
        // Create progress monitor
        const progressMonitor = createProgressMonitor();
        
        // Download with progress tracking
        await service.downloadManuscript('${test.url}', {
            onProgress: (progress) => {
                if (progress.percentage % 25 === 0 || progress.percentage === 100) {
                    console.log(\`Progress: \${progress.percentage}% (\${progress.downloadedPages}/\${progress.totalPages} pages)\`);
                }
            },
            onStatusChange: (status) => {
                console.log(\`Status: \${status.phase} - \${status.message}\`);
            },
            onError: (error) => {
                console.error('Download error:', error);
            }
        }, {
            outputPath: outputPath,
            maxPages: ${test.maxPages}
        });
        
        console.log(\`✅ Successfully created: \${outputPath}\`);
        process.exit(0);
        
    } catch (error) {
        console.error(\`❌ Failed to create \${test.name}: \${error.message}\`);
        process.exit(1);
    }
}

createValidationPDF();
    `;
    
    return scriptContent;
}

async function createAllValidationPDFs() {
    console.log('🚀 Creating validation PDFs for all 5 newly implemented libraries...\n');
    
    // Ensure output directory exists
    if (!fs.existsSync(VALIDATION_DIR)) {
        fs.mkdirSync(VALIDATION_DIR, { recursive: true });
    }
    
    // Clean up any existing validation files
    const existingFiles = fs.readdirSync(VALIDATION_DIR);
    for (const file of existingFiles) {
        if (file.endsWith('.pdf')) {
            fs.unlinkSync(path.join(VALIDATION_DIR, file));
        }
    }
    
    const results = [];
    
    for (let i = 0; i < VALIDATION_TESTS.length; i++) {
        const test = VALIDATION_TESTS[i];
        console.log(\`📖 Creating PDF \${i + 1}/\${VALIDATION_TESTS.length}: \${test.name}\`);
        console.log(\`   Library: \${test.library}\`);
        console.log(\`   Description: \${test.description}\`);
        
        try {
            // Create test script
            const scriptContent = createValidationScript(test);
            const tempScriptPath = path.join(__dirname, \`temp_\${test.library}_validation.cjs\`);
            fs.writeFileSync(tempScriptPath, scriptContent);
            
            // Execute the script with timeout
            console.log(\`   🔄 Executing validation script...\`);
            execSync(\`node "\${tempScriptPath}"\`, {
                stdio: 'inherit',
                timeout: 180000, // 3 minutes timeout
                cwd: BASE_DIR
            });
            
            // Clean up temp script
            if (fs.existsSync(tempScriptPath)) {
                fs.unlinkSync(tempScriptPath);
            }
            
            // Verify PDF was created
            const pdfPath = path.join(VALIDATION_DIR, \`\${test.name}.pdf\`);
            if (fs.existsSync(pdfPath)) {
                const stats = fs.statSync(pdfPath);
                console.log(\`   ✅ SUCCESS: \${test.name}.pdf (\${(stats.size / 1024 / 1024).toFixed(2)} MB)\`);
                results.push({
                    library: test.library,
                    name: test.name,
                    status: 'success',
                    fileSize: stats.size,
                    fileSizeMB: (stats.size / 1024 / 1024).toFixed(2)
                });
            } else {
                console.log(\`   ❌ FAILED: PDF not created for \${test.name}\`);
                results.push({
                    library: test.library,
                    name: test.name,
                    status: 'failed',
                    reason: 'PDF not created'
                });
            }
            
        } catch (error) {
            console.log(\`   ❌ FAILED: \${error.message}\`);
            results.push({
                library: test.library,
                name: test.name,
                status: 'failed',
                reason: error.message
            });
            
            // Clean up temp script if it exists
            const tempScriptPath = path.join(__dirname, \`temp_\${test.library}_validation.cjs\`);
            if (fs.existsSync(tempScriptPath)) {
                fs.unlinkSync(tempScriptPath);
            }
        }
        
        console.log(''); // Empty line for readability
    }
    
    // Generate summary
    console.log('📊 VALIDATION PDF CREATION SUMMARY');
    console.log('==================================');
    
    const successCount = results.filter(r => r.status === 'success').length;
    const totalCount = results.length;
    
    for (const result of results) {
        const statusIcon = result.status === 'success' ? '✅' : '❌';
        const sizeInfo = result.fileSizeMB ? \` (\${result.fileSizeMB} MB)\` : '';
        console.log(\`\${statusIcon} \${result.name}\${sizeInfo}\`);
    }
    
    console.log(\`\\n🎯 SUCCESS RATE: \${successCount}/\${totalCount} (\${((successCount/totalCount)*100).toFixed(1)}%)\`);
    
    if (successCount === totalCount) {
        console.log('\\n🎉 ALL VALIDATION PDFS CREATED SUCCESSFULLY!');
        console.log(\`📁 Location: \${VALIDATION_DIR}\`);
        console.log('Ready for user inspection and approval.');
    } else {
        console.log(\`\\n⚠️  \${totalCount - successCount} PDFs failed to create. Review needed.\`);
    }
    
    // Save results report
    const reportPath = path.join(VALIDATION_DIR, 'validation-results.json');
    fs.writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        totalLibraries: totalCount,
        successfulPDFs: successCount,
        failedPDFs: totalCount - successCount,
        results: results
    }, null, 2));
    
    return results;
}

// Run the validation PDF creation
createAllValidationPDFs().catch(error => {
    console.error('❌ Validation PDF creation failed:', error);
    process.exit(1);
});