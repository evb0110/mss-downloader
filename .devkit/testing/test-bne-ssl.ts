import fetch from 'node-fetch';
import * as https from 'https';

async function test() {
    const url = 'https://bdh-rd.bne.es/pdf.raw?query=id:%220000007619%22&page=1&view=main&lang=es';

    console.log('🔬 Testing BNE PDF URL...\n');
    
    // Test WITHOUT SSL bypass
    console.log('1. Testing WITHOUT SSL bypass:');
    try {
        const response = await fetch(url, { 
            method: 'HEAD',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        console.log('   Status:', response.status);
        console.log('   ⚠️ No SSL error - certificate might be valid now');
    } catch (error: any) {
        console.log('   ❌ Error:', error.message);
        if (error.cause) {
            console.log('   Cause:', error.cause.code);
        }
    }

    // Test WITH SSL bypass
    console.log('\n2. Testing WITH SSL bypass:');
    const agent = new https.Agent({ rejectUnauthorized: false });
    try {
        const response = await fetch(url, { 
            method: 'HEAD',
            agent: agent as any,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        console.log('   Status:', response.status);
        console.log('   Content-Type:', response.headers.get('content-type'));
        console.log('   Content-Length:', response.headers.get('content-length'));
        console.log('   ✅ SSL bypass works!');
        
        // Download full page to verify it's a PDF
        console.log('\n3. Downloading full page:');
        const fullResponse = await fetch(url, {
            agent: agent as any,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const buffer = await fullResponse.buffer();
        const header = buffer.slice(0, 5).toString();
        console.log('   Size:', buffer.length, 'bytes');
        console.log('   PDF header:', header);
        console.log('   Is valid PDF:', header === '%PDF-' ? '✅ YES' : '❌ NO');
        
    } catch (error: any) {
        console.log('   ❌ Error:', error.message);
        if (error.cause) {
            console.log('   Cause:', error.cause.code);
        }
    }
}

test().catch(console.error);