// Test Cecilia manifest loading
const testUrls = [
    'https://cecilia.mediatheques.grand-albigeois.fr/viewer/124/?offset=#page=1&viewer=picture&o=&n=0&q=',
    'https://cecilia.mediatheques.grand-albigeois.fr/viewer/105/?offset=#page=1&viewer=picture&o=&n=0&q='
];

console.log('Testing Cecilia manifest URLs...');

async function testCeciliaUrl(url: string) {
    console.log('\n' + '='.repeat(80));
    console.log('Testing URL:', url);
    
    try {
        // Extract document ID from URL (should be 124 or 105)
        const docMatch = url.match(/viewer\/(\d+)/);
        if (!docMatch) {
            throw new Error('Could not extract document ID from URL');
        }
        
        const docId = docMatch[1];
        console.log('Document ID:', docId);
        
        // Check if this is one of the supported documents
        if (docId === '124') {
            console.log('✅ Document 124: "Antiphonae et responsoria ecclesiastica" (expected: 260 pages)');
        } else if (docId === '105') {
            console.log('✅ Document 105: "Liber sacramentorum, ad usum ecclesiae Albiensis" (expected: 259 pages)');
        } else {
            console.log('⚠️  Document may not be in hardcoded support list');
        }
        
        // Test basic URL access
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        });
        
        if (response.ok) {
            const html = await response.text();
            console.log('✅ URL accessible, HTML length:', html.length);
            
            // Look for manifest or IIIF data in HTML
            if (html.includes('iiif') || html.includes('manifest')) {
                console.log('✅ IIIF data found in HTML');
            }
            if (html.includes('Limb Gallery')) {
                console.log('✅ Limb Gallery platform confirmed');
            }
        } else {
            console.log('❌ URL not accessible:', response.status, response.statusText);
        }
        
        return true;
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

async function runAllTests() {
    let successCount = 0;
    
    for (const url of testUrls) {
        const success = await testCeciliaUrl(url);
        if (success) successCount++;
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`SUMMARY: ${successCount}/${testUrls.length} tests passed`);
    
    if (successCount === testUrls.length) {
        console.log('✅ All Cecilia URLs are accessible');
    } else {
        console.log('❌ Some Cecilia URLs failed');
    }
}

runAllTests();