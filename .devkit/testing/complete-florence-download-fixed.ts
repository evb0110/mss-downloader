#!/usr/bin/env bun

/**
 * Complete Florence manuscript download test with fixed ContentDM native API URLs
 * Should achieve much higher success rate than 72%
 */

import { FlorenceLoader } from '../../src/main/services/library-loaders/FlorenceLoader';
import fs from 'fs';
import path from 'path';

const mockLogger = {
    log: (entry: any) => {
        const timestamp = new Date().toISOString().substring(11, 19);
        console.log(`[${timestamp}] [${entry.level?.toUpperCase()}] ${entry.message}`);
    },
    logDownloadStart: () => {},
    logDownloadComplete: () => {},
    logDownloadError: (library: string, url: string, error: Error) => {
        console.log(`[ERROR] ${library}: ${error.message}`);
    }
};

const loaderDeps = {
    fetchWithHTTPS: fetch,
    fetchWithProxyFallback: fetch,
    fetchDirect: fetch,
    logger: mockLogger
};

async function downloadPage(pageUrl: string, pageNumber: number, outputPath: string): Promise<{ success: boolean; size?: number; error?: string }> {
    try {
        const response = await fetch(pageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'image/*,*/*;q=0.8',
                'Referer': 'https://cdm21059.contentdm.oclc.org/',
            }
        });

        if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
        }

        const imageBuffer = await response.arrayBuffer();
        const imageData = new Uint8Array(imageBuffer);
        
        if (imageData.length === 0) {
            return { success: false, error: 'Empty response' };
        }

        // Write to file
        await Bun.write(outputPath, imageData);
        
        return { success: true, size: imageData.length };

    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
}

async function completeDownloadTest() {
    console.log('🔍 COMPLETE FLORENCE DOWNLOAD TEST (FIXED URLS)');
    console.log('===============================================\n');
    
    const testUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/217710/rec/2';
    console.log(`Target: ${testUrl}\n`);
    
    // Create output directory
    const outputDir = '.devkit/validation/FIXED-FLORENCE-TEST';
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
        // Load manifest with fixed loader
        const florenceLoader = new FlorenceLoader(loaderDeps);
        const manifest = await florenceLoader.loadManifest(testUrl);
        
        console.log(`✅ Manifest loaded: ${manifest.totalPages} pages\n`);
        
        // Download all pages
        const downloadResults: Array<{ pageNumber: number; success: boolean; size?: number; error?: string }> = [];
        const startTime = Date.now();
        
        console.log('📋 Starting complete download...\n');
        
        const maxPages = Math.min(manifest.pageLinks.length, 30); // Test first 30 pages for speed
        
        for (let i = 0; i < maxPages; i++) {
            const pageUrl = manifest.pageLinks[i];
            const pageNumber = i + 1;
            const outputPath = path.join(outputDir, `page_${pageNumber.toString().padStart(3, '0')}.jpg`);
            
            console.log(`📄 Downloading page ${pageNumber}/${maxPages}...`);
            
            const result = await downloadPage(pageUrl, pageNumber, outputPath);
            downloadResults.push({ pageNumber, ...result });
            
            if (result.success) {
                const sizeMB = ((result.size || 0) / 1024 / 1024).toFixed(2);
                console.log(`   ✅ Success: ${sizeMB}MB`);
            } else {
                console.log(`   ❌ Failed: ${result.error}`);
            }
            
            // Rate limiting - longer delay to avoid overwhelming ContentDM
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Calculate results
        const duration = Date.now() - startTime;
        const successful = downloadResults.filter(r => r.success).length;
        const failed = downloadResults.filter(r => !r.success).length;
        const successRate = Math.round((successful / maxPages) * 100);
        
        // Write summary
        const summary = `Florence Manuscript Download Summary (FIXED URLS)
Manuscript: Plut.16.39 Calendarium (Fixed ContentDM Native API URLs)
Download Date: ${new Date().toISOString()}
Pages Attempted: ${maxPages} (sample from ${manifest.totalPages} total)
Successfully Downloaded: ${successful}
Failed: ${failed}
Success Rate: ${successRate}%
Duration: ${Math.round(duration / 1000)}s

URL Pattern Used: ContentDM Native API (/digital/api/singleitem/image/)
Previous Success Rate (IIIF): 72% (159/221 pages)
Fixed Success Rate (Native API): ${successRate}% (${successful}/${maxPages} pages)

Pages Downloaded:
${downloadResults.filter(r => r.success).map(r => 
    `  Page ${r.pageNumber}: ${((r.size || 0) / 1024).toFixed(0)}KB`
).join('\n')}

Failed Pages:
${downloadResults.filter(r => !r.success).map(r => 
    `  Page ${r.pageNumber}: ${r.error}`
).join('\n')}
`;
        
        await Bun.write(path.join(outputDir, 'download_summary_FIXED.txt'), summary);
        
        console.log('\n🎯 DOWNLOAD TEST COMPLETE');
        console.log('=========================');
        console.log(`   Attempted: ${maxPages} pages (sample)`);
        console.log(`   Successful: ${successful} pages`);
        console.log(`   Failed: ${failed} pages`);
        console.log(`   Success Rate: ${successRate}%`);
        console.log(`   Duration: ${Math.round(duration / 1000)}s`);
        console.log(`   Average: ${Math.round(duration / maxPages)}ms per page`);
        
        if (successRate >= 85) {
            console.log('\n✅ SUCCESS: High success rate achieved with fixed URLs!');
            console.log('   The ContentDM native API fix resolved the systematic gaps.');
        } else if (successRate > 72) {
            console.log('\n✅ IMPROVEMENT: Better than previous 72% with IIIF URLs');
            console.log('   ContentDM native API is working but may have rate limiting.');
        } else {
            console.log('\n❌ ISSUE: Success rate still low, need further investigation.');
        }
        
        console.log(`\n📁 Results saved to: ${outputDir}/`);
        
    } catch (error) {
        console.error('❌ COMPLETE DOWNLOAD TEST FAILED:', error);
    }
}

completeDownloadTest();