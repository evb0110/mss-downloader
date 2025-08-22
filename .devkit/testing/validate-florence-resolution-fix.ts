#!/usr/bin/env bun

/**
 * CRITICAL VALIDATION: Verify Florence resolution fix by downloading actual pages
 * Ensures the IIIF API provides high-resolution images (1MB+ files)
 */

import { FlorenceLoader } from '../../src/main/services/library-loaders/FlorenceLoader';
import https from 'https';
import fs from 'fs';

// Mock dependencies for testing
const mockDeps = {
    fetchWithHTTPS: async (url: string, options?: any) => {
        return new Promise<Response>((resolve, reject) => {
            const urlObj = new URL(url);
            const requestOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: urlObj.pathname + urlObj.search,
                method: options?.method || 'GET',
                headers: options?.headers || {},
                rejectUnauthorized: false
            };

            const req = https.request(requestOptions, (res) => {
                const chunks: Buffer[] = [];
                res.on('data', chunk => chunks.push(Buffer.from(chunk)));
                res.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    resolve({
                        ok: res.statusCode! >= 200 && res.statusCode! < 300,
                        status: res.statusCode!,
                        statusText: res.statusMessage || '',
                        headers: {
                            get: (name: string) => res.headers[name.toLowerCase()] as string || null
                        },
                        text: async () => buffer.toString(),
                        json: async () => JSON.parse(buffer.toString()),
                        arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
                    } as Response);
                });
            });

            req.on('error', reject);
            
            if (options?.body) {
                req.write(options.body);
            }
            
            req.end();
        });
    },
    logger: {
        log: (entry: any) => {
            const level = entry.level?.toUpperCase() || 'INFO';
            const library = entry.library ? `[${entry.library.toUpperCase()}]` : '';
            const message = entry.message || '';
            console.log(`[${level}]${library} ${message}`);
        },
        logDownloadError: (library: string, url: string, error: Error) => {
            console.error(`[ERROR][${library.toUpperCase()}] ${url}: ${error.message}`);
        }
    }
};

async function downloadAndValidatePage(url: string, pageNum: number): Promise<{ success: boolean; fileSize: number; error?: string }> {
    try {
        console.log(`📥 Downloading page ${pageNum}: ${url.substring(0, 80)}...`);
        
        const response = await mockDeps.fetchWithHTTPS(url);
        
        if (!response.ok) {
            return { success: false, fileSize: 0, error: `HTTP ${response.status}: ${response.statusText}` };
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileSize = buffer.length;
        
        // Save the file for inspection
        const filename = `.devkit/validation/florence-page-${pageNum}.jpg`;
        fs.writeFileSync(filename, buffer);
        
        console.log(`✅ Page ${pageNum}: ${(fileSize / 1024).toFixed(0)}KB saved to ${filename}`);
        
        return { success: true, fileSize };
        
    } catch (error: any) {
        return { success: false, fileSize: 0, error: error.message };
    }
}

async function validateFlorenceResolutionFix() {
    console.log('🎯 CRITICAL VALIDATION: Florence Resolution Fix\n');
    console.log('Testing that Florence loader now provides HIGH-RESOLUTION images (1MB+ files)\n');
    
    // Create validation directory
    if (!fs.existsSync('.devkit/validation')) {
        fs.mkdirSync('.devkit/validation', { recursive: true });
    }
    
    try {
        // Test Florence manuscript - Plut.16.39 Calendarium
        const testUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/25456';
        
        console.log(`📄 Loading Florence manuscript manifest...`);
        const loader = new FlorenceLoader(mockDeps);
        const manifest = await loader.loadManifest(testUrl);
        
        console.log(`✅ Manifest loaded: ${manifest.totalPages} pages`);
        console.log(`📖 Title: ${manifest.displayName}\n`);
        
        // Test download first 5 pages to validate resolution
        console.log('🔍 Testing first 5 pages for high-resolution quality...\n');
        
        let totalDownloaded = 0;
        let totalSize = 0;
        const results: Array<{ pageNum: number; success: boolean; fileSize: number; error?: string }> = [];
        
        for (let i = 0; i < Math.min(5, manifest.pageLinks.length); i++) {
            const pageUrl = manifest.pageLinks[i];
            const pageNum = i + 1;
            
            const result = await downloadAndValidatePage(pageUrl, pageNum);
            results.push({ pageNum, ...result });
            
            if (result.success) {
                totalDownloaded++;
                totalSize += result.fileSize;
            } else {
                console.error(`❌ Page ${pageNum} failed: ${result.error}`);
            }
            
            // Small delay to be respectful to server
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Analyze results
        console.log('\n📊 RESOLUTION VALIDATION RESULTS:');
        console.log('==========================================');
        
        if (totalDownloaded === 0) {
            throw new Error('CRITICAL: No pages downloaded successfully!');
        }
        
        const avgSize = totalSize / totalDownloaded;
        const avgSizeKB = Math.round(avgSize / 1024);
        const avgSizeMB = (avgSize / (1024 * 1024)).toFixed(2);
        
        console.log(`✅ Successfully downloaded: ${totalDownloaded}/5 pages`);
        console.log(`📏 Average file size: ${avgSizeKB}KB (${avgSizeMB}MB)`);
        
        // Validate resolution quality
        const isHighResolution = avgSize >= 800000; // At least 800KB indicates high-res
        const isExcellentResolution = avgSize >= 1000000; // 1MB+ is excellent
        
        if (isExcellentResolution) {
            console.log(`🎉 EXCELLENT: File sizes indicate HIGH-RESOLUTION images (${avgSizeMB}MB average)`);
            console.log(`✅ Resolution fix is working perfectly!`);
        } else if (isHighResolution) {
            console.log(`✅ GOOD: File sizes indicate medium-high resolution (${avgSizeMB}MB average)`);
            console.log(`✅ Resolution fix is working!`);
        } else {
            console.log(`❌ WARNING: File sizes still seem low (${avgSizeMB}MB average)`);
            console.log(`⚠️  Expected 1MB+ for high-resolution Florence manuscripts`);
        }
        
        // Show detailed breakdown
        console.log('\n📋 Individual Page Results:');
        for (const result of results) {
            if (result.success) {
                const sizeKB = Math.round(result.fileSize / 1024);
                const status = result.fileSize >= 800000 ? '✅ High-res' : '⚠️  Low-res';
                console.log(`   Page ${result.pageNum}: ${sizeKB}KB ${status}`);
            } else {
                console.log(`   Page ${result.pageNum}: ❌ Failed - ${result.error}`);
            }
        }
        
        console.log('\n🎯 VALIDATION COMPLETE');
        
        if (isHighResolution) {
            console.log('✅ Florence resolution fix is working correctly!');
            console.log('✅ Users will now receive high-quality manuscript images');
            return true;
        } else {
            console.log('❌ Resolution fix may need further adjustment');
            return false;
        }
        
    } catch (error: any) {
        console.error('\n💥 CRITICAL VALIDATION FAILED:', error.message);
        throw error;
    }
}

// Run the validation if this script is executed directly
if (import.meta.main) {
    validateFlorenceResolutionFix()
        .then((success) => {
            if (success) {
                console.log('\n🎉 Florence resolution validation PASSED!');
                process.exit(0);
            } else {
                console.log('\n❌ Florence resolution validation needs improvement');
                process.exit(1);
            }
        })
        .catch((error) => {
            console.error('\n💥 Florence resolution validation FAILED:', error.message);
            process.exit(1);
        });
}

export { validateFlorenceResolutionFix };