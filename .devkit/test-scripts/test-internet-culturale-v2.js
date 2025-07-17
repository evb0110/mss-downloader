const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { PDFDocument } = require('pdf-lib');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Test URLs
const TEST_URLS = [
    'https://dam.iccu.sbn.it/mol_46/containers/avQYk0e/manifest', // Direct DAM manifest
    'https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Abncf.firenze.sbn.it%3A21%3AFI0098%3AManoscrittiInRete%3AB.R.231&mode=all&teca=Bncf' // Internet Culturale URL
];

const OUTPUT_DIR = path.join(__dirname, '..', 'test-outputs', 'internet-culturale-v2');

async function downloadImage(url, outputPath) {
    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
            'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
            'Referer': 'https://www.internetculturale.it/',
        };
        
        const response = await axios.get(url, { 
            responseType: 'arraybuffer',
            headers,
            timeout: 30000,
            maxRedirects: 5
        });
        
        fs.writeFileSync(outputPath, response.data);
        return true;
    } catch (error) {
        console.error(`Failed to download ${url}:`, error.message);
        return false;
    }
}

async function createPDF(images, outputPath) {
    const pdfDoc = await PDFDocument.create();
    
    for (const imagePath of images) {
        const imageBytes = fs.readFileSync(imagePath);
        let image;
        
        if (imagePath.endsWith('.jpg') || imagePath.endsWith('.jpeg')) {
            image = await pdfDoc.embedJpg(imageBytes);
        } else if (imagePath.endsWith('.png')) {
            image = await pdfDoc.embedPng(imageBytes);
        } else {
            continue;
        }
        
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, {
            x: 0,
            y: 0,
            width: image.width,
            height: image.height,
        });
    }
    
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);
}

async function testDAMManifest(manifestUrl) {
    console.log('\n=== Testing DAM Manifest ===');
    console.log('URL:', manifestUrl);
    
    try {
        const response = await axios.get(manifestUrl);
        const manifest = response.data;
        
        console.log('Manifest type:', manifest.type);
        
        const imageUrls = [];
        const items = manifest.items || [];
        
        console.log(`Total items (pages): ${items.length}`);
        
        for (let i = 0; i < items.length; i++) {
            const canvas = items[i];
            const annotationPages = canvas.items || [];
            
            for (const page of annotationPages) {
                const annotations = page.items || [];
                
                for (const annotation of annotations) {
                    if (annotation.body) {
                        let imageUrl = annotation.body.id;
                        
                        // Try to get highest resolution
                        const service = annotation.body.service?.[0];
                        if (service && service.id) {
                            // Test different IIIF parameters for highest quality
                            const resolutions = [
                                '/full/full/0/default.jpg',
                                '/full/max/0/default.jpg',
                                '/full/4000,/0/default.jpg',
                                '/full/2000,/0/default.jpg'
                            ];
                            
                            for (const res of resolutions) {
                                const testUrl = service.id + res;
                                console.log(`Testing resolution: ${testUrl}`);
                                try {
                                    const headResponse = await axios.head(testUrl, { timeout: 5000 });
                                    if (headResponse.status === 200) {
                                        imageUrl = testUrl;
                                        console.log(`✓ Using resolution: ${res}`);
                                        break;
                                    }
                                } catch (e) {
                                    // Try next resolution
                                }
                            }
                        }
                        
                        imageUrls.push({
                            url: imageUrl,
                            pageNum: i + 1
                        });
                    }
                }
            }
        }
        
        console.log(`Found ${imageUrls.length} images`);
        
        // Download sample pages
        const downloadedImages = [];
        const samplesToDownload = Math.min(10, imageUrls.length);
        
        console.log(`\nDownloading ${samplesToDownload} sample pages...`);
        
        for (let i = 0; i < samplesToDownload; i++) {
            const { url, pageNum } = imageUrls[i];
            const imagePath = path.join(OUTPUT_DIR, `dam_page_${pageNum.toString().padStart(3, '0')}.jpg`);
            console.log(`Downloading page ${pageNum}...`);
            
            if (await downloadImage(url, imagePath)) {
                downloadedImages.push(imagePath);
                
                // Check file size
                const stats = fs.statSync(imagePath);
                console.log(`✓ Page ${pageNum}: ${(stats.size / 1024).toFixed(1)} KB`);
            }
        }
        
        console.log(`\nSuccessfully downloaded ${downloadedImages.length} images`);
        
        // Create PDF
        if (downloadedImages.length > 0) {
            const pdfPath = path.join(OUTPUT_DIR, 'dam_test.pdf');
            await createPDF(downloadedImages, pdfPath);
            console.log('\nPDF created:', pdfPath);
            
            // Verify PDF
            try {
                const { stdout } = await execPromise(`pdfinfo "${pdfPath}"`);
                console.log('\nPDF verified successfully');
            } catch (error) {
                console.error('PDF verification failed:', error.message);
            }
        }
        
        return imageUrls.length;
        
    } catch (error) {
        console.error('DAM test failed:', error.message);
        return 0;
    }
}

