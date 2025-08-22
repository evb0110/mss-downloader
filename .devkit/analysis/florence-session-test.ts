#!/usr/bin/env bun

/**
 * FLORENCE SESSION TEST
 * 
 * The app establishes a ContentDM session before validation,
 * but my test didn't. Let's test with session establishment.
 */

console.log('🔐 FLORENCE SESSION ESTABLISHMENT TEST');
console.log('Testing if session cookies make the difference...');
console.log('═'.repeat(50));

let sessionCookie: string | null = null;

async function establishSession(): Promise<void> {
    console.log('\n🔑 Establishing ContentDM session...');
    
    try {
        const collectionUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei';
        const response = await fetch(collectionUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': 'https://cdm21059.contentdm.oclc.org/',
                'Cache-Control': 'no-cache'
            }
        });

        // Extract JSESSIONID from set-cookie headers
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
            const match = setCookie.match(/JSESSIONID=([^;]+)/);
            if (match) {
                sessionCookie = `JSESSIONID=${match[1]}`;
                console.log(`✅ Session established: ${sessionCookie}`);
            } else {
                console.log('⚠️ No JSESSIONID found in set-cookie header');
            }
        } else {
            console.log('⚠️ No set-cookie header found');
        }
    } catch (error) {
        console.log(`❌ Session establishment failed: ${error}`);
    }
}

function getSessionHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'image/*,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://cdm21059.contentdm.oclc.org/',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'same-origin',
        'DNT': '1'
    };

    if (sessionCookie) {
        headers['Cookie'] = sessionCookie;
    }

    return headers;
}

async function testWithSession() {
    console.log('\n🧪 Testing problematic pages WITH session...');
    
    const problematicPageIds = ['217707', '217709', '217711', '217713', '217715'];
    const collection = 'plutei';
    
    for (const pageId of problematicPageIds) {
        console.log(`\n📄 Testing page ${pageId} with session:`);
        
        // Test with session headers
        const imageUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${pageId}/full/4000,/0/default.jpg`;
        
        try {
            const response = await fetch(imageUrl, {
                headers: getSessionHeaders()
            });
            
            if (response.ok) {
                const buffer = await response.arrayBuffer();
                console.log(`  ✅ SUCCESS with session: ${buffer.byteLength} bytes`);
            } else {
                console.log(`  ❌ Failed with session: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.log(`  ❌ Error with session: ${error}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

async function compareValidationMethods() {
    console.log('\n🔍 COMPARING VALIDATION METHODS...');
    
    const testPageId = '217707';
    const collection = 'plutei';
    
    console.log(`\nTesting page ${testPageId}:`);
    
    // Method 1: info.json HEAD request (what FlorenceLoader does for validation)
    console.log('\n1️⃣ Method 1: info.json HEAD request (FlorenceLoader validation)');
    const infoUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${testPageId}/info.json`;
    
    try {
        const infoResponse = await fetch(infoUrl, {
            method: 'HEAD',
            headers: getSessionHeaders()
        });
        console.log(`   Result: ${infoResponse.status} ${infoResponse.statusText}`);
        
        if (infoResponse.status === 403 || infoResponse.status === 501) {
            console.log(`   ❌ Would be FILTERED OUT by validation`);
        } else {
            console.log(`   ✅ Would PASS validation`);
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error}`);
    }
    
    // Method 2: Actual image GET request (what app does during download)
    console.log('\n2️⃣ Method 2: Actual image GET request (App download behavior)');
    const imageUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${testPageId}/full/4000,/0/default.jpg`;
    
    try {
        const imageResponse = await fetch(imageUrl, {
            headers: getSessionHeaders()
        });
        console.log(`   Result: ${imageResponse.status} ${imageResponse.statusText}`);
        
        if (imageResponse.ok) {
            const buffer = await imageResponse.arrayBuffer();
            console.log(`   ✅ Download would SUCCEED: ${buffer.byteLength} bytes`);
        } else {
            console.log(`   ❌ Download would FAIL`);
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error}`);
    }
    
    // Method 3: Different image sizes
    console.log('\n3️⃣ Method 3: Testing different image sizes');
    const sizes = ['800', '1024', '2000', '4000', 'max', 'full'];
    
    for (const size of sizes) {
        const sizeUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${testPageId}/full/${size},/0/default.jpg`;
        
        try {
            const response = await fetch(sizeUrl, {
                method: 'HEAD',
                headers: getSessionHeaders()
            });
            console.log(`   ${size}: ${response.status} ${response.statusText}`);
        } catch (error) {
            console.log(`   ${size}: Error - ${error}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
    }
}

async function runFullAnalysis() {
    try {
        await establishSession();
        await testWithSession();
        await compareValidationMethods();
        
        console.log('\n═'.repeat(50));
        console.log('📊 FINAL ANALYSIS:');
        console.log('\nThe discrepancy between 215 pages discovered and 210 validated');
        console.log('is likely due to different validation approaches:');
        console.log('');
        console.log('🔍 VALIDATION: Uses HEAD requests to info.json');
        console.log('📥 DOWNLOAD: Uses GET requests to actual images');
        console.log('');
        console.log('Some pages may fail validation but succeed in download');
        console.log('due to different server behavior for different endpoints.');
        
    } catch (error) {
        console.error('Analysis failed:', error);
    }
}

runFullAnalysis().catch(console.error);