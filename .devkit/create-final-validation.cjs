const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const { SharedManifestLoaders } = require('../src/shared/SharedManifestLoaders.js');

const fetchFn = (url, options = {}) => {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const requestOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                ...options.headers
            },
            timeout: 30000
        };

        // SSL bypass for specific domains
        if (url.includes('bdh-rd.bne.es') || url.includes('pagella.bm-grenoble.fr')) {
            requestOptions.rejectUnauthorized = false;
        }

        https.get(requestOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    text: async () => data,
                    json: async () => JSON.parse(data)
                });
            });
        }).on('error', reject);
    });
};

function downloadImage(url, filepath, referer = null) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive'
        };
        
        if (referer) {
            headers['Referer'] = referer;
        }

        const options = { headers };
        
        // SSL bypass for specific domains
        if (url.includes('bdh-rd.bne.es') || url.includes('pagella.bm-grenoble.fr')) {
            options.rejectUnauthorized = false;
        }

        https.get(url, options, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(filepath, () => {});
            reject(err);
        });
    });
}

async function createValidationPDF(libraryName, libraryId, testUrl, referer = null) {
    console.log(`\n=== ${libraryName} Validation ===`);
    
    const loader = new SharedManifestLoaders(fetchFn);
    const validationDir = path.join(__dirname, 'validation-results', 'FINAL_VALIDATION');
    
    try {
        console.log(`Testing ${libraryName}:`, testUrl);
        const result = await loader.getManifestForLibrary(libraryId, testUrl);
        
        console.log(`Found ${result.images.length} pages`);
        
        // Download 3 test pages from different parts
        const testPages = [0, Math.floor(result.images.length * 0.4), Math.floor(result.images.length * 0.8)];
        const downloadedFiles = [];
        
        for (let i = 0; i < Math.min(3, result.images.length); i++) {
            const pageIndex = testPages[i] < result.images.length ? testPages[i] : i;
            const image = result.images[pageIndex];
            
            const filename = `${libraryName.toLowerCase()}_page_${pageIndex + 1}.jpg`;
            const filepath = path.join(validationDir, filename);
            
            console.log(`Downloading page ${pageIndex + 1}: ${image.label}`);
            await downloadImage(image.url, filepath, referer);
            downloadedFiles.push(filepath);
            
            const stats = fs.statSync(filepath);
            console.log(`Downloaded: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        }
        
        // Create PDF
        const pdfPath = path.join(validationDir, `${libraryName}_validation.pdf`);
        
        const convertCmd = `convert ${downloadedFiles.map(f => `"${f}"`).join(' ')} "${pdfPath}"`;
        execSync(convertCmd);
        
        // Verify PDF
        const pdfInfo = execSync(`pdfinfo "${pdfPath}"`).toString();
        const pdfStats = fs.statSync(pdfPath);
        console.log(`✅ PDF created: ${libraryName}_validation.pdf (${(pdfStats.size / 1024 / 1024).toFixed(2)} MB)`);
        
        // Clean up individual images
        for (const file of downloadedFiles) {
            fs.unlinkSync(file);
        }
        
        return true;
        
    } catch (error) {
        console.error(`❌ ${libraryName} failed:`, error.message);
        return false;
    }
}

async function createFinalValidation() {
    console.log('=== Creating Final Validation PDFs ===\n');
    console.log('Following Library Validation Protocol from CLAUDE.md\n');
    
    const libraries = [
        {
            name: 'Library_of_Congress',
            id: 'loc',
            url: 'https://www.loc.gov/item/2010414164/',
            referer: 'https://www.loc.gov/'
        },
        {
            name: 'Florence_Fixed',
            id: 'florence',
            url: 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/',
            referer: 'https://cdm21059.contentdm.oclc.org/'
        }
    ];
    
    let successCount = 0;
    
    for (const library of libraries) {
        const success = await createValidationPDF(library.name, library.id, library.url, library.referer);
        if (success) successCount++;
    }
    
    console.log(`\n=== Validation Complete ===`);
    console.log(`Successfully created ${successCount}/${libraries.length} validation PDFs`);
    console.log(`Location: ${path.join(__dirname, 'validation-results', 'FINAL_VALIDATION')}`);
    
    // List final PDFs
    const finalDir = path.join(__dirname, 'validation-results', 'FINAL_VALIDATION');
    const files = fs.readdirSync(finalDir).filter(f => f.endsWith('.pdf'));
    
    console.log('\nFinal validation PDFs:');
    for (const file of files) {
        const stats = fs.statSync(path.join(finalDir, file));
        console.log(`- ${file} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    }
    
    console.log('\n✅ All validation PDFs ready for user approval');
}

createFinalValidation().catch(console.error);