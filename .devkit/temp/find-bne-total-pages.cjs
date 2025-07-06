const http = require('http');

const manuscriptId = '0000007619';

async function testHttpRequest(url) {
    return new Promise((resolve, reject) => {
        const request = http.request(url, { method: 'HEAD' }, (response) => {
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

async function findTotalPages() {
    console.log('Finding total pages for BNE manuscript...');
    
    let totalPages = 0;
    let consecutiveFailures = 0;
    
    // Test in batches to find the total more efficiently
    for (let page = 1; page <= 500; page++) {
        const testUrl = `http://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=${page}&jpeg=true`;
        
        try {
            const response = await testHttpRequest(testUrl);
            
            if (response.ok && response.headers['content-type']?.includes('image')) {
                totalPages = page;
                consecutiveFailures = 0;
                if (page % 10 === 0) {
                    console.log(`✓ Found page ${page}`);
                }
            } else {
                consecutiveFailures++;
                if (consecutiveFailures >= 10) {
                    console.log(`Stopping after ${consecutiveFailures} consecutive failures at page ${page}`);
                    break;
                }
            }
        } catch (error) {
            consecutiveFailures++;
            if (consecutiveFailures >= 10) {
                console.log(`Stopping after ${consecutiveFailures} consecutive failures at page ${page}`);
                break;
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\nTotal pages found: ${totalPages}`);
    return totalPages;
}

findTotalPages().catch(console.error);