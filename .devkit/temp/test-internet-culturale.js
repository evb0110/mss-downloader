// Test script to extract Internet Culturale manifest and test individual image downloads
import https from 'https';
import fs from 'fs';
import path from 'path';

const TEST_URL = 'https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Ateca.bmlonline.it%3A21%3AXXXX%3APlutei%3AIT%253AFI0100_Plutei_21.29&mode=all&teca=Laurenziana+-+FI';

async function fetchData(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ ok: res.statusCode === 200, text: () => data, status: res.statusCode }));
        });
        req.on('error', reject);
        req.end();
    });
}

async function downloadImage(url, filename) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filename);
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'image/*,*/*;q=0.8',
                'Referer': 'https://www.internetculturale.it/',
            }
        }, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: ${response.statusText}`));
                return;
            }
            
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                // Get file stats
                const stats = fs.statSync(filename);
                resolve({
                    filename,
                    size: stats.size,
                    contentType: response.headers['content-type']
                });
            });
        }).on('error', (err) => {
            fs.unlink(filename, () => {}); // Delete incomplete file
            reject(err);
        });
    });
}

async function testInternetCulturale() {
    try {
        console.log('Testing Internet Culturale URL:', TEST_URL);
        
        // Step 1: Extract OAI ID and teca parameter
        const oaiMatch = TEST_URL.match(/id=([^&]+)/);
        if (!oaiMatch) {
            throw new Error('No OAI ID found');
        }
        
        const oaiId = decodeURIComponent(oaiMatch[1]);
        console.log('OAI ID:', oaiId);
        
        const tecaMatch = TEST_URL.match(/teca=([^&]+)/);
        const teca = tecaMatch ? decodeURIComponent(tecaMatch[1]) : 'Unknown';
        console.log('Teca:', teca);
        
        // Step 2: Construct API URL
        const apiUrl = `https://www.internetculturale.it/jmms/magparser?id=${encodeURIComponent(oaiId)}&teca=${encodeURIComponent(teca)}&mode=all&fulltext=0`;
        console.log('API URL:', apiUrl);
        
        // Step 3: Fetch manifest
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/xml, application/xml, */*; q=0.01',
            'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
            'Referer': TEST_URL,
            'X-Requested-With': 'XMLHttpRequest',
        };
        
        console.log('Fetching manifest...');
        const response = await fetchData(apiUrl, { headers });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const xmlText = await response.text();
        console.log('XML Response length:', xmlText.length);
        
        // Save raw XML for inspection
        fs.writeFileSync('/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/temp/manifest.xml', xmlText);
        console.log('Manifest saved to .devkit/temp/manifest.xml');
        
        // Step 4: Extract page URLs
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
        
        console.log(`Found ${pageLinks.length} page URLs`);
        
        // Step 5: Test first 10 image downloads
        const testUrls = pageLinks.slice(0, Math.min(10, pageLinks.length));
        console.log('Testing first 10 images...');
        
        for (let i = 0; i < testUrls.length; i++) {
            const url = testUrls[i];
            const filename = `/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/temp/test_image_${i + 1}.jpg`;
            
            try {
                console.log(`Downloading image ${i + 1}: ${url}`);
                const result = await downloadImage(url, filename);
                console.log(`  - Success: ${result.size} bytes, Content-Type: ${result.contentType}`);
                
                // Check if it's actually an image or HTML error page
                const buffer = fs.readFileSync(filename);
                const isHTML = buffer.toString('utf8', 0, 100).includes('<!DOCTYPE html') || buffer.toString('utf8', 0, 100).includes('<html');
                
                if (isHTML) {
                    console.log(`  - WARNING: Image ${i + 1} appears to be HTML content!`);
                    console.log(`  - First 200 chars:`, buffer.toString('utf8', 0, 200));
                } else {
                    // Check if it's a valid image (JPEG/PNG/GIF)
                    const header = buffer.toString('hex', 0, 8);
                    if (header.startsWith('ffd8ff')) {
                        console.log(`  - Valid JPEG image`);
                    } else if (header.startsWith('89504e47')) {
                        console.log(`  - Valid PNG image`);
                    } else if (header.startsWith('47494638')) {
                        console.log(`  - Valid GIF image`);
                    } else {
                        console.log(`  - Unknown format, header: ${header}`);
                    }
                }
                
            } catch (error) {
                console.log(`  - Failed: ${error.message}`);
            }
        }
        
        // Step 6: Generate summary
        console.log('\n=== SUMMARY ===');
        console.log(`Total pages found: ${pageLinks.length}`);
        console.log(`Test URLs (first 10):`);
        testUrls.forEach((url, i) => console.log(`  ${i + 1}: ${url}`));
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run the test
testInternetCulturale();