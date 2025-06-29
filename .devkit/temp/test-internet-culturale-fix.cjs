const https = require('https');
const fs = require('fs').promises;
const path = require('path');

// Test URLs from a real Internet Culturale manuscript
const testUrls = [
    'https://www.internetculturale.it/jmms/cacheman/web/Laurenziana_-_FI/Biblioteca_Medicea_Laurenziana_-_Firenze_-_IT-FI0100/oai.teca.bmlonline.it.21.XXXX.Plutei.IT_3AFI0100_Plutei_21.29/1.jpg',
    'https://www.internetculturale.it/jmms/cacheman/web/Laurenziana_-_FI/Biblioteca_Medicea_Laurenziana_-_Firenze_-_IT-FI0100/oai.teca.bmlonline.it.21.XXXX.Plutei.IT_3AFI0100_Plutei_21.29/2.jpg',
    'https://www.internetculturale.it/jmms/cacheman/web/Laurenziana_-_FI/Biblioteca_Medicea_Laurenziana_-_Firenze_-_IT-FI0100/oai.teca.bmlonline.it.21.XXXX.Plutei.IT_3AFI0100_Plutei_21.29/3.jpg',
    'https://www.internetculturale.it/jmms/cacheman/web/Laurenziana_-_FI/Biblioteca_Medicea_Laurenziana_-_Firenze_-_IT-FI0100/oai.teca.bmlonline.it.21.XXXX.Plutei.IT_3AFI0100_Plutei_21.29/4.jpg',
    'https://www.internetculturale.it/jmms/cacheman/web/Laurenziana_-_FI/Biblioteca_Medicea_Laurenziana_-_Firenze_-_IT-FI0100/oai.teca.bmlonline.it.21.XXXX.Plutei.IT_3AFI0100_Plutei_21.29/5.jpg'
];

// Error page characteristics
const PREVIEW_ERROR_SIZE = 27287;
const PREVIEW_ERROR_TOLERANCE = 100;

async function validateImage(buffer, url, index) {
    const size = buffer.length;
    
    // Check if this is the "Preview non disponibile" error page
    const isErrorPage = Math.abs(size - PREVIEW_ERROR_SIZE) < PREVIEW_ERROR_TOLERANCE;
    
    // Check if it's large enough to be a real manuscript image
    const isRealImage = size > 40000;
    
    console.log(`Image ${index}:`);
    console.log(`  URL: ${url}`);
    console.log(`  Size: ${size} bytes`);
    console.log(`  Is error page: ${isErrorPage}`);
    console.log(`  Is real image: ${isRealImage}`);
    
    if (isErrorPage) {
        throw new Error(`❌ Image ${index} is "Preview non disponibile" error page (${size} bytes)`);
    }
    
    if (!isRealImage) {
        console.warn(`⚠️  Image ${index} is unusually small (${size} bytes) - may not be a full manuscript page`);
    } else {
        console.log(`✅ Image ${index} appears to be a valid manuscript page`);
    }
    
    return { size, isValid: !isErrorPage && isRealImage };
}

async function downloadAndTest(url, index) {
    return new Promise((resolve, reject) => {
        // Use proper headers like the fixed implementation
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://www.internetculturale.it/',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        };
        
        https.get(url, options, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                return;
            }
            
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            
            response.on('end', async () => {
                try {
                    const buffer = Buffer.concat(chunks);
                    const result = await validateImage(buffer, url, index);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', reject);
    });
}

async function main() {
    console.log('🧪 Testing Internet Culturale fix with direct downloads...\n');
    
    let successCount = 0;
    let totalCount = testUrls.length;
    
    for (let i = 0; i < testUrls.length; i++) {
        try {
            const result = await downloadAndTest(testUrls[i], i + 1);
            if (result.isValid) {
                successCount++;
            }
            console.log('');
        } catch (error) {
            console.error(`❌ Test ${i + 1} failed: ${error.message}\n`);
        }
        
        // Add a small delay between requests to be respectful
        if (i < testUrls.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    console.log(`\n📊 Test Results:`);
    console.log(`✅ Valid images: ${successCount}/${totalCount}`);
    console.log(`❌ Failed/invalid images: ${totalCount - successCount}/${totalCount}`);
    
    if (successCount === totalCount) {
        console.log(`\n🎉 All tests passed! Internet Culturale fix is working correctly.`);
    } else {
        console.log(`\n⚠️  Some tests failed. The fix may need additional work.`);
    }
}

main().catch(console.error);