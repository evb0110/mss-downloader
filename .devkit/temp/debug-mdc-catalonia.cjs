#!/usr/bin/env node

/**
 * Debug MDC Catalonia IIIF endpoints
 */

const https = require('https');

async function fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const reqOptions = {
            ...options,
            rejectUnauthorized: false,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json, application/ld+json, */*',
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

async function testMDCEndpoints() {
    console.log('🔍 Debugging MDC Catalonia IIIF endpoints');
    console.log('=' .repeat(50));
    
    const collection = 'incunableBC';
    const itemId = '175331';
    
    const testEndpoints = [
        {
            name: 'IIIF Info (original)',
            url: `https://mdc.csuc.cat/iiif/2/${collection}:${itemId}/info.json`
        },
        {
            name: 'Alternative IIIF Info',
            url: `https://mdc.csuc.cat/iiif/${collection}:${itemId}/info.json`
        },
        {
            name: 'Document page',
            url: `https://mdc.csuc.cat/digital/collection/${collection}/id/${itemId}/rec/1`
        },
        {
            name: 'API endpoint',
            url: `https://mdc.csuc.cat/api/singleitem/collection/${collection}/id/${itemId}/thumbnail`
        }
    ];
    
    for (const endpoint of testEndpoints) {
        console.log(`\\n🧪 Testing: ${endpoint.name}`);
        console.log(`   URL: ${endpoint.url}`);
        
        try {
            const response = await fetch(endpoint.url);
            
            console.log(`   Status: ${response.statusCode}`);
            console.log(`   Content-Type: ${response.headers['content-type']}`);
            console.log(`   Content-Length: ${response.headers['content-length']}`);
            console.log(`   Body Size: ${response.body.length} bytes`);
            
            if (response.body.length < 2000) {
                const preview = response.body.toString().substring(0, 300);
                console.log(`   Body Preview: ${preview}...`);
            }
            
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

if (require.main === module) {
    testMDCEndpoints().catch(console.error);
}