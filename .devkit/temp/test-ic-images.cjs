const https = require('https');
const fs = require('fs');

const testUrls = [
    'https://www.internetculturale.it/jmms/cacheman/web/Laurenziana_-_FI/Biblioteca_Medicea_Laurenziana_-_Firenze_-_IT-FI0100/oai.teca.bmlonline.it.21.XXXX.Plutei.IT_3AFI0100_Plutei_21.29/1.jpg',
    'https://www.internetculturale.it/jmms/cacheman/web/Laurenziana_-_FI/Biblioteca_Medicea_Laurenziana_-_Firenze_-_IT-FI0100/oai.teca.bmlonline.it.21.XXXX.Plutei.IT_3AFI0100_Plutei_21.29/2.jpg',
    'https://www.internetculturale.it/jmms/cacheman/web/Laurenziana_-_FI/Biblioteca_Medicea_Laurenziana_-_Firenze_-_IT-FI0100/oai.teca.bmlonline.it.21.XXXX.Plutei.IT_3AFI0100_Plutei_21.29/578.jpg'
];

async function downloadAndAnalyze(url, index) {
    return new Promise((resolve, reject) => {
        const filename = `/tmp/test-ic-${index}.jpg`;
        const file = fs.createWriteStream(filename);
        
        https.get(url, (response) => {
            console.log(`\nDownloading image ${index}:`);
            console.log(`Status: ${response.statusCode}`);
            console.log(`Content-Type: ${response.headers['content-type']}`);
            console.log(`Content-Length: ${response.headers['content-length']}`);
            
            response.pipe(file);
            
            file.on('finish', () => {
                file.close();
                
                // Read first 1000 bytes to check if it's HTML or image
                const buffer = Buffer.alloc(1000);
                const fd = fs.openSync(filename, 'r');
                fs.readSync(fd, buffer, 0, 1000, 0);
                fs.closeSync(fd);
                
                const firstBytes = buffer.toString('utf8', 0, 100);
                const isHTML = firstBytes.includes('<html') || firstBytes.includes('<!DOCTYPE');
                
                console.log(`File size: ${fs.statSync(filename).size} bytes`);
                console.log(`Is HTML: ${isHTML}`);
                if (isHTML) {
                    console.log(`HTML content preview: ${firstBytes.substring(0, 200)}...`);
                }
                
                resolve({
                    url,
                    index,
                    size: fs.statSync(filename).size,
                    isHTML,
                    preview: firstBytes.substring(0, 200)
                });
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function main() {
    console.log('Testing Internet Culturale image downloads...');
    
    for (let i = 0; i < testUrls.length; i++) {
        try {
            const result = await downloadAndAnalyze(testUrls[i], i + 1);
            if (result.isHTML) {
                console.log(`⚠️  Image ${result.index} contains HTML instead of image data!`);
            } else {
                console.log(`✅ Image ${result.index} appears to be valid image data`);
            }
        } catch (error) {
            console.error(`❌ Error downloading image ${i + 1}:`, error.message);
        }
    }
}

main();