const https = require('https');

async function checkAPIResponse() {
    console.log('🔬 Checking BDL API response structure...\n');
    
    const apiUrl = 'https://www.bdl.servizirl.it/bdl/public/rest/json/item/3903/bookreader/pages';
    
    return new Promise((resolve, reject) => {
        https.get(apiUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        }, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                try {
                    const pages = JSON.parse(data);
                    console.log(`Total pages in API response: ${pages.length}\n`);
                    
                    // Analyze first few pages
                    console.log('First 3 pages:');
                    for (let i = 0; i < Math.min(3, pages.length); i++) {
                        console.log(`Page ${i + 1}:`, JSON.stringify(pages[i], null, 2));
                    }
                    
                    // Check for pages without idMediaServer
                    const pagesWithMedia = pages.filter(p => p.idMediaServer);
                    const pagesWithoutMedia = pages.filter(p => !p.idMediaServer);
                    
                    console.log('\n📊 Statistics:');
                    console.log(`  Pages with idMediaServer: ${pagesWithMedia.length}`);
                    console.log(`  Pages WITHOUT idMediaServer: ${pagesWithoutMedia.length}`);
                    
                    if (pagesWithoutMedia.length > 0) {
                        console.log('\n⚠️ FOUND PAGES WITHOUT MEDIA!');
                        console.log('Sample of pages without media:');
                        pagesWithoutMedia.slice(0, 3).forEach((page, idx) => {
                            console.log(`  ${JSON.stringify(page)}`);
                        });
                    }
                    
                    // Check for duplicates
                    const mediaIds = pagesWithMedia.map(p => p.idMediaServer);
                    const uniqueIds = new Set(mediaIds);
                    if (mediaIds.length !== uniqueIds.size) {
                        console.log(`\n⚠️ DUPLICATE MEDIA IDs: ${mediaIds.length - uniqueIds.size} duplicates found`);
                    }
                    
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', reject);
    });
}

checkAPIResponse().catch(console.error);