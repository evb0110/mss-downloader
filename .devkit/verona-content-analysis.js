#!/usr/bin/env node

const https = require('https');

/**
 * Detailed analysis of Verona NBM page content
 */
async function analyzeVeronaContent() {
    const testUrl = 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15';
    
    console.log('=== VERONA NBM CONTENT ANALYSIS ===\n');
    console.log(`Analyzing: ${testUrl}\n`);
    
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'www.nuovabibliotecamanoscritta.it',
            port: 443,
            path: '/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15',
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Referer': 'https://www.nuovabibliotecamanoscritta.it/',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 30000,
            rejectUnauthorized: false
        };
        
        const req = https.request(options, (res) => {
            const responseTime = Date.now() - startTime;
            
            console.log(`✅ Connected successfully (${responseTime}ms)`);
            console.log(`📊 Status: ${res.statusCode} ${res.statusMessage}`);
            console.log(`📄 Content-Type: ${res.headers['content-type']}`);
            console.log(`📏 Content-Length: ${res.headers['content-length']} bytes\n`);
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk.toString();
            });
            
            res.on('end', () => {
                try {
                    console.log('🔍 PARSING HTML CONTENT...\n');
                    
                    // Basic content analysis without cheerio for now
                    console.log('📋 BASIC CONTENT ANALYSIS:');
                    
                    // Check for key manuscript elements
                    const checks = [
                        { pattern: /codice\s*=?\s*15/i, name: 'Codice 15 parameter' },
                        { pattern: /manoscritto|manuscript/i, name: 'Manuscript references' },
                        { pattern: /iiif/i, name: 'IIIF protocol' },
                        { pattern: /manifest/i, name: 'Manifest files' },
                        { pattern: /viewer|visualizzatore/i, name: 'Image viewer' },
                        { pattern: /digitale|digital/i, name: 'Digital content' },
                        { pattern: /biblioteca/i, name: 'Library references' },
                        { pattern: /immagini|images/i, name: 'Image references' },
                        { pattern: /download|scarica/i, name: 'Download functionality' },
                        { pattern: /pdf/i, name: 'PDF references' }
                    ];
                    
                    checks.forEach(({ pattern, name }) => {
                        const matches = data.match(pattern);
                        if (matches) {
                            console.log(`  ✅ ${name}: Found`);
                        } else {
                            console.log(`  ❌ ${name}: Not found`);
                        }
                    });
                    
                    // Look for JavaScript frameworks and dynamic content
                    console.log('\n🔧 JAVASCRIPT ANALYSIS:');
                    const jsPatterns = [
                        { pattern: /<script[^>]*src[^>]*>/gi, name: 'External scripts' },
                        { pattern: /<script[^>]*>[\s\S]*?<\/script>/gi, name: 'Inline scripts' },
                        { pattern: /jquery|jQuery/i, name: 'jQuery usage' },
                        { pattern: /ajax|XMLHttpRequest|fetch/i, name: 'AJAX calls' },
                        { pattern: /window\.onload|document\.ready/i, name: 'DOM ready handlers' }
                    ];
                    
                    jsPatterns.forEach(({ pattern, name }) => {
                        const matches = data.match(pattern);
                        if (matches) {
                            console.log(`  ✅ ${name}: ${matches.length} found`);
                        } else {
                            console.log(`  ❌ ${name}: Not found`);
                        }
                    });
                    
                    // Extract specific content sections
                    console.log('\n📝 CONTENT EXTRACTION:');
                    
                    // Look for title
                    const titleMatch = data.match(/<title[^>]*>(.*?)<\/title>/i);
                    if (titleMatch) {
                        console.log(`  📖 Page Title: "${titleMatch[1].trim()}"`);
                    }
                    
                    // Look for forms (potential manifest loading)
                    const formMatches = data.match(/<form[^>]*>[\s\S]*?<\/form>/gi);
                    if (formMatches) {
                        console.log(`  📋 Forms found: ${formMatches.length}`);
                        formMatches.forEach((form, index) => {
                            const actionMatch = form.match(/action\s*=\s*["']([^"']+)["']/i);
                            const methodMatch = form.match(/method\s*=\s*["']([^"']+)["']/i);
                            console.log(`    Form ${index + 1}: ${methodMatch ? methodMatch[1] : 'GET'} -> ${actionMatch ? actionMatch[1] : 'current page'}`);
                        });
                    }
                    
                    // Look for iframes (potential viewer embedding)
                    const iframeMatches = data.match(/<iframe[^>]*>/gi);
                    if (iframeMatches) {
                        console.log(`  🖼️  iframes found: ${iframeMatches.length}`);
                        iframeMatches.forEach((iframe, index) => {
                            const srcMatch = iframe.match(/src\s*=\s*["']([^"']+)["']/i);
                            if (srcMatch) {
                                console.log(`    iframe ${index + 1} src: ${srcMatch[1]}`);
                            }
                        });
                    }
                    
                    // Look for links that might lead to manifests or viewers
                    const potentialManifestLinks = data.match(/href\s*=\s*["']([^"']*(?:manifest|iiif|json)[^"']*)["']/gi);
                    if (potentialManifestLinks) {
                        console.log(`  🔗 Potential manifest links: ${potentialManifestLinks.length}`);
                        potentialManifestLinks.forEach((link, index) => {
                            const urlMatch = link.match(/href\s*=\s*["']([^"']+)["']/i);
                            if (urlMatch) {
                                console.log(`    ${index + 1}: ${urlMatch[1]}`);
                            }
                        });
                    }
                    
                    // Extract any URLs that contain 'codice' parameter
                    const codiceUrls = data.match(/(?:href|src|action)\s*=\s*["']([^"']*codice[^"']*)["']/gi);
                    if (codiceUrls) {
                        console.log(`  📌 URLs with 'codice' parameter: ${codiceUrls.length}`);
                        codiceUrls.forEach((url, index) => {
                            const urlMatch = url.match(/(?:href|src|action)\s*=\s*["']([^"']+)["']/i);
                            if (urlMatch) {
                                console.log(`    ${index + 1}: ${urlMatch[1]}`);
                            }
                        });
                    }
                    
                    // Sample the main content
                    console.log('\n📄 CONTENT SAMPLES:');
                    
                    // Remove HTML tags for cleaner text analysis
                    const textContent = data.replace(/<script[\s\S]*?<\/script>/gi, '')
                                          .replace(/<style[\s\S]*?<\/style>/gi, '')
                                          .replace(/<[^>]+>/g, ' ')
                                          .replace(/\s+/g, ' ')
                                          .trim();
                    
                    if (textContent.length > 0) {
                        console.log(`  📝 Text content length: ${textContent.length} characters`);
                        console.log(`  📖 First 300 chars: "${textContent.substring(0, 300)}..."`);
                        
                        // Look for Italian content (typical for this library)
                        const italianWords = textContent.match(/\b(?:biblioteca|manoscritto|codice|digitale|immagini|visualizza|scarica|documento)\b/gi);
                        if (italianWords) {
                            console.log(`  🇮🇹 Italian content detected: ${italianWords.length} Italian words found`);
                        }
                    }
                    
                    resolve({
                        success: true,
                        statusCode: res.statusCode,
                        responseTime,
                        contentLength: data.length,
                        textLength: textContent.length,
                        hasManuscriptContent: /codice\s*=?\s*15/i.test(data),
                        hasJavaScript: /<script/i.test(data),
                        hasIframes: /<iframe/i.test(data),
                        hasForms: /<form/i.test(data),
                        htmlContent: data,
                        textContent: textContent
                    });
                    
                } catch (error) {
                    console.log(`❌ Content parsing error: ${error.message}`);
                    reject(error);
                }
            });
        });
        
        req.on('error', (error) => {
            const responseTime = Date.now() - startTime;
            console.log(`❌ Request failed after ${responseTime}ms: ${error.message}`);
            reject(error);
        });
        
        req.on('timeout', () => {
            req.destroy();
            console.log('⏰ Request timeout');
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

// Run analysis
if (require.main === module) {
    analyzeVeronaContent()
        .then(result => {
            console.log('\n=== ANALYSIS COMPLETED ===');
            console.log(`✅ Success: ${result.success}`);
            console.log(`📊 Response time: ${result.responseTime}ms`);
            console.log(`📄 Content size: ${result.contentLength} bytes`);
            console.log(`📝 Text size: ${result.textLength} characters`);
            console.log(`📚 Has manuscript content: ${result.hasManuscriptContent}`);
            console.log(`🔧 Has JavaScript: ${result.hasJavaScript}`);
            console.log(`🖼️  Has iframes: ${result.hasIframes}`);
            console.log(`📋 Has forms: ${result.hasForms}`);
        })
        .catch(error => {
            console.log('\n=== ANALYSIS FAILED ===');
            console.log(`❌ Error: ${error.message}`);
            process.exit(1);
        });
}

module.exports = { analyzeVeronaContent };