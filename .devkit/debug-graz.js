// Debug the Graz URL to see what's in the HTML
const testUrl = 'https://unipub.uni-graz.at/obvugrscript/content/pageview/8224540';

console.log('Fetching Graz URL to debug content...');

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
};

fetch(testUrl, { headers })
.then(response => {
    console.log(`Status: ${response.status} ${response.statusText}`);
    return response.text();
})
.then(html => {
    console.log('HTML length:', html.length);
    
    // Look for titleinfo patterns
    console.log('\n=== Looking for titleinfo patterns ===');
    const titleinfoMatches = html.match(/titleinfo[\/\?]?\d+/gi);
    if (titleinfoMatches) {
        console.log('Found titleinfo patterns:', titleinfoMatches);
    } else {
        console.log('No titleinfo patterns found');
    }
    
    // Look for any 8-digit numbers (manuscript IDs)
    console.log('\n=== Looking for 8-digit numbers ===');
    const digitMatches = html.match(/\d{7,8}/g);
    if (digitMatches) {
        console.log('Found 7-8 digit numbers:', [...new Set(digitMatches)].slice(0, 10));
    }
    
    // Look for IIIF or manifest references
    console.log('\n=== Looking for IIIF/manifest patterns ===');
    const iiifMatches = html.match(/i3f|iiif|manifest/gi);
    if (iiifMatches) {
        console.log('Found IIIF patterns:', [...new Set(iiifMatches)]);
    }
    
    // Look for typical manuscript metadata
    console.log('\n=== Looking for manuscript info ===');
    const lines = html.split('\n');
    const relevantLines = lines.filter(line => 
        line.includes('titleinfo') ||
        line.includes('8224538') ||
        line.includes('8224540') ||
        line.includes('manifest') ||
        line.includes('i3f')
    );
    
    if (relevantLines.length > 0) {
        console.log('Relevant lines:', relevantLines.slice(0, 5));
    } else {
        console.log('No obviously relevant lines found');
    }
    
    // Try the known working titleinfo ID directly
    console.log('\n=== Testing known titleinfo ID 8224538 ===');
    const manifestUrl = 'https://unipub.uni-graz.at/i3f/v20/8224538/manifest';
    
    return fetch(manifestUrl, { 
        headers: {
            'Accept': 'application/json, application/ld+json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
})
.then(manifestResponse => {
    console.log(`✅ MANIFEST TEST: HTTP ${manifestResponse.status} ${manifestResponse.statusText}`);
    console.log(`Manifest size: ${manifestResponse.headers.get('content-length')} bytes`);
    
    if (manifestResponse.ok) {
        return manifestResponse.json();
    } else {
        throw new Error(`Manifest fetch failed: ${manifestResponse.status}`);
    }
})
.then(manifest => {
    console.log(`✅ SUCCESS: Manifest has ${manifest.sequences?.[0]?.canvases?.length || 0} pages`);
    console.log(`Title: ${JSON.stringify(manifest.label)}`);
    console.log('\n🎉 The IIIF manifest works! The issue was likely a timeout in the application.');
})
.catch(error => {
    console.error('❌ ERROR:', error.message);
});