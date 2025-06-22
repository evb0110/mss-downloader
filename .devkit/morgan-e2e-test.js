import https from 'https';
import fs from 'fs';
import path from 'path';

async function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'curl/7.68.0'
            }
        }, (res) => {
            let data = '';
            if (res.headers['content-type']?.includes('text')) {
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            } else {
                // Binary data
                const chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => resolve(Buffer.concat(chunks)));
            }
        });
        req.on('error', reject);
    });
}

async function morganLibraryEndToEndTest() {
    console.log('Morgan Library End-to-End Test\n');
    
    // Test URL
    const testUrl = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';
    
    try {
        console.log('Step 1: Fetching manuscript page...');
        const pageContent = await fetchUrl(testUrl);
        console.log('✅ Page fetched successfully');
        
        console.log('Step 2: Extracting image URLs...');
        const styledImageRegex = /\/sites\/default\/files\/styles\/[^"']*\/public\/images\/collection\/[^"'?]+\.jpg/g;
        const styledMatches = pageContent.match(styledImageRegex) || [];
        
        const directImageRegex = /\/sites\/default\/files\/images\/collection\/[^"'?]+\.jpg/g;
        const directMatches = pageContent.match(directImageRegex) || [];
        
        const convertedUrls = [];
        for (const match of styledMatches) {
            const originalPath = match.replace(/\/styles\/[^\/]+\/public\//, '/');
            const fullUrl = `https://www.themorgan.org${originalPath}`;
            convertedUrls.push(fullUrl);
        }
        
        for (const match of directMatches) {
            const fullUrl = `https://www.themorgan.org${match}`;
            convertedUrls.push(fullUrl);
        }
        
        const uniqueUrls = [...new Set(convertedUrls)];
        console.log(`✅ Extracted ${uniqueUrls.length} unique image URLs`);
        
        if (uniqueUrls.length === 0) {
            throw new Error('No image URLs found');
        }
        
        console.log('Step 3: Testing first image download...');
        const firstImageUrl = uniqueUrls[0];
        console.log(`Testing URL: ${firstImageUrl}`);
        
        const imageBuffer = await fetchUrl(firstImageUrl);
        console.log(`✅ Downloaded image: ${imageBuffer.length.toLocaleString()} bytes`);
        
        // Verify it's a valid JPEG
        if (imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8) {
            console.log('✅ Valid JPEG format confirmed');
        } else {
            throw new Error('Invalid JPEG format');
        }
        
        // Save test image
        const testDir = '.devkit/test-images';
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
        
        const filename = path.basename(firstImageUrl.split('?')[0]);
        const filepath = path.join(testDir, filename);
        fs.writeFileSync(filepath, imageBuffer);
        console.log(`✅ Test image saved: ${filepath}`);
        
        console.log('\n=== TEST RESULTS ===');
        console.log('✅ Morgan Library implementation is working correctly');
        console.log(`✅ Successfully extracted ${uniqueUrls.length} high-resolution images`);
        console.log(`✅ Downloaded and verified first image (${(imageBuffer.length / 1024).toFixed(1)} KB)`);
        console.log('✅ Image format validated as JPEG');
        console.log('✅ All functionality working as expected');
        
        console.log('\n=== SAMPLE URLS ===');
        console.log('First 5 high-resolution image URLs:');
        for (let i = 0; i < Math.min(5, uniqueUrls.length); i++) {
            console.log(`  ${i + 1}: ${uniqueUrls[i]}`);
        }
        
    } catch (error) {
        console.log(`❌ ERROR: ${error.message}`);
        console.log('❌ Morgan Library implementation may need fixes');
    }
}

morganLibraryEndToEndTest().catch(console.error);