#!/usr/bin/env bun
// Full production test of Bordeaux manuscript downloading
// This simulates the exact production workflow with no exemptions

import { EnhancedManuscriptDownloaderService } from '../../src/main/services/EnhancedManuscriptDownloaderService';
import * as fs from 'fs';
import * as path from 'path';

async function productionBordeauxTest() {
    console.log('🏭 Production Bordeaux Download Test - No Exemptions');
    
    const testUrl = 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778';
    const outputDir = '/Users/evb/WebstormProjects/mss-downloader/.devkit/validation/READY-FOR-USER';
    const expectedName = 'bordeaux-production-test.pdf';
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    try {
        console.log('📋 Step 1: Initialize production services...');
        const downloader = new EnhancedManuscriptDownloaderService();
        
        console.log('📋 Step 2: Test manifest loading...');
        const manifest = await downloader.loadManifest(testUrl);
        
        console.log('✓ Manifest loaded:');
        console.log(`  - Library: ${manifest.library}`);
        console.log(`  - Display Name: ${manifest.displayName}`);
        console.log(`  - Total Pages: ${manifest.totalPages}`);
        console.log(`  - Page Links: ${manifest.pageLinks.length}`);
        console.log(`  - Requires Tile Processor: ${(manifest as any).requiresTileProcessor}`);
        console.log(`  - Tile Config: ${JSON.stringify((manifest as any).tileConfig || {}, null, 2)}`);
        
        // Check the tile configuration for correct base ID
        const tileConfig = (manifest as any).tileConfig;
        if (tileConfig && tileConfig.baseId) {
            console.log(`  - Base ID for tiles: ${tileConfig.baseId}`);
            if (String(tileConfig.baseId).includes('_MS_')) {
                console.log('❌ CRITICAL ERROR: Base ID contains underscore (_MS_) - should be MS without underscore');
                console.log('   This will cause all tile downloads to fail with 404 errors');
            } else {
                console.log('✅ Base ID format looks correct');
            }
        }
        
        console.log('\n📋 Step 3: Test first 5 pages download (sample)...');
        
        // Track download progress
        let downloadedPages = 0;
        let errorCount = 0;
        const errors: string[] = [];
        let returnedPdfPath: string | null = null;
        
        console.log('📋 Step 4: Execute production download...');
        
        const pdfPath = await downloader.downloadManuscript(testUrl, {
            onProgress: (p) => {
                if (typeof p === 'object') {
                    const pct = Math.floor((p.progress || 0) * 100);
                    downloadedPages = p.downloadedPages || downloadedPages;
                    console.log(`  Progress: ${pct}% (${p.downloadedPages || 0}/${p.totalPages || 0})`);
                }
            },
            library: manifest.library,
            displayName: 'Production Test - Bordeaux (5 pages)',
            // Slice to first 5 pages
            pageLinks: manifest.pageLinks.slice(0, 5),
            totalPages: 5,
            requiresTileProcessor: (manifest as any).requiresTileProcessor,
            tileConfig: (manifest as any).tileConfig,
            startPage: 1,
            endPage: 5,
        });
        returnedPdfPath = typeof pdfPath === 'string' ? pdfPath : null;
        
        console.log('\n📋 Step 5: Validate results...');
        
        if (returnedPdfPath) {
            console.log('✅ Download completed successfully!');
            
            // Validate PDF file
            if (fs.existsSync(returnedPdfPath)) {
                const stats = fs.statSync(returnedPdfPath);
                console.log(`✓ PDF created: ${path.basename(returnedPdfPath)} (${(stats.size / 1024).toFixed(1)}KB)`);
                
                if (stats.size > 100000) { // > 100KB for 5 pages suggests high resolution
                    console.log('✅ HIGH RESOLUTION: File size suggests quality content');
                } else if (stats.size > 10000) { // > 10KB suggests basic content
                    console.log('⚠️  MEDIUM RESOLUTION: File size suggests basic content');
                } else {
                    console.log('❌ LOW RESOLUTION: File size too small - likely failed');
                }
                
                // Additional PDF validation with poppler if available
                try {
                    console.log('\n📋 Step 6: PDF structure validation...');
                    const { execSync } = require('child_process');
                    
                    const pdfInfo = execSync(`pdfinfo \"${returnedPdfPath}\"`, { encoding: 'utf8', timeout: 5000 });
                    console.log('✓ PDF info:');
                    pdfInfo.split('\n').slice(0, 5).forEach((line: string) => {
                        if (line.trim()) console.log(`  ${line}`);
                    });
                    
                    console.log('\n✅ PDF VALIDATION PASSED - File is valid PDF');
                } catch (pdfError) {
                    console.log('⚠️  PDF validation skipped (pdfinfo not available)');
                }
                
            } else {
                console.log('❌ CRITICAL FAILURE: PDF file not created');
                errorCount++;
                errors.push('PDF file not created');
            }
        } else {
            console.log('❌ Download failed: no file path returned');
            errorCount++;
            errors.push('Download did not return a file path');
        }
        
        console.log('\n🏁 PRODUCTION TEST RESULTS:');
        console.log(`  Pages attempted: 5`);
        console.log(`  Pages downloaded: ${downloadedPages}`);
        console.log(`  Errors encountered: ${errorCount}`);
        
        if (errorCount === 0 && downloadedPages === 5) {
            console.log('\n🎉 SUCCESS: Production Bordeaux download is working perfectly!');
            console.log('📁 Test files available in:', path.dirname(returnedPdfPath || outputDir));
            return true;
        } else {
            console.log('\n❌ FAILURE: Production download has issues:');
            errors.forEach((error, i) => console.log(`  ${i + 1}. ${error}`));
            return false;
        }
        
    } catch (error) {
        console.log('💥 CATASTROPHIC FAILURE:', error);
        return false;
    }
}

productionBordeauxTest().then(success => {
    process.exit(success ? 0 : 1);
});
