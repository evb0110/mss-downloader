// Use built-in fetch (Node.js 18+)

async function testInternetCulturale() {
    const url = 'https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Ateca.bmlonline.it%3A21%3AXXXX%3APlutei%3AIT%253AFI0100_Plutei_21.29&mode=all&teca=Laurenziana+-+FI';

    // Extract OAI identifier
    const oaiMatch = url.match(/id=([^&]+)/);
    if (!oaiMatch) {
        console.error('No OAI ID found');
        return;
    }

    const oaiId = decodeURIComponent(oaiMatch[1]);
    console.log('OAI ID:', oaiId);

    // Extract teca parameter
    const tecaMatch = url.match(/teca=([^&]+)/);
    const teca = tecaMatch ? decodeURIComponent(tecaMatch[1]) : 'Unknown';
    console.log('Teca:', teca);

    // Construct API URL
    const apiUrl = `https://www.internetculturale.it/jmms/magparser?id=${encodeURIComponent(oaiId)}&teca=${encodeURIComponent(teca)}&mode=all&fulltext=0`;
    console.log('API URL:', apiUrl);

    try {
        // Fetch manifest
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/xml, application/xml, */*; q=0.01',
            'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
            'Referer': url,
            'X-Requested-With': 'XMLHttpRequest',
        };

        console.log('\n--- Fetching manifest ---');
        const response = await fetch(apiUrl, { headers });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const xmlText = await response.text();
        console.log('XML Response length:', xmlText.length);
        console.log('XML starts with:', xmlText.substring(0, 200));

        // Extract page URLs
        const pageLinks = [];
        const pageRegex = /<page[^>]+src="([^"]+)"[^>]*>/g;
        let match;

        while ((match = pageRegex.exec(xmlText)) !== null) {
            let relativePath = match[1];
            
            // Fix Florence URL issue
            if (relativePath.includes('cacheman/normal/')) {
                relativePath = relativePath.replace('cacheman/normal/', 'cacheman/web/');
            }
            
            const imageUrl = `https://www.internetculturale.it/jmms/${relativePath}`;
            pageLinks.push(imageUrl);
        }

        console.log(`\n--- Found ${pageLinks.length} pages ---`);
        
        // Test first 5 images
        console.log('\n--- Testing first 5 images ---');
        for (let i = 0; i < Math.min(5, pageLinks.length); i++) {
            const imageUrl = pageLinks[i];
            console.log(`\nTesting image ${i + 1}: ${imageUrl}`);
            
            try {
                const imageHeaders = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://www.internetculturale.it/',
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                    'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                };

                const imageResponse = await fetch(imageUrl, { headers: imageHeaders });
                console.log(`  Status: ${imageResponse.status} ${imageResponse.statusText}`);
                console.log(`  Content-Type: ${imageResponse.headers.get('content-type')}`);
                console.log(`  Content-Length: ${imageResponse.headers.get('content-length') || 'unknown'}`);
                
                if (imageResponse.ok) {
                    const buffer = await imageResponse.arrayBuffer();
                    console.log(`  Actual size: ${buffer.byteLength} bytes`);
                    
                    // Check if it's a valid JPEG
                    const firstBytes = new Uint8Array(buffer, 0, 10);
                    const isJPEG = firstBytes[0] === 0xFF && firstBytes[1] === 0xD8;
                    console.log(`  Valid JPEG: ${isJPEG}`);
                    
                    if (!isJPEG) {
                        // Look for HTML content indicating error page
                        const textContent = new TextDecoder('utf-8').decode(buffer.slice(0, 500));
                        console.log(`  Content preview: ${textContent.substring(0, 200)}`);
                    }
                } else {
                    console.log(`  Error response body: ${await imageResponse.text()}`);
                }
                
            } catch (error) {
                console.log(`  Error: ${error.message}`);
            }
            
            // Small delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 500));
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Helper function for delay
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

testInternetCulturale();