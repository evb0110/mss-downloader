const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const outputDir = path.join(__dirname, '..', 'test-outputs', 'mdc-catalonia-simple');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function fetchWithFallback(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        
        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                ...options.headers
            },
            timeout: 30000,
            rejectUnauthorized: false
        };
        
        const req = protocol.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    statusText: res.statusMessage,
                    text: async () => data,
                    headers: res.headers
                });
            });
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

async function downloadImage(url, outputPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(outputPath);
        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        
        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
            },
            timeout: 60000,
            rejectUnauthorized: false
        };
        
        const req = protocol.request(reqOptions, (res) => {
            if (res.statusCode !== 200) {
                file.close();
                fs.unlinkSync(outputPath);
                reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                return;
            }
            
            res.pipe(file);
            
            file.on('finish', () => {
                file.close();
                const stats = fs.statSync(outputPath);
                resolve(stats.size);
            });
        });
        
        req.on('error', (err) => {
            file.close();
            fs.unlinkSync(outputPath);
            reject(err);
        });
        
        req.on('timeout', () => {
            req.destroy();
            file.close();
            fs.unlinkSync(outputPath);
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

async function testMDCManuscript(url, name) {
    console.log(`\n📘 Testing: ${name}`);
    console.log(`URL: ${url}`);
    
    const urlMatch = url.match(/mdc\.csuc\.cat\/digital\/collection\/([^\/]+)\/id\/(\d+)/);
    if (!urlMatch) {
        throw new Error('Invalid MDC URL format');
    }
    
    const collection = urlMatch[1];
    const parentId = urlMatch[2];
    const manuscriptDir = path.join(outputDir, name.replace(/[^a-zA-Z0-9]/g, '_'));
    
    if (!fs.existsSync(manuscriptDir)) {
        fs.mkdirSync(manuscriptDir, { recursive: true });
    }
    
    try {
        // Step 1: Get compound object XML
        console.log('\n1️⃣ Fetching compound object XML...');
        const compoundUrl = `https://mdc.csuc.cat/utils/getfile/collection/${collection}/id/${parentId}`;
        const xmlResponse = await fetchWithFallback(compoundUrl, {
            headers: {
                'Accept': 'application/xml, text/xml, */*',
                'Referer': url
            }
        });
        
        if (!xmlResponse.ok) {
            throw new Error(`Failed to fetch XML: ${xmlResponse.status} ${xmlResponse.statusText}`);
        }
        
        const xmlText = await xmlResponse.text();
        console.log(`✅ XML retrieved (${xmlText.length} characters)`);
        
        // Step 2: Parse pages from XML
        const pageMatches = xmlText.match(/<page>[\s\S]*?<\/page>/g);
        if (!pageMatches) {
            throw new Error('No pages found in XML');
        }
        
        console.log(`✅ Found ${pageMatches.length} pages`);
        
        // Step 3: Extract page information
        const pages = [];
        for (let i = 0; i < Math.min(10, pageMatches.length); i++) {
            const pageXml = pageMatches[i];
            const titleMatch = pageXml.match(/<pagetitle>(.*?)<\/pagetitle>/);
            const ptrMatch = pageXml.match(/<pageptr>(.*?)<\/pageptr>/);
            
            if (titleMatch && ptrMatch) {
                pages.push({
                    index: i + 1,
                    title: titleMatch[1],
                    pagePtr: ptrMatch[1]
                });
            }
        }
        
        console.log(`\n2️⃣ Downloading ${pages.length} pages...`);
        
        // Step 4: Download pages
        const downloadedPages = [];
        for (const page of pages) {
            const imageUrl = `https://mdc.csuc.cat/digital/iiif/${collection}/${page.pagePtr}/full/full/0/default.jpg`;
            const outputPath = path.join(manuscriptDir, `page_${String(page.index).padStart(3, '0')}.jpg`);
            
            try {
                console.log(`   Downloading page ${page.index}: ${page.title}...`);
                const size = await downloadImage(imageUrl, outputPath);
                console.log(`   ✅ Page ${page.index} downloaded (${(size / 1024).toFixed(2)} KB)`);
                downloadedPages.push(outputPath);
            } catch (error) {
                console.log(`   ❌ Failed to download page ${page.index}: ${error.message}`);
            }
        }
        
        // Step 5: Create PDF using img2pdf
        if (downloadedPages.length > 0) {
            console.log('\n3️⃣ Creating PDF...');
            const pdfPath = path.join(outputDir, `${name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
            
            try {
                execSync(`img2pdf ${downloadedPages.join(' ')} -o "${pdfPath}"`, { stdio: 'pipe' });
                const stats = fs.statSync(pdfPath);
                console.log(`✅ PDF created: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
                
                // Verify with poppler
                try {
                    const pdfInfo = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
                    const pagesMatch = pdfInfo.match(/Pages:\s+(\d+)/);
                    if (pagesMatch) {
                        console.log(`✅ PDF validated: ${pagesMatch[1]} pages`);
                    }
                } catch (e) {
                    console.log('⚠️ Could not validate PDF with pdfinfo');
                }
                
                return { success: true, pages: downloadedPages.length, pdfPath };
            } catch (error) {
                console.error(`❌ Failed to create PDF: ${error.message}`);
                return { success: false, error: error.message };
            }
        } else {
            return { success: false, error: 'No pages downloaded' };
        }
        
    } catch (error) {
        console.error(`❌ Test failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function main() {
    console.log('🔍 Testing MDC Catalonia fetch capabilities...');
    
    const testCases = [
        {
            name: 'MDC Incunable BC 175331',
            url: 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1'
        },
        {
            name: 'MDC Manuscript BC 3877',
            url: 'https://mdc.csuc.cat/digital/collection/manuscritBC/id/3877/rec/1'
        },
        {
            name: 'MDC Incunable SHP 248',
            url: 'https://mdc.csuc.cat/digital/collection/incunableSHP/id/248/rec/1'
        }
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
        const result = await testMDCManuscript(testCase.url, testCase.name);
        results.push({ ...testCase, ...result });
    }
    
    // Summary
    console.log('\n\n📊 Test Summary:');
    console.log('================\n');
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    if (successful.length > 0) {
        console.log('✅ Successful downloads:');
        successful.forEach(r => {
            console.log(`   - ${r.name}: ${r.pages} pages`);
            console.log(`     PDF: ${r.pdfPath}`);
        });
    }
    
    if (failed.length > 0) {
        console.log('\n❌ Failed downloads:');
        failed.forEach(r => {
            console.log(`   - ${r.name}: ${r.error}`);
        });
    }
    
    console.log(`\nTotal: ${successful.length}/${results.length} successful`);
    
    // Write report
    const report = {
        timestamp: new Date().toISOString(),
        results: results,
        summary: {
            total: results.length,
            successful: successful.length,
            failed: failed.length
        }
    };
    
    const reportPath = path.join(outputDir, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${reportPath}`);
}

main().catch(console.error);