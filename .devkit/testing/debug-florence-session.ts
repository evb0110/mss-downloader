#!/usr/bin/env bun

/**
 * Debug Florence ContentDM session management
 * Investigate why JSESSIONID cookies aren't working for all requests
 */

async function debugFlorenceSession() {
    console.log('🔍 DEBUGGING FLORENCE CONTENTDM SESSION MANAGEMENT');
    console.log('=================================================\n');
    
    // Step 1: Test session establishment
    console.log('📋 Step 1: Testing ContentDM session establishment...');
    
    const collectionUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei';
    
    try {
        const sessionResponse = await fetch(collectionUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': 'https://cdm21059.contentdm.oclc.org/',
                'Cache-Control': 'no-cache'
            }
        });
        
        const setCookie = sessionResponse.headers.get('set-cookie');
        console.log(`Session response status: ${sessionResponse.status}`);
        console.log(`Set-Cookie header: ${setCookie}`);
        
        let sessionCookie = null;
        if (setCookie) {
            const match = setCookie.match(/JSESSIONID=([^;]+)/);
            if (match) {
                sessionCookie = `JSESSIONID=${match[1]}`;
                console.log(`✅ Session cookie extracted: ${sessionCookie.substring(0, 30)}...`);
            } else {
                console.log('❌ No JSESSIONID found in Set-Cookie header');
            }
        } else {
            console.log('❌ No Set-Cookie header received');
        }
        
        // Step 2: Test session usage with different pages
        console.log('\n📋 Step 2: Testing session cookie usage...');
        
        const testPageIds = ['217706', '217707', '217708', '217709', '217710'];
        
        for (const pageId of testPageIds) {
            const pageUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${pageId}/full/4000,/0/default.jpg`;
            
            // Test without session cookie
            const withoutSessionResponse = await fetch(pageUrl, {
                method: 'HEAD',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'image/*,*/*;q=0.8',
                    'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Referer': 'https://cdm21059.contentdm.oclc.org/',
                    'Sec-Fetch-Dest': 'image',
                    'Sec-Fetch-Mode': 'no-cors',
                    'Sec-Fetch-Site': 'same-origin',
                    'DNT': '1'
                }
            });
            
            let withSessionResponse = null;
            if (sessionCookie) {
                withSessionResponse = await fetch(pageUrl, {
                    method: 'HEAD',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                        'Accept': 'image/*,*/*;q=0.8',
                        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
                        'Referer': 'https://cdm21059.contentdm.oclc.org/',
                        'Sec-Fetch-Dest': 'image',
                        'Sec-Fetch-Mode': 'no-cors',
                        'Sec-Fetch-Site': 'same-origin',
                        'DNT': '1',
                        'Cookie': sessionCookie
                    }
                });
            }
            
            const withoutStatus = `${withoutSessionResponse.status} ${withoutSessionResponse.statusText}`;
            const withStatus = withSessionResponse ? `${withSessionResponse.status} ${withSessionResponse.statusText}` : 'No session cookie';
            
            console.log(`Page ${pageId}:`);
            console.log(`   Without session: ${withoutStatus}`);
            console.log(`   With session:    ${withStatus}`);
            
            if (withoutSessionResponse.status === 403 && withSessionResponse && withSessionResponse.ok) {
                console.log(`   ✅ Session cookie fixes 403 error for page ${pageId}`);
            } else if (withoutSessionResponse.ok && withSessionResponse && withSessionResponse.ok) {
                console.log(`   ✅ Both work - page ${pageId} doesn't require session`);
            } else if (withoutSessionResponse.status === 403 && withSessionResponse && withSessionResponse.status === 403) {
                console.log(`   ❌ Session cookie doesn't fix 403 error for page ${pageId}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Step 3: Test rapid sequential access (real download pattern)
        console.log('\n📋 Step 3: Testing rapid sequential access pattern...');
        console.log('This simulates actual download behavior with multiple rapid requests...');
        
        if (sessionCookie) {
            const rapidTestIds = ['217706', '217707', '217708'];
            let rapidSuccessCount = 0;
            
            for (let i = 0; i < rapidTestIds.length; i++) {
                const pageId = rapidTestIds[i];
                const pageUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/plutei:${pageId}/full/4000,/0/default.jpg`;
                
                const response = await fetch(pageUrl, {
                    method: 'HEAD',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                        'Accept': 'image/*,*/*;q=0.8',
                        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
                        'Referer': 'https://cdm21059.contentdm.oclc.org/',
                        'Sec-Fetch-Dest': 'image',
                        'Sec-Fetch-Mode': 'no-cors',
                        'Sec-Fetch-Site': 'same-origin',
                        'DNT': '1',
                        'Cookie': sessionCookie
                    }
                });
                
                if (response.ok) {
                    rapidSuccessCount++;
                    console.log(`   ✅ Rapid test ${i+1}/3 (ID ${pageId}): ${response.status} OK`);
                } else {
                    console.log(`   ❌ Rapid test ${i+1}/3 (ID ${pageId}): ${response.status} ${response.statusText}`);
                }
                
                // Very short delay like production downloads
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            console.log(`\nRapid access results: ${rapidSuccessCount}/3 successful (${Math.round(rapidSuccessCount/3*100)}%)`);
        }
        
        // Step 4: Analysis and recommendations
        console.log('\n📋 Step 4: Session Management Analysis...');
        
        if (!sessionCookie) {
            console.log('❌ CRITICAL: No session cookie obtained from ContentDM');
            console.log('🔧 FIX REQUIRED: Session establishment is failing');
            console.log('   - Check collection URL access');
            console.log('   - Verify ContentDM server returns JSESSIONID');
            console.log('   - ContentDM may not require sessions for this collection');
        } else {
            console.log('✅ Session cookie successfully obtained');
            console.log('⚠️  Session cookie usage may have limitations:');
            console.log('   - ContentDM may enforce rate limiting even with sessions');
            console.log('   - Some pages may not require sessions');
            console.log('   - Rapid sequential access may trigger anti-automation measures');
        }
        
        console.log('\n💡 RECOMMENDATIONS:');
        console.log('1. Verify FlorenceLoader session establishment works correctly');
        console.log('2. Ensure session cookies are passed to all IIIF requests');
        console.log('3. Add longer delays between requests (300-500ms)');
        console.log('4. Consider different session establishment timing');
        console.log('5. Test if session needs to be refreshed during long downloads');
        
    } catch (error) {
        console.error('❌ Session debugging failed:', error);
    }
}

debugFlorenceSession();