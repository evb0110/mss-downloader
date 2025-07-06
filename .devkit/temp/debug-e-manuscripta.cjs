#!/usr/bin/env node

async function debugEManuscripta() {
    console.log('🔍 Debugging e-manuscripta.ch response...\n');
    
    const testUrl = 'https://www.e-manuscripta.ch/zuzcmi/content/zoom/3229497';
    
    try {
        const response = await fetch(testUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        });
        
        console.log(`Status: ${response.status} ${response.statusText}`);
        console.log(`Content-Type: ${response.headers.get('content-type')}`);
        console.log(`Content-Length: ${response.headers.get('content-length')}`);
        
        const html = await response.text();
        console.log(`\nActual content length: ${html.length} chars`);
        console.log('\nFirst 500 chars of response:');
        console.log('=' .repeat(50));
        console.log(html.substring(0, 500));
        console.log('=' .repeat(50));
        
        if (html.includes('goToPage')) {
            console.log('\n✅ Contains goToPage element');
        } else {
            console.log('\n❌ Does not contain goToPage element');
        }
        
        if (html.includes('redirect') || html.includes('location.href')) {
            console.log('⚠️ Appears to be a redirect page');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugEManuscripta().catch(console.error);