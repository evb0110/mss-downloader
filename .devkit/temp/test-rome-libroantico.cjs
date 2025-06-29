const https = require('https');

// Test the new libroantico URL pattern
const testUrl = 'http://digitale.bnc.roma.sbn.it/tecadigitale/libroantico/BVEE112879/BVEE112879/1';

console.log('Testing Rome BNC libroantico URL parsing...');
console.log(`Test URL: ${testUrl}`);

// Test the regex pattern
const urlMatch = testUrl.match(/\/(manoscrittoantico|libroantico)\/([^/]+)\/([^/]+)\/(\d+)/);
if (urlMatch) {
    const [fullMatch, collectionType, manuscriptId1, manuscriptId2, pageNum] = urlMatch;
    console.log('✅ URL parsing successful:');
    console.log(`  Collection type: ${collectionType}`);
    console.log(`  Manuscript ID 1: ${manuscriptId1}`);
    console.log(`  Manuscript ID 2: ${manuscriptId2}`);
    console.log(`  Page number: ${pageNum}`);
    console.log(`  IDs match: ${manuscriptId1 === manuscriptId2}`);
    
    // Test the expected image URL template
    const resolution = collectionType === 'libroantico' ? 'full' : 'original';
    const imageUrlTemplate = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/${collectionType}/${manuscriptId1}/${manuscriptId1}/PAGENUM/${resolution}`;
    console.log(`  Expected image URL template: ${imageUrlTemplate}`);
    
    // Test a specific page URL
    const testPageUrl = imageUrlTemplate.replace('PAGENUM', '1');
    console.log(`  Test page 1 URL: ${testPageUrl}`);
    
    // Check if the page exists
    console.log('\\nTesting page access...');
    const url = new URL(testUrl);
    const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    };
    
    const req = https.request(options, (res) => {
        console.log(`Page response status: ${res.statusCode}`);
        
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            // Check for page count
            const pageCountMatch = data.match(/Totale immagini:\s*(\d+)/);
            if (pageCountMatch) {
                console.log(`✅ Page count found: ${pageCountMatch[1]} pages`);
            } else {
                console.log('❌ Could not find page count');
            }
            
            // Check for title
            const titleMatch = data.match(/<title>([^<]+)<\/title>/);
            if (titleMatch) {
                console.log(`Title: ${titleMatch[1].trim()}`);
            }
        });
    });
    
    req.on('error', (err) => {
        console.log(`❌ Page request failed: ${err.message}`);
    });
    
    req.end();
    
} else {
    console.log('❌ URL parsing failed - regex did not match');
}