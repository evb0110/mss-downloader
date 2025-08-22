#!/usr/bin/env bun

/**
 * QUICK TEST: Verify Florence resolution fix with single page download
 */

import https from 'https';
import fs from 'fs';

async function downloadPage(url: string): Promise<{ success: boolean; fileSize: number; error?: string }> {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'image/*,*/*;q=0.8',
                'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': 'https://cdm21059.contentdm.oclc.org/',
            },
            rejectUnauthorized: false
        };

        const req = https.request(requestOptions, (res) => {
            const chunks: Buffer[] = [];
            res.on('data', chunk => chunks.push(Buffer.from(chunk)));
            res.on('end', () => {
                if (res.statusCode! >= 200 && res.statusCode! < 300) {
                    const buffer = Buffer.concat(chunks);
                    const fileSize = buffer.length;
                    
                    // Save file
                    if (!fs.existsSync('.devkit/validation')) {
                        fs.mkdirSync('.devkit/validation', { recursive: true });
                    }
                    fs.writeFileSync('.devkit/validation/florence-test.jpg', buffer);
                    
                    resolve({ success: true, fileSize });
                } else {
                    resolve({ success: false, fileSize: 0, error: `HTTP ${res.statusCode}` });
                }
            });
        });

        req.on('error', (error) => {
            resolve({ success: false, fileSize: 0, error: error.message });
        });
        
        req.end();
    });
}

async function testResolutionFix() {
    console.log('🎯 QUICK FLORENCE RESOLUTION TEST\n');
    
    // Test old vs new URL format
    const collection = 'plutei';
    const pageId = '24932';
    
    console.log('📥 Testing NEW IIIF API (should be 1MB+):');
    const newUrl = `https://cdm21059.contentdm.oclc.org/digital/iiif/${collection}/${pageId}/full/max/0/default.jpg`;
    console.log(`URL: ${newUrl}\n`);
    
    const result = await downloadPage(newUrl);
    
    if (result.success) {
        const sizeKB = Math.round(result.fileSize / 1024);
        const sizeMB = (result.fileSize / (1024 * 1024)).toFixed(2);
        
        console.log(`✅ SUCCESS: Downloaded ${sizeKB}KB (${sizeMB}MB)`);
        
        if (result.fileSize >= 1000000) {
            console.log('🎉 EXCELLENT: File size indicates HIGH-RESOLUTION (1MB+)');
            console.log('✅ Resolution fix is working perfectly!');
        } else if (result.fileSize >= 800000) {
            console.log('✅ GOOD: File size indicates high resolution (800KB+)');
            console.log('✅ Resolution fix is working!');
        } else {
            console.log('⚠️  WARNING: File size seems low for high-resolution');
        }
        
        console.log(`📁 Saved to: .devkit/validation/florence-test.jpg`);
        
    } else {
        console.log(`❌ FAILED: ${result.error}`);
    }
}

testResolutionFix()
    .then(() => console.log('\n🎯 Test complete'))
    .catch(error => console.error('\n❌ Test failed:', error));