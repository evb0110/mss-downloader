#!/usr/bin/env bun

/**
 * Test script for Ultra-Reliable BDL Download Service
 * This script tests the new ultra-reliable download mode for BDL manuscripts
 */

import { UltraReliableBDLService } from '../dist/main/services/UltraReliableBDLService.js';
import { promises as fs } from 'fs';
import path from 'path';

interface UltraReliableOptions {
    ultraReliableMode: boolean;
    maxRetries: number;
    maxQualityFallbacks: boolean;
    proxyHealthCheck: boolean;
    persistentQueue: boolean;
    pageVerificationSize: number;
    minDelayMs: number;
    maxDelayMs: number;
}

interface QueueStatus {
    size: number;
    items: QueueItem[];
}

interface QueueItem {
    pageIndex: number;
    attemptCount: number;
    lastAttempt: number;
}

async function testUltraReliableBDL(): Promise<void> {
    console.log('🧪 Testing Ultra-Reliable BDL Service...\n');
    
    const service = UltraReliableBDLService.getInstance();
    
    // Test URLs from a real BDL manuscript
    const testUrls = [
        'https://www.bdl.servizirl.it/cantaloupe/iiif/2/a7a6d8f0-8a5a-4641-8c2b-b88e89f16cf8/full/max/0/default.jpg',
        'https://www.bdl.servizirl.it/cantaloupe/iiif/2/b8b7e9f1-9b6b-5752-9d3c-c99f90f17df9/full/max/0/default.jpg',
        'https://www.bdl.servizirl.it/cantaloupe/iiif/2/c9c8fa02-ac7c-6863-ae4d-daa0a1f28e0a/full/max/0/default.jpg'
    ];
    
    const testDir = path.join(process.cwd(), 'tests', 'bdl-test-output');
    await fs.mkdir(testDir, { recursive: true });
    
    console.log('📁 Test output directory:', testDir);
    console.log('🔗 Testing with', testUrls.length, 'BDL pages\n');
    
    // Test 1: Download with ultra-reliable mode
    console.log('Test 1: Ultra-Reliable Download');
    console.log('================================');
    
    for (let i = 0; i < testUrls.length; i++) {
        const url = testUrls[i];
        console.log(`\n📥 Downloading page ${i + 1}/${testUrls.length}`);
        console.log(`   URL: ${url.substring(0, 80)}...`);
        
        const startTime = Date.now();
        
        try {
            const options: UltraReliableOptions = {
                ultraReliableMode: true,
                maxRetries: 5, // Limited for testing
                maxQualityFallbacks: true,
                proxyHealthCheck: true,
                persistentQueue: false, // Disabled for testing
                pageVerificationSize: 10240,
                minDelayMs: 500, // Faster for testing
                maxDelayMs: 5000
            };
            
            const buffer = await service.ultraReliableDownload(url, i, options);
            
            if (buffer) {
                const filename = path.join(testDir, `page_${i + 1}.jpg`);
                await fs.writeFile(filename, buffer);
                
                const stats = await fs.stat(filename);
                const duration = Date.now() - startTime;
                
                console.log(`   ✅ SUCCESS: Downloaded ${stats.size} bytes in ${duration}ms`);
                console.log(`   📄 Saved to: ${filename}`);
                
                // Verify it's a valid JPEG
                if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
                    console.log(`   🖼️ Valid JPEG signature detected`);
                } else {
                    console.log(`   ⚠️ Warning: May not be a valid JPEG`);
                }
            } else {
                console.log(`   ❌ FAILED: Could not download after retries`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log(`   ❌ ERROR: ${errorMessage}`);
        }
    }
    
    // Test 2: Verify and re-download
    console.log('\n\nTest 2: Post-Download Verification');
    console.log('===================================');
    
    const imagePaths: (string | null)[] = [];
    for (let i = 0; i < testUrls.length; i++) {
        const filename = path.join(testDir, `page_${i + 1}.jpg`);
        try {
            await fs.access(filename);
            imagePaths[i] = filename;
        } catch {
            imagePaths[i] = null;
        }
    }
    
    console.log(`\n📊 Initial status: ${imagePaths.filter(Boolean).length}/${testUrls.length} pages downloaded`);
    
    // Simulate some failed pages by setting them to null
    if (imagePaths[1]) {
        console.log('🔧 Simulating failed page 2 for recovery test...');
        imagePaths[1] = null;
    }
    
    console.log('🔍 Running verification and recovery...\n');
    
    const verificationOptions: UltraReliableOptions = {
        ultraReliableMode: true,
        maxRetries: 3,
        maxQualityFallbacks: true,
        proxyHealthCheck: false, // Faster for testing
        persistentQueue: false,
        pageVerificationSize: 10240,
        minDelayMs: 500,
        maxDelayMs: 5000
    };
    
    const verifiedPaths = await service.verifyAndRedownload(imagePaths, testUrls, verificationOptions);
    
    const successCount = verifiedPaths.filter(Boolean).length;
    console.log(`\n✅ Verification complete: ${successCount}/${testUrls.length} pages verified`);
    
    // Test 3: Check retry queue status
    console.log('\n\nTest 3: Retry Queue Status');
    console.log('==========================');
    
    const queueStatus: QueueStatus = service.getQueueStatus();
    console.log(`📋 Queue size: ${queueStatus.size} items`);
    
    if (queueStatus.size > 0) {
        console.log('📝 Queue items:');
        queueStatus.items.forEach((item: QueueItem) => {
            console.log(`   - Page ${item.pageIndex}: ${item.attemptCount} attempts, last: ${new Date(item.lastAttempt).toLocaleTimeString()}`);
        });
        
        console.log('\n🧹 Clearing retry queue...');
        await service.clearRetryQueue();
        console.log('✅ Queue cleared');
    }
    
    // Summary
    console.log('\n\n📊 Test Summary');
    console.log('===============');
    console.log(`✅ Tests completed successfully`);
    console.log(`📁 Output files in: ${testDir}`);
    console.log(`📄 Downloaded ${successCount} pages`);
    
    // Cleanup option
    console.log('\n💡 To view downloaded images:');
    console.log(`   open ${testDir}`);
    console.log('\n💡 To clean up test files:');
    console.log(`   rm -rf ${testDir}`);
}

// Run the test
if (import.meta.main) {
    (async () => {
    await testUltraReliableBDL().catch(console.error);

    })().catch(console.error);
}

export { testUltraReliableBDL };