async function testInternetCulturale(url) {
    console.log('\n=== Testing Internet Culturale ===');
    console.log('URL:', url);
    
    try {
        // Extract OAI ID
        const oaiMatch = url.match(/id=([^&]+)/);
        if (!oaiMatch) {
            throw new Error('Invalid Internet Culturale URL');
        }
        
        const oaiId = decodeURIComponent(oaiMatch[1]);
        const tecaMatch = url.match(/teca=([^&]+)/);
        const teca = tecaMatch ? decodeURIComponent(tecaMatch[1]) : 'Unknown';
        
        console.log('OAI ID:', oaiId);
        console.log('Teca:', teca);
        
        // Establish session
        console.log('\nEstablishing session...');
        const sessionHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
        };
        
        await axios.get(url, { headers: sessionHeaders });
        
        // Fetch XML manifest
        const apiUrl = `https://www.internetculturale.it/jmms/magparser?id=${encodeURIComponent(oaiId)}&teca=${encodeURIComponent(teca)}&mode=all&fulltext=0`;
        console.log('\nFetching XML manifest...');
        
        const headers = {
            ...sessionHeaders,
            'Accept': 'text/xml, application/xml, */*; q=0.01',
            'Referer': url,
            'X-Requested-With': 'XMLHttpRequest',
        };
        
        const response = await axios.get(apiUrl, { headers });
        const xmlText = response.data;
        
        console.log(`XML response length: ${xmlText.length} characters`);
        
        // Parse XML for page URLs
        const pageRegexPatterns = [
            /<page[^>]+src="([^"]+)"[^>]*>/g,
            /<page[^>]*>([^<]+)<\/page>/g,
            /src="([^"]*cacheman[^"]*\.jpg)"/g,
            /url="([^"]*cacheman[^"]*\.jpg)"/g,
            /"([^"]*cacheman[^"]*\.jpg)"/g
        ];
        
        const pageLinks = [];
        let foundPages = false;
        
        for (const regex of pageRegexPatterns) {
            let match;
            const tempLinks = [];
            
            while ((match = regex.exec(xmlText)) !== null) {
                let relativePath = match[1];
                
                if (!relativePath.includes('.jpg') && !relativePath.includes('.jpeg')) {
                    continue;
                }
                
                // Optimize for highest quality
                if (relativePath.includes('cacheman/web/')) {
                    relativePath = relativePath.replace('cacheman/web/', 'cacheman/normal/');
                }
                
                const imageUrl = relativePath.startsWith('http') 
                    ? relativePath 
                    : `https://www.internetculturale.it/jmms/${relativePath}`;
                
                tempLinks.push(imageUrl);
            }
            
            if (tempLinks.length > 0) {
                pageLinks.push(...tempLinks);
                foundPages = true;
                console.log(`Found ${tempLinks.length} pages using pattern: ${regex.source}`);
                break;
            }
        }
        
        if (!foundPages) {
            console.error('No pages found in XML');
            console.log('XML preview:', xmlText.substring(0, 500));
            return 0;
        }
        
        // Check for duplicates
        const uniqueUrls = new Set();
        const uniquePageLinks = [];
        
        pageLinks.forEach((url, index) => {
            if (!uniqueUrls.has(url)) {
                uniqueUrls.add(url);
                uniquePageLinks.push(url);
            } else {
                console.warn(`Duplicate URL at page ${index + 1}: ${url}`);
            }
        });
        
        console.log(`\nTotal pages found: ${pageLinks.length}`);
        console.log(`Unique pages: ${uniquePageLinks.length}`);
        
        // If we have duplicates, log the pattern
        if (uniquePageLinks.length < pageLinks.length) {
            console.log('\nAnalyzing URL pattern...');
            const firstUrl = uniquePageLinks[0];
            console.log('First URL:', firstUrl);
            
            // Check if URLs follow a pattern
            if (uniquePageLinks.length === 1) {
                console.warn('⚠️  Only 1 unique URL found - this might be a parsing issue!');
            }
        }
        
        // Download sample pages
        const downloadedImages = [];
        const samplesToDownload = Math.min(10, uniquePageLinks.length);
        
        console.log(`\nDownloading ${samplesToDownload} sample pages...`);
        
        for (let i = 0; i < samplesToDownload; i++) {
            const url = uniquePageLinks[i];
            const imagePath = path.join(OUTPUT_DIR, `ic_page_${(i + 1).toString().padStart(3, '0')}.jpg`);
            console.log(`Downloading page ${i + 1}...`);
            
            if (await downloadImage(url, imagePath)) {
                downloadedImages.push(imagePath);
                
                // Check file size
                const stats = fs.statSync(imagePath);
                console.log(`✓ Page ${i + 1}: ${(stats.size / 1024).toFixed(1)} KB`);
            }
        }
        
        console.log(`\nSuccessfully downloaded ${downloadedImages.length} images`);
        
        // Create PDF
        if (downloadedImages.length > 0) {
            const pdfPath = path.join(OUTPUT_DIR, 'ic_test.pdf');
            await createPDF(downloadedImages, pdfPath);
            console.log('\nPDF created:', pdfPath);
            
            // Verify PDF
            try {
                const { stdout } = await execPromise(`pdfinfo "${pdfPath}"`);
                console.log('\nPDF verified successfully');
            } catch (error) {
                console.error('PDF verification failed:', error.message);
            }
        }
        
        return uniquePageLinks.length;
        
    } catch (error) {
        console.error('Internet Culturale test failed:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
        }
        return 0;
    }
}

async function runTests() {
    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    // Clean previous test files
    const files = fs.readdirSync(OUTPUT_DIR);
    for (const file of files) {
        fs.unlinkSync(path.join(OUTPUT_DIR, file));
    }
    
    // Test each URL
    for (const url of TEST_URLS) {
        if (url.includes('dam.iccu.sbn.it')) {
            const pageCount = await testDAMManifest(url);
            console.log(`\n✓ DAM manifest total pages: ${pageCount}`);
        } else if (url.includes('internetculturale.it')) {
            const pageCount = await testInternetCulturale(url);
            console.log(`\n✓ Internet Culturale total pages: ${pageCount}`);
        }
    }
    
    console.log('\n=== Test Summary ===');
    console.log('Output directory:', OUTPUT_DIR);
}

// Run tests
runTests().catch(console.error);