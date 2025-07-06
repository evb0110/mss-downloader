const https = require('https');
const fs = require('fs');

// Test different resolution patterns for University of Freiburg
async function analyzeFreiburgLibrary() {
    console.log('🔍 Analyzing University of Freiburg Library Structure...\n');
    
    const testManuscript = 'hs360a';
    const testPages = ['0001', '0010', '0050', '0100'];
    const baseUrl = 'https://dl.ub.uni-freiburg.de';
    
    // Test different image resolution patterns
    const resolutionPatterns = [
        '/diglitData/image/{manuscript}/1/{page}.jpg',
        '/diglitData/image/{manuscript}/2/{page}.jpg', 
        '/diglitData/image/{manuscript}/3/{page}.jpg',
        '/diglitData/image/{manuscript}/max/{page}.jpg',
        '/diglitData/image/{manuscript}/full/{page}.jpg',
        '/diglitData/image/{manuscript}/{page}.jpg'
    ];
    
    const results = {
        manuscript: testManuscript,
        totalPages: 434,
        workingPatterns: [],
        imageInfo: [],
        urlStructure: {},
        recommendations: []
    };
    
    // Test page access patterns
    for (const page of testPages) {
        console.log(`Testing page ${page}...`);
        
        for (const pattern of resolutionPatterns) {
            const imageUrl = baseUrl + pattern
                .replace('{manuscript}', testManuscript)
                .replace('{page}', page);
                
            try {
                const response = await makeRequest(imageUrl, 'HEAD');
                if (response.statusCode === 200) {
                    const contentLength = parseInt(response.headers['content-length']) || 0;
                    const info = {
                        page,
                        pattern,
                        url: imageUrl,
                        size: contentLength,
                        sizeKB: Math.round(contentLength / 1024),
                        contentType: response.headers['content-type']
                    };
                    
                    results.imageInfo.push(info);
                    
                    if (!results.workingPatterns.includes(pattern)) {
                        results.workingPatterns.push(pattern);
                    }
                    
                    console.log(`  ✅ ${pattern} - ${info.sizeKB}KB`);
                } else {
                    console.log(`  ❌ ${pattern} - ${response.statusCode}`);
                }
            } catch (error) {
                console.log(`  ❌ ${pattern} - Error: ${error.message}`);
            }
        }
    }
    
    // Find the highest resolution pattern
    const maxSizeInfo = results.imageInfo.reduce((max, current) => 
        current.size > max.size ? current : max, 
        { size: 0 }
    );
    
    if (maxSizeInfo.size > 0) {
        results.recommendations.push({
            type: 'MAX_RESOLUTION',
            pattern: maxSizeInfo.pattern,
            avgSize: Math.round(
                results.imageInfo
                    .filter(info => info.pattern === maxSizeInfo.pattern)
                    .reduce((sum, info) => sum + info.size, 0) / 
                results.imageInfo.filter(info => info.pattern === maxSizeInfo.pattern).length / 1024
            )
        });
    }
    
    // Test page discovery
    console.log('\n📄 Testing page discovery...');
    const pageUrls = [
        `${baseUrl}/diglit/${testManuscript}/0001`,
        `${baseUrl}/diglit/${testManuscript}/0434`,
        `${baseUrl}/diglit/${testManuscript}/0500` // Test beyond known range
    ];
    
    for (const url of pageUrls) {
        try {
            const response = await makeRequest(url);
            console.log(`  ${url} - ${response.statusCode === 200 ? '✅' : '❌'} (${response.statusCode})`);
        } catch (error) {
            console.log(`  ${url} - ❌ Error: ${error.message}`);
        }
    }
    
    // URL Structure Analysis
    results.urlStructure = {
        viewerBase: `${baseUrl}/diglit/{manuscript}/{page}`,
        imageBase: `${baseUrl}/diglitData/image/{manuscript}/{resolution}/{page}.jpg`,
        pageFormat: '4-digit zero-padded (0001, 0002, etc.)',
        supportedResolutions: results.workingPatterns.map(p => p.split('/')[3]),
        maxKnownPages: 434
    };
    
    console.log('\n📊 Analysis Results:');
    console.log(JSON.stringify(results, null, 2));
    
    // Save results
    fs.writeFileSync('/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/freiburg-library-analysis.json', 
        JSON.stringify(results, null, 2));
    
    console.log('\n✅ Analysis complete. Results saved to .devkit/reports/freiburg-library-analysis.json');
    
    return results;
}

function makeRequest(url, method = 'GET') {
    return new Promise((resolve, reject) => {
        const options = {
            method,
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        };
        
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: data
                });
            });
        });
        
        req.on('error', reject);
        req.on('timeout', () => reject(new Error('Request timeout')));
        req.end();
    });
}

analyzeFreiburgLibrary().catch(console.error);