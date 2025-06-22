import https from 'https';
import { URL } from 'url';

// Test the Graz URL that was failing
const testUrl = 'https://unipub.uni-graz.at/obvugrscript/content/pageview/8224540';

console.log('Testing Graz URL fetch with extended timeout...');
console.log(`URL: ${testUrl}`);

const controller = new AbortController();
const timeout = setTimeout(() => {
    controller.abort();
    console.error('❌ TIMEOUT: Request took longer than 30 seconds');
}, 30000); // 30 second timeout

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
};

fetch(testUrl, { 
    signal: controller.signal,
    headers: headers
})
.then(response => {
    clearTimeout(timeout);
    console.log(`✅ SUCCESS: HTTP ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);
    console.log(`Content-Length: ${response.headers.get('content-length')}`);
    
    // Test extracting titleinfo ID from the page
    return response.text();
})
.then(html => {
    const titleinfoMatch = html.match(/titleinfo\/(\d+)/);
    if (titleinfoMatch) {
        const manuscriptId = titleinfoMatch[1];
        console.log(`✅ EXTRACTED titleinfo ID: ${manuscriptId}`);
        
        // Test the IIIF manifest URL
        const manifestUrl = `https://unipub.uni-graz.at/i3f/v20/${manuscriptId}/manifest`;
        console.log(`Testing IIIF manifest: ${manifestUrl}`);
        
        return fetch(manifestUrl, { 
            headers: {
                'Accept': 'application/json, application/ld+json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
    } else {
        throw new Error('Could not find titleinfo ID in page HTML'); 
    }
})
.then(manifestResponse => {
    console.log(`✅ MANIFEST SUCCESS: HTTP ${manifestResponse.status} ${manifestResponse.statusText}`);
    console.log(`Manifest Content-Type: ${manifestResponse.headers.get('content-type')}`);
    console.log(`Manifest Content-Length: ${manifestResponse.headers.get('content-length')}`);
    
    return manifestResponse.json();
})
.then(manifest => {
    console.log(`✅ MANIFEST PARSED: Found ${manifest.sequences?.[0]?.canvases?.length || 0} pages`);
    console.log(`Manifest label: ${JSON.stringify(manifest.label)}`);
    console.log('🎉 ALL TESTS PASSED - Graz library should work correctly now!');
})
.catch(error => {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
        console.error('❌ FETCH ABORTED: Request was cancelled due to timeout');
    } else {
        console.error('❌ FETCH FAILED:', error.message);
    }
    console.error('This indicates the original timeout issue persists');
});