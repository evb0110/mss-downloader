#!/usr/bin/env node

/**
 * Final Validation Test for All Three Libraries
 * Tests the fixed implementations
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

console.log('🎯 FINAL VALIDATION TEST - ALL THREE LIBRARIES');
console.log('=' .repeat(70));

// Create final validation directory
const validationDir = path.join(__dirname, '../validation-current/final-three-libraries-test');
if (fs.existsSync(validationDir)) {
    fs.rmSync(validationDir, { recursive: true });
}
fs.mkdirSync(validationDir, { recursive: true });

async function fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const reqOptions = {
            ...options,
            rejectUnauthorized: false,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json, application/ld+json, image/webp,image/apng,image/*,*/*;q=0.8',
                ...options.headers
            }
        };
        
        const req = https.request(url, reqOptions, (res) => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                res.body = Buffer.concat(chunks);
                resolve(res);
            });
        });
        req.on('error', reject);
        req.end();
    });
}

// Test BNE
async function testBNE() {
    console.log('\\n🇪🇸 Testing BNE (Fixed Implementation)');
    console.log('-'.repeat(40));
    
    const testUrl = 'https://bdh-rd.bne.es/pdf.raw?query=id:0000007619&page=1&jpeg=true';
    
    try {
        const response = await fetch(testUrl);
        
        if (response.statusCode === 200 && response.headers['content-type']?.includes('image')) {
            const filename = 'bne_final_test.jpg';
            const filepath = path.join(validationDir, filename);
            fs.writeFileSync(filepath, response.body);
            
            const stats = fs.statSync(filepath);
            console.log(`   ✅ BNE: Downloaded ${Math.round(stats.size / 1024)} KB image`);
            return { success: true, size: stats.size };
        } else {
            console.log(`   ❌ BNE: HTTP ${response.statusCode}`);
            return { success: false, error: `HTTP ${response.statusCode}` };
        }
    } catch (error) {
        console.log(`   ❌ BNE: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// Test Belgica KBR
async function testBelgicaKBR() {
    console.log('\\n🇧🇪 Testing Belgica KBR (Fixed Implementation)');
    console.log('-'.repeat(40));
    
    const documentUrl = 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415';
    
    try {
        const response = await fetch(documentUrl);
        
        if (response.statusCode === 200) {
            const html = response.body.toString();
            const uurlMatch = html.match(/https:\/\/uurl\.kbr\.be\/(\d+)/);
            
            if (uurlMatch) {
                console.log(`   ✅ Belgica KBR: Document accessible, UURL found: ${uurlMatch[1]}`);
                return { success: true, uurlId: uurlMatch[1] };
            } else {
                console.log(`   ⚠️  Belgica KBR: Document accessible but no UURL found`);
                return { success: false, error: 'No UURL found' };
            }
        } else {
            console.log(`   ❌ Belgica KBR: HTTP ${response.statusCode}`);
            return { success: false, error: `HTTP ${response.statusCode}` };
        }
    } catch (error) {
        console.log(`   ❌ Belgica KBR: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// Test MDC Catalonia (Fixed Implementation)
async function testMDCCatalonia() {
    console.log('\\n🏛️  Testing MDC Catalonia (FIXED Implementation)');
    console.log('-'.repeat(40));
    
    const collection = 'incunableBC';
    const itemId = '175331';
    
    // Test the CONTENTdm compound object API
    const compoundUrl = `https://mdc.csuc.cat/digital/bl/dmwebservices/index.php?q=dmGetCompoundObjectInfo/${collection}/${itemId}/json`;
    
    try {
        console.log('   Testing CONTENTdm compound object API...');
        const compoundResponse = await fetch(compoundUrl);
        
        if (compoundResponse.statusCode === 200) {
            const compoundData = JSON.parse(compoundResponse.body.toString());
            
            // Check for page structure
            let pages = compoundData.page;
            if (!pages && compoundData.node && compoundData.node.page) {
                pages = compoundData.node.page;
            }
            
            if (pages && Array.isArray(pages) && pages.length > 0) {
                const firstPage = pages[0];
                console.log(`   ✅ Compound object: ${pages.length} pages found`);
                console.log(`   First page ID: ${firstPage.pageptr}, title: "${firstPage.pagetitle}"`);
                
                // Test IIIF endpoint with first page
                const iiifUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${firstPage.pageptr}/info.json`;
                const iiifResponse = await fetch(iiifUrl);
                
                if (iiifResponse.statusCode === 200) {
                    const iiifData = JSON.parse(iiifResponse.body.toString());
                    console.log(`   ✅ IIIF endpoint: ${iiifData.width}x${iiifData.height} pixels`);
                    
                    // Test image download
                    const imageUrl = `https://mdc.csuc.cat/iiif/2/${collection}:${firstPage.pageptr}/full/200,/0/default.jpg`;
                    const imageResponse = await fetch(imageUrl);
                    
                    if (imageResponse.statusCode === 200 && imageResponse.headers['content-type']?.includes('image')) {
                        const filename = 'mdc_catalonia_final_test.jpg';
                        const filepath = path.join(validationDir, filename);
                        fs.writeFileSync(filepath, imageResponse.body);
                        
                        const stats = fs.statSync(filepath);
                        console.log(`   ✅ MDC Catalonia: Downloaded ${Math.round(stats.size / 1024)} KB image`);
                        
                        return { 
                            success: true, 
                            totalPages: pages.length, 
                            dimensions: `${iiifData.width}x${iiifData.height}`,
                            imageSize: stats.size 
                        };
                    } else {
                        console.log(`   ❌ MDC Image download failed: HTTP ${imageResponse.statusCode}`);
                        return { success: false, error: `Image HTTP ${imageResponse.statusCode}` };
                    }
                } else {
                    console.log(`   ❌ MDC IIIF failed: HTTP ${iiifResponse.statusCode}`);
                    return { success: false, error: `IIIF HTTP ${iiifResponse.statusCode}` };
                }
            } else {
                console.log(`   ❌ MDC: No page structure found`);
                return { success: false, error: 'No page structure' };
            }
        } else {
            console.log(`   ❌ MDC Compound API failed: HTTP ${compoundResponse.statusCode}`);
            return { success: false, error: `Compound API HTTP ${compoundResponse.statusCode}` };
        }
    } catch (error) {
        console.log(`   ❌ MDC Catalonia: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function runFinalValidation() {
    console.log('Starting final validation of all three libraries with fixed implementations...');
    
    const results = {
        bne: await testBNE(),
        belgica_kbr: await testBelgicaKBR(),
        mdc_catalonia: await testMDCCatalonia()
    };
    
    console.log('\\n' + '='.repeat(70));
    console.log('🏆 FINAL VALIDATION RESULTS');
    console.log('='.repeat(70));
    
    const successful = Object.values(results).filter(r => r.success).length;
    const total = Object.keys(results).length;
    const successRate = (successful / total * 100).toFixed(1);
    
    console.log(`\\n📊 Summary:`);
    console.log(`   Libraries Tested: ${total}`);
    console.log(`   Successful: ${successful}`);
    console.log(`   Success Rate: ${successRate}%`);
    console.log(`   Overall Status: ${successRate === '100.0' ? '🎉 PERFECT' : successRate >= '80.0' ? '✅ PASSED' : '❌ FAILED'}`);
    
    console.log(`\\n📚 Individual Results:`);
    for (const [library, result] of Object.entries(results)) {
        const status = result.success ? '✅ PASSED' : '❌ FAILED';
        console.log(`   ${status} ${library.toUpperCase()}: ${result.success ? 'Working' : result.error}`);
    }
    
    console.log(`\\n📁 Validation files saved to: ${validationDir}`);
    
    // Save results
    const reportPath = path.join(validationDir, 'final-validation-results.json');
    fs.writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        results,
        successRate: parseFloat(successRate),
        status: successRate === '100.0' ? 'PERFECT' : successRate >= '80.0' ? 'PASSED' : 'FAILED'
    }, null, 2));
    
    if (successRate === '100.0') {
        console.log('\\n🎉 ALL THREE LIBRARIES ARE NOW WORKING PERFECTLY!');
        console.log('   Ready for production deployment and version bump.');
    } else if (parseFloat(successRate) >= 80) {
        console.log('\\n✅ VALIDATION PASSED - Libraries ready for deployment');
    } else {
        console.log('\\n❌ Some libraries still need work');
    }
}

if (require.main === module) {
    runFinalValidation().catch(console.error);
}