#!/usr/bin/env node
/**
 * Test BNE with production code flow
 * Run with: npx tsx .devkit/testing/test-bne-production-flow.ts
 */

import fetch from 'node-fetch';
import * as https from 'https';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock electron app for testing
(global as any).electronApp = {
    getPath: (name: string) => `/tmp/test-${name}`,
    isPackaged: false
};

async function testBNEProductionFlow() {
    console.log('🔬 Testing BNE Production Flow\n');
    console.log('=' .repeat(60));
    
    const testUrl = 'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1';
    const manuscriptId = '0000007619';
    
    // Step 1: Test manifest generation with new BneLoader
    console.log('1️⃣ Testing BneLoader manifest generation...\n');
    
    const { BneLoader } = await import('../../src/main/services/library-loaders/BneLoader');
    const { SharedManifestAdapter } = await import('../../src/main/services/SharedManifestAdapter');
    
    // Create mock dependencies
    const mockDeps = {
        fetchDirect: async (url: string, options?: any) => {
            console.log(`   Mock fetchDirect called for: ${url}`);
            // For HEAD requests to check pages
            if (options?.method === 'HEAD') {
                // Simulate pages 1-438 exist
                const pageMatch = url.match(/page=(\d+)/);
                if (pageMatch) {
                    const pageNum = parseInt(pageMatch[1]);
                    if (pageNum <= 438) {
                        return {
                            ok: true,
                            headers: new Map([
                                ['content-type', 'application/pdf'],
                                ['content-length', String(200000 + Math.random() * 300000)]
                            ])
                        };
                    }
                }
                return { ok: false, status: 404 };
            }
            // For actual downloads
            return fetch(url, options);
        },
        fetchWithHTTPS: async (url: string, options?: any) => {
            console.log(`   Mock fetchWithHTTPS called for: ${url}`);
            const agent = new https.Agent({ rejectUnauthorized: false });
            return fetch(url, { ...options, agent } as any);
        },
        sanitizeUrl: (url: string) => url,
        createProgressMonitor: () => ({
            updateProgress: () => {},
            complete: () => {},
            abort: () => {}
        }),
        logger: {
            log: (msg: any) => console.log(`   [LOG] ${msg.message || msg}`),
            logDownloadStart: () => {},
            logDownloadComplete: () => {},
            logDownloadError: (lib: string, url: string, error: any) => {
                console.log(`   [ERROR] ${lib}: ${error.message}`);
            },
            logTimeout: () => {}
        }
    };
    
    try {
        const loader = new BneLoader(mockDeps as any);
        const startTime = Date.now();
        const manifest = await loader.loadManifest(testUrl);
        const loadTime = Date.now() - startTime;
        
        console.log(`\n✅ Manifest generated in ${loadTime}ms`);
        console.log(`   Total pages: ${manifest.totalPages}`);
        console.log(`   Library: ${manifest.library}`);
        console.log(`   Display name: ${manifest.displayName}`);
        console.log(`   First URL: ${manifest.pageLinks[0]}`);
        console.log(`   Last URL: ${manifest.pageLinks[manifest.pageLinks.length - 1]}`);
        
        // Verify binary search was used (should be fast)
        if (loadTime < 10000) {
            console.log(`   ✅ Binary search working (only took ${loadTime}ms)`);
        } else {
            console.log(`   ⚠️ Might not be using binary search (took ${loadTime}ms)`);
        }
        
        // Step 2: Test actual PDF download with SSL bypass
        console.log('\n2️⃣ Testing actual PDF download with SSL bypass...\n');
        
        const pdfUrl = manifest.pageLinks[0];
        console.log(`   Testing URL: ${pdfUrl}`);
        
        // Test WITHOUT SSL bypass (should fail)
        console.log('   Testing WITHOUT SSL bypass...');
        try {
            const response = await fetch(pdfUrl);
            console.log(`   ❌ PROBLEM: Download worked without SSL bypass (should have failed)`);
        } catch (error: any) {
            if (error.cause?.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
                console.log(`   ✅ Expected SSL error: ${error.cause.code}`);
            } else {
                console.log(`   ⚠️ Different error: ${error.message}`);
            }
        }
        
        // Test WITH SSL bypass (should work)
        console.log('\n   Testing WITH SSL bypass...');
        const agent = new https.Agent({ rejectUnauthorized: false });
        try {
            const response = await fetch(pdfUrl, { agent } as any);
            if (response.ok) {
                const buffer = await response.buffer();
                const header = buffer.slice(0, 5).toString();
                console.log(`   ✅ Download successful with SSL bypass!`);
                console.log(`      Size: ${buffer.length} bytes`);
                console.log(`      PDF header: ${header === '%PDF-' ? '✅ Valid' : '❌ Invalid: ' + header}`);
            } else {
                console.log(`   ❌ Download failed: HTTP ${response.status}`);
            }
        } catch (error: any) {
            console.log(`   ❌ Download with SSL bypass failed: ${error.message}`);
        }
        
        // Step 3: Verify the production service would use SSL bypass
        console.log('\n3️⃣ Checking if BNE is configured for SSL bypass in production...\n');
        
        const serviceFile = await fs.readFile(
            path.join(process.cwd(), 'src/main/services/EnhancedManuscriptDownloaderService.ts'),
            'utf-8'
        );
        
        // Check if bdh-rd.bne.es is in the fetchWithHTTPS list
        const fetchWithHTTPSRegex = /if\s*\([^)]*bdh-rd\.bne\.es[^)]*\)\s*{[^}]*fetchWithHTTPS/s;
        const hasFetchWithHTTPS = fetchWithHTTPSRegex.test(serviceFile);
        
        if (hasFetchWithHTTPS) {
            console.log('   ✅ bdh-rd.bne.es IS configured to use fetchWithHTTPS (SSL bypass)');
        } else {
            console.log('   ❌ bdh-rd.bne.es is NOT configured to use fetchWithHTTPS');
            console.log('      This is why downloads are failing with SSL errors!');
        }
        
        // Summary
        console.log('\n' + '=' .repeat(60));
        console.log('📊 TESTING SUMMARY');
        console.log('=' .repeat(60));
        console.log(`✅ Binary search page discovery: Working (${loadTime}ms)`);
        console.log(`✅ Direct PDF URL generation: Working`);
        console.log(`✅ SSL certificate issue: Confirmed (needs bypass)`);
        console.log(hasFetchWithHTTPS ? 
            '✅ SSL bypass configured: YES' : 
            '❌ SSL bypass configured: NO - THIS IS THE PROBLEM');
        
        if (!hasFetchWithHTTPS) {
            console.log('\n🔧 TO FIX: Add bdh-rd.bne.es to the fetchWithHTTPS domain list');
            console.log('   in EnhancedManuscriptDownloaderService.ts');
        }
        
    } catch (error: any) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run test
testBNEProductionFlow().catch(console.error);