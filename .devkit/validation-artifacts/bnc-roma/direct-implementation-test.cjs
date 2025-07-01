const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== BNC Roma Direct Implementation Test ===');

const TEST_URL = 'http://digitale.bnc.roma.sbn.it/tecadigitale/libroantico/BVEE112879/BVEE112879/1';
const OUTPUT_DIR = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/validation-artifacts/bnc-roma/direct-test';

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function downloadImage(url, filename) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        
        console.log(`  Downloading: ${url}`);
        
        client.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode} for ${url}`));
                return;
            }
            
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => {
                const buffer = Buffer.concat(chunks);
                fs.writeFileSync(filename, buffer);
                const sizeKB = Math.round(buffer.length / 1024);
                console.log(`    Saved: ${path.basename(filename)} (${sizeKB}KB)`);
                resolve(buffer.length);
            });
        }).on('error', reject);
    });
}

async function testBNCRomaImplementation() {
    console.log(`\nTesting URL: ${TEST_URL}`);
    console.log(`Output: ${OUTPUT_DIR}`);
    
    // Step 1: Test URL parsing (mimicking the service logic)
    console.log('\n1. Testing URL parsing...');
    const urlMatch = TEST_URL.match(/\/(manoscrittoantico|libroantico)\/([^/]+)\/([^/]+)\/(\d+)/);
    if (!urlMatch) {
        throw new Error('URL parsing failed');
    }
    
    const [, collectionType, manuscriptId1, manuscriptId2] = urlMatch;
    console.log(`   Collection: ${collectionType}`);
    console.log(`   Manuscript ID: ${manuscriptId1}`);
    
    if (manuscriptId1 !== manuscriptId2) {
        throw new Error('Inconsistent manuscript ID');
    }
    
    // Step 2: Generate image URLs (exactly as the service does)
    console.log('\n2. Generating image URLs...');
    const imageUrlTemplate = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/${collectionType}/${manuscriptId1}/${manuscriptId1}/PAGENUM/full`;
    console.log(`   Template: ${imageUrlTemplate}`);
    
    // Step 3: Download test images
    console.log('\n3. Downloading test pages...');
    const results = [];
    
    for (let i = 1; i <= 10; i++) {
        const url = imageUrlTemplate.replace('PAGENUM', i.toString());
        const filename = path.join(OUTPUT_DIR, `page_${i.toString().padStart(2, '0')}.jpg`);
        
        try {
            const size = await downloadImage(url, filename);
            results.push({
                page: i,
                url: url,
                filename: path.basename(filename),
                size: size,
                success: true,
                highQuality: size >= 200000
            });
        } catch (error) {
            console.log(`    Failed: ${error.message}`);
            results.push({
                page: i,
                url: url,
                success: false,
                error: error.message
            });
        }
    }
    
    // Step 4: Analyze results
    console.log('\n4. Analysis:');
    const successful = results.filter(r => r.success);
    const highQuality = results.filter(r => r.success && r.highQuality);
    
    console.log(`   Downloads: ${successful.length}/10 successful`);
    console.log(`   High quality: ${highQuality.length}/10 (>200KB)`);
    console.log(`   Success rate: ${Math.round(successful.length/10*100)}%`);
    
    if (successful.length > 0) {
        const avgSize = Math.round(successful.reduce((sum, r) => sum + r.size, 0) / successful.length / 1024);
        console.log(`   Average size: ${avgSize}KB`);
        
        console.log('\n   File details:');
        successful.forEach(r => {
            const quality = r.highQuality ? '[HIGH QUALITY]' : '[Standard]';
            console.log(`     Page ${r.page}: ${Math.round(r.size/1024)}KB ${quality}`);
        });
    }
    
    // Step 5: Create PDF
    console.log('\n5. Creating PDF...');
    if (successful.length > 0) {
        try {
            const imageFiles = successful
                .map(r => path.join(OUTPUT_DIR, r.filename))
                .join(' ');
            
            const pdfPath = path.join(OUTPUT_DIR, 'bnc_roma_implementation_test.pdf');
            execSync(`convert ${imageFiles} "${pdfPath}"`, { stdio: 'pipe' });
            
            const pdfStats = fs.statSync(pdfPath);
            const pdfSizeMB = Math.round(pdfStats.size / 1024 / 1024 * 100) / 100;
            
            console.log(`   PDF created: ${pdfSizeMB}MB`);
            
            // Test with poppler
            try {
                const pdfInfo = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf-8' });
                console.log(`   PDF validation: PASSED`);
                
                // Extract page count
                const pageMatch = pdfInfo.match(/Pages:\s+(\d+)/);
                if (pageMatch) {
                    console.log(`   PDF pages: ${pageMatch[1]}`);
                }
                
            } catch (popplerError) {
                console.log(`   PDF validation: Could not validate with poppler`);
            }
            
        } catch (pdfError) {
            console.log(`   PDF creation failed: ${pdfError.message}`);
        }
    } else {
        console.log(`   No images to create PDF`);
    }
    
    // Step 6: Final assessment
    console.log('\n6. Implementation Assessment:');
    
    const assessmentResult = {
        timestamp: new Date().toISOString(),
        testUrl: TEST_URL,
        urlParsingWorks: true,
        imageUrlGeneration: 'Correct pattern used',
        downloadResults: {
            total: 10,
            successful: successful.length,
            highQuality: highQuality.length,
            successRate: Math.round(successful.length/10*100)
        },
        implementationStatus: successful.length >= 8 ? 'EXCELLENT' : 
                            successful.length >= 5 ? 'GOOD' : 
                            successful.length >= 3 ? 'NEEDS_IMPROVEMENT' : 'BROKEN',
        issues: [],
        recommendations: []
    };
    
    if (successful.length < 8) {
        assessmentResult.issues.push('Success rate below 80%');
    }
    
    if (highQuality.length < 5) {
        assessmentResult.issues.push('Less than 50% high quality images');
    }
    
    if (assessmentResult.issues.length === 0) {
        assessmentResult.recommendations.push('Implementation is working correctly');
    } else {
        assessmentResult.recommendations.push('May need to investigate image quality or server availability');
    }
    
    // Save results
    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'implementation_assessment.json'),
        JSON.stringify(assessmentResult, null, 2)
    );
    
    console.log(`   Status: ${assessmentResult.implementationStatus}`);
    console.log(`   Issues: ${assessmentResult.issues.length > 0 ? assessmentResult.issues.join(', ') : 'None'}`);
    
    return assessmentResult;
}

testBNCRomaImplementation().catch(console.error);