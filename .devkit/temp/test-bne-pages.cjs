const http = require('http');
const https = require('https');

const manuscriptId = '0000007619';

async function testHttpRequest(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const request = client.request(url, { method: 'HEAD' }, (response) => {
            resolve({
                statusCode: response.statusCode,
                headers: response.headers,
                ok: response.statusCode >= 200 && response.statusCode < 300
            });
        });
        
        request.on('error', (error) => {
            reject(error);
        });
        
        request.setTimeout(5000, () => {
            request.destroy();
            reject(new Error('Request timeout'));
        });
        
        request.end();
    });
}

async function findBnePages() {
    console.log('Testing BNE pages with HTTP...');
    
    const pageLinks = [];
    let consecutiveFailures = 0;
    
    for (let page = 1; page <= 50; page++) {
        // Use HTTP instead of HTTPS
        const testUrl = `http://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=${page}&jpeg=true`;
        
        try {
            const response = await testHttpRequest(testUrl);
            
            if (response.ok && response.headers['content-type']?.includes('image')) {
                pageLinks.push(testUrl);
                consecutiveFailures = 0;
                console.log(`✓ Found page ${page} (${response.headers['content-length']} bytes)`);
            } else {
                consecutiveFailures++;
                console.log(`✗ Page ${page} failed (${response.statusCode})`);
                if (consecutiveFailures >= 5) {
                    console.log(`Stopping after ${consecutiveFailures} consecutive failures`);
                    break;
                }
            }
        } catch (error) {
            consecutiveFailures++;
            console.log(`✗ Page ${page} error: ${error.message}`);
            if (consecutiveFailures >= 5) {
                console.log(`Stopping after ${consecutiveFailures} consecutive failures`);
                break;
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`\nTotal pages found: ${pageLinks.length}`);
    
    // Test for maximum resolution
    if (pageLinks.length > 0) {
        console.log('\n=== Testing maximum resolution ===');
        
        const baseUrl = `http://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=1`;
        const resolutionParams = [
            '&jpeg=true',
            '&jpeg=true&size=full',
            '&jpeg=true&size=max',
            '&jpeg=true&size=2000',
            '&jpeg=true&size=4000',
            '&jpeg=true&width=4000',
            '&jpeg=true&height=4000',
            '&jpeg=true&quality=max',
            '&jpeg=true&dpi=300',
            '&jpeg=true&resolution=max',
            '&tiff=true',
            '&png=true',
            '&pdf=true',
            ''
        ];
        
        for (const param of resolutionParams) {
            const testUrl = baseUrl + param;
            try {
                const response = await testHttpRequest(testUrl);
                if (response.ok) {
                    console.log(`✓ ${param || 'no params'}: ${response.headers['content-type']}, ${response.headers['content-length']} bytes`);
                } else {
                    console.log(`✗ ${param || 'no params'}: ${response.statusCode}`);
                }
            } catch (error) {
                console.log(`✗ ${param || 'no params'}: ${error.message}`);
            }
        }
    }
    
    return pageLinks;
}

findBnePages().catch(console.error);