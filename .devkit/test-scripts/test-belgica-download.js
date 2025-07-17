const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

async function testBelgicaDownload() {
    // From the analysis, we found the pattern:
    // https://viewerd.kbr.be/display/A/1/5/8/9/4/8/5/0000-00-00_00/zoomthumb/BE-KBR00_A-1589485_0000-00-00_00_0001_600x400.jpg
    // Let's try to get higher resolution versions
    
    const baseUrl = 'https://viewerd.kbr.be/display/A/1/5/8/9/4/8/5/0000-00-00_00/';
    const manuscript = 'BE-KBR00_A-1589485_0000-00-00_00';
    
    // Test different resolution folders
    const resolutionTests = [
        'zoomthumb', // We know this works (600x400)
        'zoom',
        'high',
        'full',
        'max',
        'original',
        'zoommax',
        'hires'
    ];
    
    const results = [];
    
    console.log('Testing different resolution paths...\n');
    
    for (const res of resolutionTests) {
        const url = `${baseUrl}${res}/${manuscript}_0001_600x400.jpg`;
        console.log(`Testing ${res}:`, url);
        
        try {
            const response = await axios.head(url, {
                timeout: 5000,
                validateStatus: () => true
            });
            
            results.push({
                resolution: res,
                url,
                status: response.status,
                contentType: response.headers['content-type'],
                contentLength: response.headers['content-length']
            });
            
            console.log(`  Status: ${response.status}, Size: ${response.headers['content-length'] || 'unknown'}`);
        } catch (error) {
            console.log(`  Error: ${error.message}`);
        }
    }
    
    // Try different size suffixes
    console.log('\nTesting different size formats...\n');
    
    const sizeTests = [
        '_600x400',
        '_1200x800',
        '_2400x1600',
        '_max',
        '_full',
        '', // no suffix
        '_original'
    ];
    
    for (const size of sizeTests) {
        const url = `${baseUrl}zoomthumb/${manuscript}_0001${size}.jpg`;
        console.log(`Testing size ${size || 'no suffix'}:`, url);
        
        try {
            const response = await axios.head(url, {
                timeout: 5000,
                validateStatus: () => true
            });
            
            if (response.status === 200) {
                console.log(`  SUCCESS! Size: ${response.headers['content-length'] || 'unknown'}`);
                results.push({
                    size,
                    url,
                    status: response.status,
                    contentLength: response.headers['content-length']
                });
            } else {
                console.log(`  Status: ${response.status}`);
            }
        } catch (error) {
            console.log(`  Error: ${error.message}`);
        }
    }
    
    // Try to find the original/max resolution path
    console.log('\nTrying to find high-res image paths...\n');
    
    // AJAX Zoom typically uses these patterns
    const ajaxZoomPaths = [
        `${baseUrl}zoom/${manuscript}_0001.jpg`,
        `${baseUrl}zoomoriginal/${manuscript}_0001.jpg`,
        `${baseUrl}original/${manuscript}_0001.jpg`,
        `${baseUrl}source/${manuscript}_0001.jpg`,
        `${baseUrl}master/${manuscript}_0001.jpg`
    ];
    
    for (const url of ajaxZoomPaths) {
        console.log(`Testing:`, url);
        
        try {
            const response = await axios.head(url, {
                timeout: 5000,
                validateStatus: () => true
            });
            
            if (response.status === 200) {
                console.log(`  FOUND! Size: ${response.headers['content-length'] || 'unknown'}`);
                
                // Download this one to check
                const imageResponse = await axios.get(url, {
                    responseType: 'arraybuffer'
                });
                
                const filename = path.join(__dirname, '../../.devkit/test-outputs/belgica-test-highres.jpg');
                await fs.mkdir(path.dirname(filename), { recursive: true });
                await fs.writeFile(filename, imageResponse.data);
                console.log(`  Downloaded to: ${filename}`);
            } else {
                console.log(`  Status: ${response.status}`);
            }
        } catch (error) {
            console.log(`  Error: ${error.message}`);
        }
    }
    
    // Download a few pages with the working resolution
    console.log('\nDownloading sample pages...\n');
    
    const outputDir = path.join(__dirname, '../../.devkit/test-outputs/belgica-samples');
    await fs.mkdir(outputDir, { recursive: true });
    
    for (let i = 1; i <= 10; i++) {
        const pageNum = String(i).padStart(4, '0');
        const url = `${baseUrl}zoomthumb/${manuscript}_${pageNum}_600x400.jpg`;
        
        try {
            console.log(`Downloading page ${i}...`);
            const response = await axios.get(url, {
                responseType: 'arraybuffer'
            });
            
            const filename = path.join(outputDir, `page_${pageNum}.jpg`);
            await fs.writeFile(filename, response.data);
            console.log(`  Saved: ${filename}`);
        } catch (error) {
            console.log(`  Error: ${error.message}`);
        }
    }
    
    // Save analysis results
    await fs.writeFile(
        path.join(__dirname, '../../.devkit/reports/belgica-download-analysis.json'),
        JSON.stringify({
            manuscript: 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415',
            baseUrl,
            manuscriptId: manuscript,
            results,
            workingPattern: `${baseUrl}zoomthumb/${manuscript}_{pageNum}_600x400.jpg`,
            notes: 'AJAX Zoom system with thumbnails available. Need to find high-res access method.'
        }, null, 2)
    );
    
    console.log('\nAnalysis complete. Check .devkit/test-outputs/ for downloaded samples.');
}

testBelgicaDownload().catch(console.error);