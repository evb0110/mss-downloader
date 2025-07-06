const https = require('https');
const fs = require('fs');

// Analyze METS metadata and page naming patterns for Freiburg
async function analyzeFreiburgMets() {
    console.log('🔍 Analyzing University of Freiburg METS and Page Patterns...\n');
    
    const testManuscript = 'hs360a';
    const baseUrl = 'https://dl.ub.uni-freiburg.de';
    
    // Test METS with redirect following
    console.log('📄 Testing METS metadata with redirect following...');
    const metsUrl = `${baseUrl}/diglit/${testManuscript}/mets`;
    try {
        const response = await makeRequest(metsUrl, 'GET', true); // Follow redirects
        if (response.statusCode === 200) {
            console.log(`  METS metadata available: ${response.finalUrl || metsUrl} ✅`);
            console.log(`  METS content length: ${Math.round((response.data?.length || 0) / 1024)}KB`);
            
            // Try to extract page information from METS
            const metsContent = response.data;
            if (metsContent) {
                const pageMatches = metsContent.match(/ID="[^"]*"/g) || [];
                const fileMatches = metsContent.match(/HREF="[^"]*\.jpg"/g) || [];
                
                console.log(`  Found ${pageMatches.length} page IDs in METS`);
                console.log(`  Found ${fileMatches.length} image file references`);
                
                // Extract some image filenames
                const imageFiles = fileMatches.slice(0, 10).map(match => 
                    match.replace('HREF="', '').replace('"', '')
                );
                
                console.log('  Sample image filenames:');
                imageFiles.forEach(file => console.log(`    ${file}`));
            }
        } else {
            console.log(`  METS metadata: HTTP ${response.statusCode} ❌`);
        }
    } catch (error) {
        console.log(`  METS metadata error: ${error.message} ❌`);
    }
    
    // Test various page naming patterns
    console.log('\n🔤 Testing page naming patterns...');
    const pagePatterns = [
        // Front matter
        '00000Vorderdeckel', '00001Vorsatz', '00002Vorsatz',
        // Page numbers with r/v
        '001r', '001v', '002r', '002v', '003r', '003v',
        // Zero-padded
        '0001', '0002', '0003', '0010', '0050', '0100',
        // Different formats  
        '1r', '1v', '2r', '2v', '10r', '10v',
        // Special pages
        '432r', '432v', '433r', '433v', '434r', '434v',
        '00434Hinterdeckel', 'Hinterdeckel'
    ];
    
    const workingPatterns = [];
    const resolution = '4'; // Use maximum resolution found
    
    for (const pattern of pagePatterns) {
        const imageUrl = `${baseUrl}/diglitData/image/${testManuscript}/${resolution}/${pattern}.jpg`;
        
        try {
            const response = await makeRequest(imageUrl, 'HEAD');
            if (response.statusCode === 200) {
                const size = Math.round(parseInt(response.headers['content-length'] || 0) / 1024);
                workingPatterns.push({
                    pattern,
                    size: size,
                    url: imageUrl
                });
                console.log(`  ✅ ${pattern}: ${size}KB`);
            } else {
                console.log(`  ❌ ${pattern}: HTTP ${response.statusCode}`);
            }
        } catch (error) {
            console.log(`  ❌ ${pattern}: ${error.message}`);
        }
    }
    
    // Test thumbnails/image endpoint
    console.log('\n🖼️  Testing image endpoint alternatives...');
    const alternativeEndpoints = [
        `/diglit/${testManuscript}/0010/image`,
        `/diglit/${testManuscript}/0010/thumbs`,
        `/diglitData/image/${testManuscript}/thumb/003v.jpg`,
        `/diglitData/image/${testManuscript}/preview/003v.jpg`
    ];
    
    for (const endpoint of alternativeEndpoints) {
        const fullUrl = baseUrl + endpoint;
        try {
            const response = await makeRequest(fullUrl, 'HEAD');
            console.log(`  ${endpoint}: HTTP ${response.statusCode} ${response.statusCode === 200 ? '✅' : '❌'}`);
        } catch (error) {
            console.log(`  ${endpoint}: ${error.message} ❌`);
        }
    }
    
    // Analyze page structure from working patterns
    const pageTypes = {
        frontMatter: workingPatterns.filter(p => p.pattern.includes('Vorder') || p.pattern.includes('Vorsatz')),
        rectoVerso: workingPatterns.filter(p => p.pattern.match(/\d+[rv]$/)),
        numbered: workingPatterns.filter(p => p.pattern.match(/^\d+$/)),
        backMatter: workingPatterns.filter(p => p.pattern.includes('Hinter'))
    };
    
    const analysis = {
        library: 'University of Freiburg',
        manuscript: testManuscript,
        totalPagesKnown: 434,
        maximumResolution: 4,
        avgFileSizeMB: Math.round(workingPatterns.reduce((sum, p) => sum + p.size, 0) / workingPatterns.length / 1024 * 100) / 100,
        pageNamingPatterns: {
            frontMatter: pageTypes.frontMatter.map(p => p.pattern),
            rectoVerso: pageTypes.rectoVerso.map(p => p.pattern),
            numbered: pageTypes.numbered.map(p => p.pattern),
            backMatter: pageTypes.backMatter.map(p => p.pattern)
        },
        workingPatterns: workingPatterns,
        urlStructure: {
            viewer: `${baseUrl}/diglit/{manuscript}/{page}`,
            image: `${baseUrl}/diglitData/image/{manuscript}/{resolution}/{pageId}.jpg`,
            mets: `${baseUrl}/diglit/{manuscript}/mets`,
            resolutionLevels: ['1', '2', '3', '4'],
            maxResolution: '4'
        },
        implementationStrategy: {
            pageDiscovery: 'METS XML parsing or systematic pattern testing',
            pageNumbering: 'Variable format (recto/verso with descriptive names)',
            authenticationRequired: false,
            sessionHandling: 'None required for images',
            metadataAccess: 'METS XML available',
            qualityOptimization: 'Use resolution level 4 for maximum quality'
        }
    };
    
    console.log('\n📊 Final Analysis:');
    console.log(JSON.stringify(analysis, null, 2));
    
    // Save comprehensive analysis
    fs.writeFileSync('/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/freiburg-comprehensive-analysis.json', 
        JSON.stringify(analysis, null, 2));
    
    console.log('\n✅ Comprehensive analysis complete. Results saved to .devkit/reports/freiburg-comprehensive-analysis.json');
    
    return analysis;
}

function makeRequest(url, method = 'GET', followRedirects = false) {
    return new Promise((resolve, reject) => {
        let finalUrl = url;
        
        const makeReq = (currentUrl, redirectCount = 0) => {
            if (redirectCount > 5) {
                reject(new Error('Too many redirects'));
                return;
            }
            
            const options = {
                method,
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            };
            
            const req = https.request(currentUrl, options, (res) => {
                finalUrl = currentUrl;
                
                if (followRedirects && [301, 302, 303, 307, 308].includes(res.statusCode)) {
                    const location = res.headers.location;
                    if (location) {
                        const newUrl = location.startsWith('http') ? location : 
                                      new URL(location, currentUrl).toString();
                        makeReq(newUrl, redirectCount + 1);
                        return;
                    }
                }
                
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: data,
                        finalUrl: finalUrl
                    });
                });
            });
            
            req.on('error', reject);
            req.on('timeout', () => reject(new Error('Request timeout')));
            req.end();
        };
        
        makeReq(url);
    });
}

analyzeFreiburgMets().catch(console.error);