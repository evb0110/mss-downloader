#!/usr/bin/env node

/**
 * Apply BDL hanging fix by removing problematic image validation
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../src/main/services/EnhancedManuscriptDownloaderService.ts');

console.log('🔧 Applying BDL hanging fix...');

try {
    // Read the file
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Find and replace the problematic validation section
    const oldValidationCode = `                // Validate first image URL to ensure it's accessible
                console.log('Validating first image URL...');
                const validationMonitor = createProgressMonitor(
                    'BDL image validation',
                    'bdl',
                    { initialTimeout: 20000, maxTimeout: 60000 },
                    {}
                );
                
                const firstImageController = validationMonitor.start();
                validationMonitor.updateProgress(0, 1, 'Validating BDL image access...');
                
                try {
                    const firstImageResponse = await fetch(pageLinks[0], {
                        method: 'HEAD',
                        signal: firstImageController.signal,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                        }
                    });
                    
                    validationMonitor.updateProgress(1, 1, 'BDL image validation completed');
                    
                    if (!firstImageResponse.ok) {
                        console.warn(\`First image validation failed: HTTP \${firstImageResponse.status}\`);
                    } else {
                        console.log('First image URL validated successfully');
                    }
                } catch (validationError: any) {
                    if (validationError.name === 'AbortError') {
                        console.warn('BDL image validation timed out - this may indicate server issues but manifest loading can continue');
                    } else {
                        console.warn('First image validation failed:', validationError.message);
                    }
                    // Don't fail the entire process, just log the warning
                } finally {
                    validationMonitor.complete();
                }`;

    const newValidationCode = `                // Skip image validation for BDL due to IIIF server hanging issues
                // The API provides valid image IDs, but the IIIF server has timeout problems
                console.log('Skipping BDL image validation due to known IIIF server issues');
                console.log('Note: BDL IIIF server may have temporary issues, but manifest structure is valid');`;

    if (content.includes(oldValidationCode)) {
        content = content.replace(oldValidationCode, newValidationCode);
        
        // Write the file back
        fs.writeFileSync(filePath, content, 'utf8');
        
        console.log('✅ BDL hanging fix applied successfully!');
        console.log('   - Removed problematic image validation that caused 20+ second hangs');
        console.log('   - BDL manifests will now load quickly without hanging');
        
    } else {
        console.log('⚠️ Could not find exact validation code to replace');
        console.log('   The file may have already been modified or the code structure changed');
        
        // Try a simpler pattern match
        if (content.includes('BDL image validation')) {
            console.log('   Found BDL image validation references - manual review needed');
        }
    }
    
} catch (error) {
    console.error('❌ Error applying BDL fix:', error.message);
    process.exit(1);
}

console.log('\n🎯 BDL hanging fix complete - ready for testing!');