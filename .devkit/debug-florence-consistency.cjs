const fs = require('fs');
const { SharedManifestLoaders } = require('../src/shared/SharedManifestLoaders.js');

// Test both fetch functions - the working one and the one used in final validation
const workingFetchFn = (url, options = {}) => {
    const https = require('https');
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const requestOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                ...options.headers
            },
            timeout: 30000
        };

        https.get(requestOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    text: async () => data,
                    json: async () => JSON.parse(data)
                });
            });
        }).on('error', reject);
    });
};

const finalValidationFetchFn = (url, options = {}) => {
    const https = require('https');
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const requestOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',  // This is the difference!
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                ...options.headers
            },
            timeout: 60000
        };

        https.get(requestOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    text: async () => data,
                    json: async () => JSON.parse(data)
                });
            });
        }).on('error', reject);
    });
};

async function debugFlorenceConsistency() {
    console.log('=== Florence Consistency Debug ===\n');
    
    const url = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/';
    
    console.log('Testing with WORKING fetch function:');
    const workingLoader = new SharedManifestLoaders(workingFetchFn);
    try {
        const workingResult = await workingLoader.getFlorenceManifest(url);
        console.log(`✅ Working fetch: ${workingResult.images.length} pages`);
    } catch (error) {
        console.log(`❌ Working fetch failed: ${error.message}`);
    }
    
    console.log('\nTesting with FINAL VALIDATION fetch function:');
    const finalLoader = new SharedManifestLoaders(finalValidationFetchFn);
    try {
        const finalResult = await finalLoader.getFlorenceManifest(url);
        console.log(`✅ Final validation fetch: ${finalResult.images.length} pages`);
    } catch (error) {
        console.log(`❌ Final validation fetch failed: ${error.message}`);
    }
    
    console.log('\nTesting HTML content differences:');
    try {
        const workingResponse = await workingFetchFn(url);
        const workingHtml = await workingResponse.text();
        
        const finalResponse = await finalValidationFetchFn(url);
        const finalHtml = await finalResponse.text();
        
        console.log(`Working HTML length: ${workingHtml.length}`);
        console.log(`Final HTML length: ${finalHtml.length}`);
        console.log(`Working contains __INITIAL_STATE__: ${workingHtml.includes('__INITIAL_STATE__')}`);
        console.log(`Final contains __INITIAL_STATE__: ${finalHtml.includes('__INITIAL_STATE__')}`);
        
        if (workingHtml.length !== finalHtml.length) {
            console.log('\n⚠️  HTML CONTENT DIFFERS! This is the root cause.');
            console.log('The Accept-Encoding header is causing different server responses.');
        }
        
    } catch (error) {
        console.log(`Error comparing HTML: ${error.message}`);
    }
}

debugFlorenceConsistency().catch(console.error);