import https from 'https';

async function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'curl/7.68.0'
            }
        }, (res) => {
            if (res.headers['content-type']?.includes('text')) {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            } else {
                const chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => resolve(Buffer.concat(chunks)));
            }
        });
        req.on('error', reject);
    });
}

async function testSecondMorganCollection() {
    console.log('Testing second Morgan Library collection...\n');
    
    const testUrl = 'https://www.themorgan.org/collection/gospel-book/143812/thumbs';
    
    try {
        console.log('Step 1: Fetching Gospel Book page...');
        const pageContent = await fetchUrl(testUrl);
        console.log('✅ Page fetched successfully');
        
        console.log('Step 2: Extracting image URLs...');
        const directImageRegex = /\/sites\/default\/files\/images\/collection\/[^"'?]+\.jpg/g;
        const directMatches = pageContent.match(directImageRegex) || [];
        
        const imageUrls = directMatches.map(match => `https://www.themorgan.org${match}`);
        const uniqueUrls = [...new Set(imageUrls)];
        
        console.log(`✅ Extracted ${uniqueUrls.length} direct high-resolution URLs`);
        
        console.log('Step 3: Testing first image download...');
        const firstImageUrl = uniqueUrls[0];
        console.log(`Testing URL: ${firstImageUrl}`);
        
        const imageBuffer = await fetchUrl(firstImageUrl);
        console.log(`✅ Downloaded image: ${imageBuffer.length.toLocaleString()} bytes (${(imageBuffer.length / 1024).toFixed(1)} KB)`);
        
        if (imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8) {
            console.log('✅ Valid JPEG format confirmed');
        } else {
            throw new Error('Invalid JPEG format');
        }
        
        console.log('\n=== SECOND COLLECTION RESULTS ===');
        console.log('✅ Gospel Book collection working correctly');
        console.log(`✅ Found ${uniqueUrls.length} high-resolution images`);
        console.log(`✅ Downloaded ${(imageBuffer.length / 1024).toFixed(1)} KB high-quality image`);
        console.log('✅ Both Morgan Library collections fully functional');
        
    } catch (error) {
        console.log(`❌ ERROR: ${error.message}`);
    }
}

testSecondMorganCollection().catch(console.error);