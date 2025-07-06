#!/usr/bin/env node

/**
 * BNE Endpoint Debug Script
 * Debug why the BNE endpoint is not working in our test
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

console.log('🔍 BNE Endpoint Debug Test');
console.log('=' .repeat(50));

const manuscriptId = '0000007619';

async function fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const reqOptions = {
            ...options,
            rejectUnauthorized: false, // Ignore SSL certificate issues for testing
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'same-origin',
                ...options.headers
            }
        };
        
        const req = https.request(url, reqOptions, (res) => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                res.body = Buffer.concat(chunks);
                resolve(res);
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function testEndpoint(url, description) {
    console.log(`\n🧪 Testing: ${description}`);
    console.log(`   URL: ${url}`);
    
    try {
        const response = await fetch(url);
        
        console.log(`   Status: ${response.statusCode}`);
        console.log(`   Content-Type: ${response.headers['content-type']}`);
        console.log(`   Content-Length: ${response.headers['content-length']}`);
        console.log(`   Body Size: ${response.body.length} bytes`);
        
        if (response.body.length < 1000) {
            console.log(`   Body Preview: ${response.body.toString().substring(0, 200)}...`);
        }
        
        return {
            success: response.statusCode === 200 && response.headers['content-type']?.includes('image'),
            status: response.statusCode,
            contentType: response.headers['content-type'],
            size: response.body.length
        };
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function main() {
    const endpoints = [
        {
            url: `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=1&jpeg=true`,
            description: 'PDF.raw JPEG endpoint (from comprehensive analysis)'
        },
        {
            url: `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=1`,
            description: 'PDF.raw without JPEG parameter'
        },
        {
            url: `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}`,
            description: 'PDF.raw without page parameter'
        },
        {
            url: `https://bdh-rd.bne.es/ImageProxy?id=${manuscriptId}&page=1`,
            description: 'ImageProxy endpoint'
        },
        {
            url: `https://bdh-rd.bne.es/ImageProxy?id=${manuscriptId}&page=1&size=full`,
            description: 'ImageProxy with size parameter'
        }
    ];
    
    const results = [];
    
    for (const endpoint of endpoints) {
        const result = await testEndpoint(endpoint.url, endpoint.description);
        results.push({ ...endpoint, ...result });
        
        // Delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 Summary:');
    console.log('='.repeat(50));
    
    const working = results.filter(r => r.success);
    const failing = results.filter(r => !r.success);
    
    if (working.length > 0) {
        console.log('\n✅ Working Endpoints:');
        working.forEach(r => {
            console.log(`   - ${r.description}: ${r.contentType}, ${r.size} bytes`);
        });
    }
    
    if (failing.length > 0) {
        console.log('\n❌ Failing Endpoints:');
        failing.forEach(r => {
            console.log(`   - ${r.description}: ${r.error || `HTTP ${r.status}, ${r.contentType}`}`);
        });
    }
    
    // Try to download a working endpoint
    if (working.length > 0) {
        const validationDir = path.join(__dirname, '../validation-current/bne-debug');
        if (!fs.existsSync(validationDir)) {
            fs.mkdirSync(validationDir, { recursive: true });
        }
        
        console.log('\n💾 Downloading sample from working endpoint...');
        const workingEndpoint = working[0];
        
        try {
            const response = await fetch(workingEndpoint.url);
            const filename = `bne_debug_${manuscriptId}.${workingEndpoint.contentType?.includes('pdf') ? 'pdf' : 'jpg'}`;
            const filepath = path.join(validationDir, filename);
            
            fs.writeFileSync(filepath, response.body);
            console.log(`   ✅ Downloaded: ${filename}`);
            
            // Try to verify it's a valid image/PDF
            const stats = fs.statSync(filepath);
            console.log(`   📊 File size: ${Math.round(stats.size / 1024)} KB`);
            
        } catch (error) {
            console.log(`   ❌ Download failed: ${error.message}`);
        }
    }
}

if (require.main === module) {
    main().catch(console.error);
}