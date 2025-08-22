#!/usr/bin/env bun

/**
 * Analyze Florence manuscript pages 211-215 to understand the 2.5KB file issue
 * Get exact URLs and test each page individually
 */

import { FlorenceLoader } from '../../src/main/services/library-loaders/FlorenceLoader';
import fs from 'fs';
import path from 'path';

const mockLogger = {
    log: (entry: any) => {
        const timestamp = new Date().toISOString().substring(11, 19);
        console.log(`[${timestamp}] [${entry.level?.toUpperCase()}] ${entry.library || 'SYSTEM'}: ${entry.message}`);
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

async function analyzePageUrl(pageUrl: string, pageNumber: number): Promise<{ success: boolean; size?: number; contentType?: string; headers?: Record<string, string>; error?: string }> {
    try {
        console.log(`\n🔍 Testing page ${pageNumber}:`);
        console.log(`   URL: ${pageUrl}`);
        
        const response = await fetch(pageUrl, {
            method: 'HEAD',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'image/*,*/*;q=0.8',
                'Referer': 'https://cdm21059.contentdm.oclc.org/',
            }
        });

        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
            headers[key] = value;
        });

        const contentLength = response.headers.get('content-length');
        const contentType = response.headers.get('content-type');
        const size = contentLength ? parseInt(contentLength) : undefined;

        console.log(`   Status: ${response.status} ${response.statusText}`);
        console.log(`   Content-Type: ${contentType || 'unknown'}`);
        console.log(`   Size: ${size ? `${Math.round(size / 1024)}KB (${size} bytes)` : 'unknown'}`);

        if (!response.ok) {
            return { 
                success: false, 
                error: `HTTP ${response.status}: ${response.statusText}`,
                contentType: contentType || undefined,
                headers 
            };
        }

        // Test actual download of a small portion
        console.log(`   🔄 Testing actual download...`);
        const downloadResponse = await fetch(pageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'image/*,*/*;q=0.8',
                'Referer': 'https://cdm21059.contentdm.oclc.org/',
                'Range': 'bytes=0-1023' // First 1KB only for testing
            }
        });

        const actualSize = downloadResponse.headers.get('content-length');
        const actualContentType = downloadResponse.headers.get('content-type');
        
        console.log(`   📥 Download test: ${downloadResponse.status} ${downloadResponse.statusText}`);
        console.log(`   📊 Actual download size: ${actualSize ? `${actualSize} bytes` : 'unknown'}`);

        return { 
            success: response.ok, 
            size, 
            contentType: contentType || undefined,
            headers 
        };

    } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`);
        return { success: false, error: error.message || String(error) };
    }
}

async function downloadAndAnalyzePage(pageUrl: string, pageNumber: number, outputDir: string): Promise<{ success: boolean; size?: number; error?: string; filename?: string }> {
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
        
        const filename = `page_${pageNumber}_analysis.jpg`;
        const outputPath = path.join(outputDir, filename);
        
        await Bun.write(outputPath, imageData);
        
        // Analyze the downloaded file
        const stats = fs.statSync(outputPath);
        console.log(`   📁 Downloaded: ${filename} (${stats.size} bytes, ${Math.round(stats.size / 1024)}KB)`);
        
        // Check if it's a valid image by reading first few bytes
        const header = imageData.slice(0, 10);
        const headerHex = Array.from(header).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`   🔍 File header: ${headerHex}`);
        
        // Check for common image signatures
        if (imageData[0] === 0xFF && imageData[1] === 0xD8) {
            console.log(`   ✅ Valid JPEG signature detected`);
        } else if (imageData[0] === 0x89 && imageData[1] === 0x50 && imageData[2] === 0x4E && imageData[3] === 0x47) {
            console.log(`   ✅ Valid PNG signature detected`);
        } else {
            console.log(`   ⚠️  Unknown file format - may not be a valid image`);
        }
        
        return { success: true, size: imageData.length, filename };
        
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
}

async function analyzeFlorence211to215() {
    console.log('🔍 ANALYZING FLORENCE PAGES 211-215');
    console.log('===================================\n');
    
    const testUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/217710/rec/2';
    console.log(`📚 Target: Plut.16.39 Calendarium`);
    console.log(`🔗 URL: ${testUrl}\n`);
    
    // Create output directory
    const outputDir = '.devkit/validation/FLORENCE-PAGES-211-215-ANALYSIS';
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
        // Load manifest to get all page URLs
        console.log('📋 Loading manifest to get page URLs...');
        const florenceLoader = new FlorenceLoader(loaderDeps);
        const manifest = await florenceLoader.loadManifest(testUrl);
        
        console.log(`✅ Manifest loaded: ${manifest.totalPages} pages total\n`);
        
        // Get URLs for pages 211-215 (0-indexed: 210-214)
        const targetPages = [211, 212, 213, 214, 215];
        const pageUrls: Array<{ pageNumber: number; url: string }> = [];
        
        console.log('📋 Extracting URLs for pages 211-215:');
        targetPages.forEach(pageNum => {
            const index = pageNum - 1; // Convert to 0-indexed
            if (index < manifest.pageLinks.length) {
                const url = manifest.pageLinks[index];
                pageUrls.push({ pageNumber: pageNum, url });
                console.log(`   Page ${pageNum}: ${url}`);
            } else {
                console.log(`   Page ${pageNum}: ❌ Not found (index ${index} >= ${manifest.pageLinks.length})`);
            }
        });
        
        if (pageUrls.length === 0) {
            throw new Error('No valid page URLs found for pages 211-215');
        }
        
        console.log(`\n🔍 INDIVIDUAL PAGE ANALYSIS`);
        console.log('============================');
        
        // Analyze each page individually
        const results: Array<{ pageNumber: number; url: string; success: boolean; size?: number; error?: string; filename?: string }> = [];
        
        for (const { pageNumber, url } of pageUrls) {
            // First test with HEAD request
            const headResult = await analyzePageUrl(url, pageNumber);
            
            // Then download and analyze
            const downloadResult = await downloadAndAnalyzePage(url, pageNumber, outputDir);
            
            results.push({
                pageNumber,
                url,
                success: downloadResult.success,
                size: downloadResult.size,
                error: downloadResult.error,
                filename: downloadResult.filename
            });
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Summary analysis
        console.log(`\n📊 SUMMARY ANALYSIS`);
        console.log('===================');
        
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        const totalSize = successful.reduce((sum, r) => sum + (r.size || 0), 0);
        
        console.log(`✅ Successful downloads: ${successful.length}/${results.length}`);
        console.log(`❌ Failed downloads: ${failed.length}/${results.length}`);
        console.log(`📊 Total size: ${totalSize} bytes (${Math.round(totalSize / 1024)}KB)`);
        console.log(`📊 Average size per page: ${successful.length > 0 ? Math.round(totalSize / successful.length / 1024) : 0}KB`);
        
        if (failed.length > 0) {
            console.log(`\n❌ Failed pages:`);
            failed.forEach(r => {
                console.log(`   Page ${r.pageNumber}: ${r.error}`);
            });
        }
        
        if (successful.length > 0) {
            console.log(`\n✅ Successful pages:`);
            successful.forEach(r => {
                console.log(`   Page ${r.pageNumber}: ${Math.round((r.size || 0) / 1024)}KB`);
            });
        }
        
        // Write detailed report
        const report = `Florence Pages 211-215 Analysis Report
