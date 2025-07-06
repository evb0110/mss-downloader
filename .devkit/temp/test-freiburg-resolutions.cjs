const https = require('https');
const fs = require('fs');

// Test different resolution levels for Freiburg library
async function testFreiburgResolutions() {
    console.log('🔍 Testing University of Freiburg Resolution Levels...\n');
    
    const testManuscript = 'hs360a';
    const testPage = '003v'; // From our analysis
    const baseUrl = 'https://dl.ub.uni-freiburg.de';
    
    // Test different resolution levels
    const resolutionLevels = ['1', '2', '3', '4', '5', 'max', 'full', 'original'];
    const results = [];
    
    for (const resolution of resolutionLevels) {
        const imageUrl = `${baseUrl}/diglitData/image/${testManuscript}/${resolution}/${testPage}.jpg`;
        
        try {
            console.log(`Testing resolution level: ${resolution}`);
            const response = await makeRequest(imageUrl, 'HEAD');
            
            if (response.statusCode === 200) {
                const contentLength = parseInt(response.headers['content-length']) || 0;
                const result = {
                    resolution,
                    url: imageUrl,
                    size: contentLength,
                    sizeKB: Math.round(contentLength / 1024),
                    sizeMB: Math.round(contentLength / (1024 * 1024) * 100) / 100,
                    contentType: response.headers['content-type'],
                    status: 'SUCCESS'
                };
                
                results.push(result);
                console.log(`  ✅ Resolution ${resolution}: ${result.sizeMB}MB (${result.sizeKB}KB)`);
            } else {
                console.log(`  ❌ Resolution ${resolution}: HTTP ${response.statusCode}`);
                results.push({
                    resolution,
                    url: imageUrl,
                    status: `HTTP_${response.statusCode}`
                });
            }
        } catch (error) {
            console.log(`  ❌ Resolution ${resolution}: ${error.message}`);
            results.push({
                resolution,
                url: imageUrl,
                status: `ERROR: ${error.message}`
            });
        }
    }
    
    // Find the highest resolution
    const successfulResults = results.filter(r => r.status === 'SUCCESS');
    const maxResolution = successfulResults.reduce((max, current) => 
        current.size > max.size ? current : max, 
        { size: 0 }
    );
    
    console.log('\n📊 Resolution Analysis Results:');
    console.log('Available resolutions (sorted by file size):');
    
    successfulResults
        .sort((a, b) => b.size - a.size)
        .forEach(result => {
            const indicator = result === maxResolution ? ' 🏆 MAXIMUM' : '';
            console.log(`  ${result.resolution}: ${result.sizeMB}MB${indicator}`);
        });
    
    if (maxResolution.size > 0) {
        console.log(`\n🎯 Recommended resolution level: "${maxResolution.resolution}" (${maxResolution.sizeMB}MB)`);
        
        // Test a few more pages with the maximum resolution
        console.log('\n🧪 Testing maximum resolution with different pages...');
        const testPages = ['00000Vorderdeckel', '003v', '023v', '100r', '200v'];
        
        for (const page of testPages) {
            const testUrl = `${baseUrl}/diglitData/image/${testManuscript}/${maxResolution.resolution}/${page}.jpg`;
            try {
                const response = await makeRequest(testUrl, 'HEAD');
                if (response.statusCode === 200) {
                    const size = Math.round(parseInt(response.headers['content-length'] || 0) / 1024);
                    console.log(`  ${page}: ${size}KB ✅`);
                } else {
                    console.log(`  ${page}: HTTP ${response.statusCode} ❌`);
                }
            } catch (error) {
                console.log(`  ${page}: ${error.message} ❌`);
            }
        }
    }
    
    // Test METS metadata URL
    console.log('\n📄 Testing METS metadata...');
    const metsUrl = `${baseUrl}/diglit/${testManuscript}/mets`;
    try {
        const response = await makeRequest(metsUrl);
        if (response.statusCode === 200) {
            console.log(`  METS metadata available: ${metsUrl} ✅`);
            console.log(`  METS content length: ${Math.round((response.data?.length || 0) / 1024)}KB`);
        } else {
            console.log(`  METS metadata: HTTP ${response.statusCode} ❌`);
        }
    } catch (error) {
        console.log(`  METS metadata error: ${error.message} ❌`);
    }
    
    const finalResults = {
        library: 'University of Freiburg',
        manuscript: testManuscript,
        totalPages: 434,
        resolutionTests: results,
        maximumResolution: maxResolution,
        imageUrlPattern: `${baseUrl}/diglitData/image/{manuscript}/{resolution}/{page}.jpg`,
        viewerUrlPattern: `${baseUrl}/diglit/{manuscript}/{page}`,
        metsUrlPattern: `${baseUrl}/diglit/{manuscript}/mets`,
        pageFormat: 'Variable format (e.g., 003v, 023v, 100r, 200v)',
        recommendations: {
            preferredResolution: maxResolution.resolution || '1',
            avgFileSize: maxResolution.sizeMB || 'Unknown',
            implementationNotes: [
                'Custom page naming (recto/verso with page numbers)',
                'Session ID not required for image access',
                'METS metadata available for page discovery',
                'Multiple resolution levels supported'
            ]
        }
    };
    
    // Save results
    fs.writeFileSync('/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/freiburg-resolution-analysis.json', 
        JSON.stringify(finalResults, null, 2));
    
    console.log('\n✅ Resolution analysis complete. Results saved to .devkit/reports/freiburg-resolution-analysis.json');
    
    return finalResults;
}

function makeRequest(url, method = 'GET') {
    return new Promise((resolve, reject) => {
        const options = {
            method,
            timeout: 15000,
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

testFreiburgResolutions().catch(console.error);