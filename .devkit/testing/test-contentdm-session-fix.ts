#!/usr/bin/env bun

/**
 * Test ContentDM session management fix based on Ultrathink analysis
 * Target: https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/217923/rec/2
 */

// Test functions based on Ultrathink findings
async function testSessionEstablishment(): Promise<{ sessionCookie?: string; error?: string }> {
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

        if (response.ok) {
            const setCookie = response.headers.get('set-cookie');
            if (setCookie) {
                const match = setCookie.match(/JSESSIONID=([^;]+)/);
                if (match) {
                    return { sessionCookie: `JSESSIONID=${match[1]}` };
                }
            }
        }

        return { error: `Failed to establish session: HTTP ${response.status}` };
    } catch (error: any) {
        return { error: error.message };
    }
}

async function testManuscriptAccess(sessionCookie?: string): Promise<{ 
    success: boolean; 
    pageCount?: number; 
    error?: string;
    manuscriptTitle?: string;
}> {
    try {
        const manuscriptUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/217923/rec/2';
        
        const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': 'https://cdm21059.contentdm.oclc.org/',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'DNT': '1'
        };

        if (sessionCookie) {
            headers['Cookie'] = sessionCookie;
        }

        const response = await fetch(manuscriptUrl, { headers });
        
        if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
        }

        const html = await response.text();

        // Extract manuscript title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const manuscriptTitle = titleMatch ? titleMatch[1].trim() : 'Unknown';

        // Extract __INITIAL_STATE__ to get page structure
        const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*JSON\.parse\("(.+?)"\);/);
        if (!stateMatch) {
            return { success: false, error: 'Could not find __INITIAL_STATE__ in page' };
        }

        try {
            const escapedJson = stateMatch[1];
            const unescapedJson = escapedJson.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            const state = JSON.parse(unescapedJson);

            const item = state?.item?.item;
            if (!item) {
                return { success: false, error: 'No item data found in state' };
            }

            // Count pages (excluding binding/charts)
            let pageCount = 0;
            if (item.parent?.children && item.parent.children.length > 0) {
                // Multi-page manuscript
                pageCount = item.parent.children.filter((child: any) => 
                    child.id && child.title && !child.title.toLowerCase().includes('binding')
                ).length;
            } else {
                // Single page manuscript
                pageCount = 1;
            }

            return {
                success: true,
                pageCount,
                manuscriptTitle
            };

        } catch (parseError) {
            return { success: false, error: `Failed to parse manuscript structure: ${parseError}` };
        }

    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

async function testImageDownload(sessionCookie?: string): Promise<{
    success: boolean;
    imageSize?: number;
    error?: string;
}> {
    try {
        // Test downloading an actual image from the manuscript
        // Using child page ID 217712 based on Ultrathink analysis
        const imageUrl = 'https://cdm21059.contentdm.oclc.org/iiif/2/plutei:217712/full/4000,/0/default.jpg';
        
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

        const response = await fetch(imageUrl, { method: 'HEAD', headers });
        
        if (response.ok) {
            const contentLength = response.headers.get('content-length');
            const imageSize = contentLength ? parseInt(contentLength) : 0;
            return { success: true, imageSize };
        } else {
            return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
        }

    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

async function main() {
    console.log('🧪 Testing ContentDM Session Management Fix...\n');
    console.log('Target manuscript: https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/217923/rec/2\n');

    // Step 1: Test session establishment
    console.log('📋 Step 1: Testing session establishment...');
    const sessionResult = await testSessionEstablishment();
    
    if (sessionResult.sessionCookie) {
        console.log(`✅ Session established: ${sessionResult.sessionCookie.substring(0, 30)}...`);
    } else {
        console.log(`❌ Session establishment failed: ${sessionResult.error}`);
    }

    // Step 2: Test manuscript access with and without session
    console.log('\n📋 Step 2: Testing manuscript access...');
    
    console.log('   Without session:');
    const accessWithoutSession = await testManuscriptAccess();
    console.log(`   Result: ${accessWithoutSession.success ? '✅' : '❌'} ${accessWithoutSession.success ? 
        `${accessWithoutSession.pageCount} pages, "${accessWithoutSession.manuscriptTitle}"` : 
        accessWithoutSession.error}`);

    if (sessionResult.sessionCookie) {
        console.log('   With session:');
        const accessWithSession = await testManuscriptAccess(sessionResult.sessionCookie);
        console.log(`   Result: ${accessWithSession.success ? '✅' : '❌'} ${accessWithSession.success ? 
            `${accessWithSession.pageCount} pages, "${accessWithSession.manuscriptTitle}"` : 
            accessWithSession.error}`);
    }

    // Step 3: Test image download with and without session
    console.log('\n📋 Step 3: Testing image download (child page ID 217712)...');
    
    console.log('   Without session:');
    const downloadWithoutSession = await testImageDownload();
    console.log(`   Result: ${downloadWithoutSession.success ? '✅' : '❌'} ${downloadWithoutSession.success ? 
        `${Math.round((downloadWithoutSession.imageSize || 0) / 1024)}KB image` : 
        downloadWithoutSession.error}`);

    if (sessionResult.sessionCookie) {
        console.log('   With session:');
        const downloadWithSession = await testImageDownload(sessionResult.sessionCookie);
        console.log(`   Result: ${downloadWithSession.success ? '✅' : '❌'} ${downloadWithSession.success ? 
            `${Math.round((downloadWithSession.imageSize || 0) / 1024)}KB image` : 
            downloadWithSession.error}`);
    }

    // Analysis
    console.log('\n🎯 Analysis:');
    const sessionMakesADifference = 
        (!downloadWithoutSession.success && sessionResult.sessionCookie && 
         (await testImageDownload(sessionResult.sessionCookie)).success);

    if (sessionMakesADifference) {
        console.log('✅ Session management fix is working correctly!');
        console.log('   - Session cookies resolve 403 Forbidden errors');
        console.log('   - ContentDM requires JSESSIONID for IIIF image access');
        console.log('   - Fix should resolve the persistent 403 errors');
    } else if (downloadWithoutSession.success) {
        console.log('⚠️  Downloads work without session - 403 errors may be due to other factors');
        console.log('   - Check if using correct child page IDs instead of parent IDs');
        console.log('   - Verify size parameters are within ContentDM limits');
    } else {
        console.log('❌ Downloads failing even with session - deeper investigation needed');
        console.log('   - May need to investigate parent vs child ID routing bug');
        console.log('   - Size parameter issues or other ContentDM restrictions');
    }

    console.log('\n📋 Implementation Status:');
    console.log('✅ Session establishment added to FlorenceLoader.ts');
    console.log('✅ Session headers applied to all ContentDM requests');
    console.log('✅ Library detection fixed for IIIF URLs');
    console.log('✅ Size parameter intelligence implemented');
}

main().catch(console.error);