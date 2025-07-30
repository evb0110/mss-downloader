#!/usr/bin/env node

const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * Test Verona NBM connectivity and analyze response
 */
async function testVeronaConnectivity() {
    const testUrl = 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15';
    
    console.log('=== VERONA NBM CONNECTIVITY TEST ===\n');
    console.log(`Testing URL: ${testUrl}\n`);
    
    const startTime = Date.now();
    
    try {
        const parsedUrl = new URL(testUrl);
        const isHttps = parsedUrl.protocol === 'https:';
        const client = isHttps ? https : http;
        
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 30000,
            // Bypass SSL certificate verification for testing
            rejectUnauthorized: false
        };
        
        return new Promise((resolve, reject) => {
            const req = client.request(options, (res) => {
                const responseTime = Date.now() - startTime;
                
                // Log SSL certificate info if available
                if (isHttps && res.socket && res.socket.getPeerCertificate) {
                    const cert = res.socket.getPeerCertificate();
                    if (cert && Object.keys(cert).length > 0) {
                        console.log('\n🔒 SSL CERTIFICATE INFO:');
                        console.log(`  Subject: ${cert.subject ? cert.subject.CN : 'N/A'}`);
                        console.log(`  Issuer: ${cert.issuer ? cert.issuer.CN : 'N/A'}`);
                        console.log(`  Valid From: ${cert.valid_from || 'N/A'}`);
                        console.log(`  Valid To: ${cert.valid_to || 'N/A'}`);
                    }
                }
                
                console.log('✅ CONNECTION SUCCESSFUL');
                console.log(`📊 Response Time: ${responseTime}ms`);
                console.log(`🔗 HTTP Status: ${res.statusCode} ${res.statusMessage}`);
                console.log('\n📋 RESPONSE HEADERS:');
                Object.entries(res.headers).forEach(([key, value]) => {
                    console.log(`  ${key}: ${value}`);
                });
                
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    console.log(`\n📄 CONTENT LENGTH: ${data.length} bytes`);
                    
                    // Analyze content
                    console.log('\n🔍 CONTENT ANALYSIS:');
                    
                    // Check for common error patterns
                    const errorPatterns = [
                        { pattern: /error/i, name: 'Generic Error' },
                        { pattern: /404|not found/i, name: '404 Not Found' },
                        { pattern: /403|forbidden|access denied/i, name: 'Access Denied' },
                        { pattern: /500|internal server error/i, name: 'Server Error' },
                        { pattern: /timeout/i, name: 'Timeout' },
                        { pattern: /maintenance/i, name: 'Maintenance Mode' },
                        { pattern: /login|authentication|signin/i, name: 'Authentication Required' }
                    ];
                    
                    const foundErrors = errorPatterns.filter(({ pattern }) => pattern.test(data));
                    if (foundErrors.length > 0) {
                        console.log('  ⚠️  Error patterns found:');
                        foundErrors.forEach(({ name }) => console.log(`    - ${name}`));
                    } else {
                        console.log('  ✅ No obvious error patterns detected');
                    }
                    
                    // Check for manuscript-related content
                    const manuscriptPatterns = [
                        { pattern: /manuscript|manoscritto/i, name: 'Manuscript References' },
                        { pattern: /iiif/i, name: 'IIIF Protocol' },
                        { pattern: /manifest/i, name: 'Manifest Files' },
                        { pattern: /codice.*15/i, name: 'Codice 15 Reference' },
                        { pattern: /biblioteca|library/i, name: 'Library References' },
                        { pattern: /digitalizzazione|digitization/i, name: 'Digitization' }
                    ];
                    
                    const foundManuscript = manuscriptPatterns.filter(({ pattern }) => pattern.test(data));
                    if (foundManuscript.length > 0) {
                        console.log('  📚 Manuscript-related content found:');
                        foundManuscript.forEach(({ name }) => console.log(`    - ${name}`));
                    }
                    
                    // Check for JavaScript requirements
                    if (data.includes('<script') || data.includes('javascript:')) {
                        console.log('  🟡 JavaScript content detected - may require dynamic loading');
                    }
                    
                    // Sample content (first 500 chars)
                    console.log('\n📖 CONTENT SAMPLE (first 500 chars):');
                    console.log(data.substring(0, 500).replace(/\s+/g, ' ').trim());
                    
                    if (data.length > 500) {
                        console.log('\n📖 CONTENT SAMPLE (last 200 chars):');
                        console.log(data.substring(data.length - 200).replace(/\s+/g, ' ').trim());
                    }
                    
                    resolve({
                        success: true,
                        statusCode: res.statusCode,
                        responseTime,
                        contentLength: data.length,
                        headers: res.headers,
                        content: data
                    });
                });
            });
            
            req.on('error', (error) => {
                const responseTime = Date.now() - startTime;
                console.log('❌ CONNECTION FAILED');
                console.log(`📊 Time to failure: ${responseTime}ms`);
                console.log(`🔥 Error: ${error.message}`);
                console.log(`🔧 Error Code: ${error.code}`);
                
                if (error.code === 'ENOTFOUND') {
                    console.log('  🌐 DNS resolution failed - domain may not exist');
                } else if (error.code === 'ECONNREFUSED') {
                    console.log('  🚫 Connection refused - server may be down');
                } else if (error.code === 'ETIMEDOUT') {
                    console.log('  ⏰ Connection timed out - server may be slow or unreachable');
                } else if (error.code === 'ECONNRESET') {
                    console.log('  🔄 Connection reset - server closed connection unexpectedly');
                }
                
                reject(error);
            });
            
            req.on('timeout', () => {
                req.destroy();
                const responseTime = Date.now() - startTime;
                console.log('⏰ REQUEST TIMEOUT');
                console.log(`📊 Timeout after: ${responseTime}ms`);
                reject(new Error('Request timeout'));
            });
            
            req.end();
        });
        
    } catch (error) {
        console.log('❌ URL PARSING ERROR');
        console.log(`🔥 Error: ${error.message}`);
        throw error;
    }
}

// Additional DNS and basic connectivity tests
async function testDNS() {
    console.log('\n=== DNS RESOLUTION TEST ===\n');
    
    const dns = require('dns').promises;
    
    try {
        console.log('🔍 Testing DNS resolution for www.nuovabibliotecamanoscritta.it...');
        const addresses = await dns.lookup('www.nuovabibliotecamanoscritta.it');
        console.log(`✅ DNS resolved to: ${addresses.address} (family: IPv${addresses.family})`);
        
        // Test if we can resolve multiple IPs
        const allAddresses = await dns.resolve4('www.nuovabibliotecamanoscritta.it');
        console.log(`📍 All IPv4 addresses: ${allAddresses.join(', ')}`);
        
    } catch (error) {
        console.log(`❌ DNS resolution failed: ${error.message}`);
    }
}

// Main execution
async function main() {
    try {
        await testDNS();
        await testVeronaConnectivity();
        
        console.log('\n=== TEST COMPLETED ===');
        
    } catch (error) {
        console.log('\n=== TEST FAILED ===');
        console.log(`Final error: ${error.message}`);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { testVeronaConnectivity, testDNS };