=======================================

Target URL: ${testUrl}
Analysis Date: ${new Date().toISOString()}
Total Pages in Manifest: ${manifest.totalPages}

Individual Page Results:
${results.map(r => `
Page ${r.pageNumber}:
  URL: ${r.url}
  Status: ${r.success ? 'SUCCESS' : 'FAILED'}
  Size: ${r.size ? `${r.size} bytes (${Math.round(r.size / 1024)}KB)` : 'N/A'}
  Error: ${r.error || 'None'}
  File: ${r.filename || 'N/A'}
`).join('')}

Summary:
- Successful: ${successful.length}/${results.length} pages
- Failed: ${failed.length}/${results.length} pages  
- Total size: ${totalSize} bytes (${Math.round(totalSize / 1024)}KB)
- Average per page: ${successful.length > 0 ? Math.round(totalSize / successful.length / 1024) : 0}KB

Analysis:
${totalSize < 10 * 1024 ? 
'⚠️  ISSUE DETECTED: Total size is very small, suggesting corrupted or truncated downloads.' :
totalSize < 50 * 1024 ?
'⚠️  WARNING: Total size is smaller than expected for 5 manuscript pages.' :
'✅ File sizes appear normal for manuscript pages.'}

Expected size for 5 pages: ~50-500KB (typical manuscript pages)
Actual size: ${Math.round(totalSize / 1024)}KB

${totalSize === 2580 ? 
'🎯 FOUND THE ISSUE: Total size matches the reported 2580 bytes!' :
`🔍 Size comparison: Expected 2580 bytes, got ${totalSize} bytes`}

Next Steps:
${failed.length > 0 ? 
'- Investigate failed page downloads - may indicate server issues or access restrictions' : ''}
${totalSize < 50 * 1024 ? 
'- Check if ContentDM is serving compressed/thumbnail versions instead of full images' : ''}
- Verify ContentDM API endpoints are returning correct image sizes
- Consider if this is a server-side issue vs client-side processing problem
`;
        
        await fs.promises.writeFile(path.join(outputDir, 'analysis_report.txt'), report);
        
        console.log(`\n🎯 CONCLUSION`);
        console.log('=============');
        
        if (totalSize === 2580) {
            console.log(`🎯 EXACT MATCH: Total size is ${totalSize} bytes - this explains the 2580 byte error!`);
        } else {
            console.log(`🔍 Size investigation: Got ${totalSize} bytes vs expected 2580 bytes`);
        }
        
        if (totalSize < 50 * 1024) {
            console.log(`⚠️  ISSUE CONFIRMED: Pages 211-215 are producing unusually small files`);
            console.log(`   This explains why the file verification failed`);
            console.log(`   Likely causes: ContentDM serving thumbnails, server errors, or access restrictions`);
        } else {
            console.log(`✅ Pages appear to have normal sizes`);
        }
        
        console.log(`\n📁 Analysis results saved to: ${outputDir}/`);
        
    } catch (error) {
        console.error('❌ ANALYSIS FAILED:', error);
    }
}

analyzeFlorence211to215();