// Enhanced test to analyze image content and detect duplication

async function testInternetCulturaleDetailed() {
    const url = 'https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Ateca.bmlonline.it%3A21%3AXXXX%3APlutei%3AIT%253AFI0100_Plutei_21.29&mode=all&teca=Laurenziana+-+FI';

    // Extract OAI identifier
    const oaiMatch = url.match(/id=([^&]+)/);
    const oaiId = decodeURIComponent(oaiMatch[1]);
    const tecaMatch = url.match(/teca=([^&]+)/);
    const teca = tecaMatch ? decodeURIComponent(tecaMatch[1]) : 'Unknown';
    const apiUrl = `https://www.internetculturale.it/jmms/magparser?id=${encodeURIComponent(oaiId)}&teca=${encodeURIComponent(teca)}&mode=all&fulltext=0`;

    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/xml, application/xml, */*; q=0.01',
            'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
            'Referer': url,
            'X-Requested-With': 'XMLHttpRequest',
        };

        const response = await fetch(apiUrl, { headers });
        const xmlText = await response.text();

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

        console.log(`Found ${pageLinks.length} pages`);
        
        // Test more images with binary comparison
        console.log('\n--- Testing first 10 images with content analysis ---');
        const imageBinaryHashes = new Map();
        
        for (let i = 0; i < Math.min(10, pageLinks.length); i++) {
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
                
                if (imageResponse.ok) {
                    const buffer = await imageResponse.arrayBuffer();
                    const bytes = new Uint8Array(buffer);
                    
                    // Create a simple hash by summing first 100 bytes
                    let simpleHash = 0;
                    for (let j = 0; j < Math.min(100, bytes.length); j++) {
                        simpleHash += bytes[j] * (j + 1);
                    }
                    
                    console.log(`  Size: ${buffer.byteLength} bytes, Hash: ${simpleHash}`);
                    
                    // Check for duplicates
                    if (imageBinaryHashes.has(simpleHash)) {
                        console.log(`  🚨 DUPLICATE DETECTED! Same as image ${imageBinaryHashes.get(simpleHash)}`);
                    } else {
                        imageBinaryHashes.set(simpleHash, i + 1);
                    }
                    
                    // Look for error page indicators in the binary data
                    const textSample = new TextDecoder('utf-8', { fatal: false }).decode(buffer.slice(0, 1000));
                    if (textSample.toLowerCase().includes('error') || 
                        textSample.toLowerCase().includes('not found') ||
                        textSample.toLowerCase().includes('403') || 
                        textSample.toLowerCase().includes('404')) {
                        console.log(`  🚨 ERROR PAGE DETECTED in binary content`);
                        console.log(`  Content sample: ${textSample.substring(0, 200)}`);
                    }
                    
                } else {
                    console.log(`  Status: ${imageResponse.status} ${imageResponse.statusText}`);
                    const errorBody = await imageResponse.text();
                    console.log(`  Error: ${errorBody.substring(0, 200)}`);
                }
                
            } catch (error) {
                console.log(`  Error: ${error.message}`);
            }
            
            // Delay to avoid overwhelming server
            await new Promise(resolve => setTimeout(resolve, 800));
        }

        // Test some random middle and end images
        console.log('\n--- Testing random images from middle and end ---');
        const testIndices = [
            Math.floor(pageLinks.length * 0.25), // 25%
            Math.floor(pageLinks.length * 0.5),  // 50%
            Math.floor(pageLinks.length * 0.75), // 75%
            pageLinks.length - 1                 // Last
        ];

        for (const index of testIndices) {
            if (index < pageLinks.length) {
                const imageUrl = pageLinks[index];
                console.log(`\nTesting image ${index + 1}/${pageLinks.length}: ${imageUrl}`);
                
                try {
                    const imageHeaders = {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Referer': 'https://www.internetculturale.it/',
                        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
                    };

                    const imageResponse = await fetch(imageUrl, { headers: imageHeaders });
                    
                    if (imageResponse.ok) {
                        const buffer = await imageResponse.arrayBuffer();
                        const bytes = new Uint8Array(buffer);
                        
                        let simpleHash = 0;
                        for (let j = 0; j < Math.min(100, bytes.length); j++) {
                            simpleHash += bytes[j] * (j + 1);
                        }
                        
                        console.log(`  Size: ${buffer.byteLength} bytes, Hash: ${simpleHash}`);
                        
                        if (imageBinaryHashes.has(simpleHash)) {
                            console.log(`  🚨 DUPLICATE DETECTED! Same as earlier image`);
                        }
                        
                    } else {
                        console.log(`  Status: ${imageResponse.status} ${imageResponse.statusText}`);
                    }
                } catch (error) {
                    console.log(`  Error: ${error.message}`);
                }
                
                await new Promise(resolve => setTimeout(resolve, 800));
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testInternetCulturaleDetailed();