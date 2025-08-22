#!/usr/bin/env bun

/**
 * FLORENCE DISCREPANCY ANALYSIS
 * 
 * MISSION: Investigate why app discovers 215 pages but filtering reduces to 210
 * 
 * This script compares:
 * 1. FlorenceLoader validation logic (filters 403/501 errors)
 * 2. App download behavior (retries with enhanced headers + session management)
 * 3. Which 5 pages are filtered out and why app successfully downloads them
 */

interface FlorenceField {
    key: string;
    value: string;
}

interface FlorenceChild {
    id: number;
    title?: string;
}

interface FlorenceParent {
    children?: FlorenceChild[];
    fields?: FlorenceField[];
}

interface FlorenceItemData {
    parentId?: number;
    parent?: FlorenceParent;
    fields?: FlorenceField[];
    title?: string;
}

interface FlorenceState {
    item?: {
        item?: FlorenceItemData;
        children?: FlorenceChild[];
    };
}

console.log('🔍 FLORENCE DISCREPANCY ANALYSIS');
console.log('Investigating: App finds 215 pages, filtering reduces to 210');
console.log('═'.repeat(70));

// Test URL that shows the discrepancy
const testUrl = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/25456/rec/1';

async function analyzeDiscrepancy() {
    try {
        console.log('\n📋 STEP 1: Fetching manuscript data...');
        
        // Get the page to extract initial state (same as FlorenceLoader)
        const pageResponse = await fetch(testUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });

        if (!pageResponse.ok) {
            throw new Error(`Failed to fetch page: ${pageResponse.status}`);
        }

        const html = await pageResponse.text();
        
        // Extract __INITIAL_STATE__
        const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*JSON\.parse\("(.+?)"\);/);
        if (!stateMatch) {
            throw new Error('Could not find __INITIAL_STATE__');
        }

        const escapedJson = stateMatch[1];
        const unescapedJson = escapedJson
            ?.replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')
            .replace(/\\u0026/g, '&')
            .replace(/\\u003c/g, '<')
            .replace(/\\u003e/g, '>')
            .replace(/\\u002F/g, '/');

        const state: FlorenceState = JSON.parse(unescapedJson);
        
        // Extract pages (same logic as FlorenceLoader)
        const itemData = state?.item?.item;
        if (!itemData) {
            throw new Error('No item data found');
        }

        let allPages: Array<{ id: string; title: string }> = [];
        
        // Check parent compound object
        if (itemData.parentId && itemData.parentId !== -1) {
            if (itemData.parent && itemData.parent.children) {
                allPages = itemData.parent.children
                    .filter((child: FlorenceChild) => {
                        const title = (child.title || '').toLowerCase();
                        return !title.includes('color chart') && 
                               !title.includes('dorso') && 
                               !title.includes('piatto') &&
                               !title.includes('controguardia');
                    })
                    .map((child: FlorenceChild) => ({
                        id: child.id.toString(),
                        title: child.title || `Page ${child.id}`
                    }));
            }
        }

        console.log(`📄 DISCOVERED PAGES: ${allPages.length} total pages found`);
        console.log(`   First 5 IDs: ${allPages.slice(0, 5).map(p => p.id).join(', ')}`);
        console.log(`   Last 5 IDs:  ${allPages.slice(-5).map(p => p.id).join(', ')}`);
        
        console.log('\n🔍 STEP 2: Analyzing validation behavior...');
        
        // Now test validation logic to identify filtered pages
        const collection = 'plutei';
        let filteredOut: Array<{ id: string; title: string; reason: string }> = [];
        let validatedPages: Array<{ id: string; title: string }> = [];
        
        // Test each page (simulating FlorenceLoader validation)
        for (const page of allPages) {
            try {
                const testUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${page.id}/info.json`;
                
                console.log(`   Testing page ${page.id}...`);
                
                const response = await fetch(testUrl, {
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
                
                if (response.ok) {
                    validatedPages.push(page);
                    console.log(`     ✅ Page ${page.id}: OK (${response.status})`);
                } else if (response.status === 403 || response.status === 501) {
                    filteredOut.push({ 
                        id: page.id, 
                        title: page.title, 
                        reason: `HTTP ${response.status}: ${response.statusText}` 
                    });
                    console.log(`     ❌ Page ${page.id}: FILTERED OUT (${response.status} ${response.statusText})`);
                } else {
                    validatedPages.push(page);
                    console.log(`     ⚠️ Page ${page.id}: Other error (${response.status}), but INCLUDED anyway`);
                }
                
            } catch (error) {
                validatedPages.push(page);
                console.log(`     ⚠️ Page ${page.id}: Network error, but INCLUDED anyway`);
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log('\n📊 VALIDATION RESULTS:');
        console.log(`   Total discovered: ${allPages.length} pages`);
        console.log(`   After validation: ${validatedPages.length} pages`);
        console.log(`   Filtered out: ${filteredOut.length} pages`);
        
        if (filteredOut.length > 0) {
            console.log('\n❌ FILTERED OUT PAGES:');
            filteredOut.forEach(page => {
                console.log(`   • Page ${page.id} (${page.title}): ${page.reason}`);
            });
        }
        
        console.log('\n🔄 STEP 3: Testing app download behavior...');
        console.log('Testing if app would successfully download filtered pages with retry logic...');
        
        // Test the first few filtered pages with app-like retry logic
        for (const page of filteredOut.slice(0, 3)) {
            console.log(`\n🧪 Testing page ${page.id} with app retry logic...`);
            
            // Test with actual image URL (not just info.json)
            const imageUrl = `https://cdm21059.contentdm.oclc.org/iiif/2/${collection}:${page.id}/full/4000,/0/default.jpg`;
            
            let attempts = 0;
            let success = false;
            
            while (attempts < 3 && !success) {
                attempts++;
                console.log(`   Attempt ${attempts}/3...`);
                
                try {
                    const response = await fetch(imageUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
                            'Cache-Control': 'no-cache',
                            'Connection': 'keep-alive',
                            'Referer': 'https://cdm21059.contentdm.oclc.org/',
                            'Sec-Fetch-Dest': 'image',
                            'Sec-Fetch-Mode': 'no-cors',
                            'Sec-Fetch-Site': 'cross-site',
                            'DNT': '1'
                        }
                    });
                    
                    if (response.ok) {
                        const buffer = await response.arrayBuffer();
                        console.log(`     ✅ SUCCESS: Downloaded ${buffer.byteLength} bytes`);
                        success = true;
                    } else {
                        console.log(`     ❌ Failed: HTTP ${response.status} ${response.statusText}`);
                        if (attempts < 3) {
                            console.log(`     ⏳ Waiting 2s before retry...`);
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        }
                    }
                } catch (error) {
                    console.log(`     ❌ Network error: ${error}`);
                    if (attempts < 3) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
            }
            
            if (success) {
                console.log(`   🎯 RESULT: Page ${page.id} CAN be downloaded with app retry logic!`);
            } else {
                console.log(`   💀 RESULT: Page ${page.id} fails even with retry logic`);
            }
        }
        
        console.log('\n═'.repeat(70));
        console.log('🎯 ANALYSIS COMPLETE');
        console.log('\n🔍 FINDINGS:');
        console.log(`   • App would discover: ${allPages.length} pages`);
        console.log(`   • Validation filters out: ${filteredOut.length} pages`);
        console.log(`   • Discrepancy: ${allPages.length - validatedPages.length} pages`);
        
        if (filteredOut.length === 5 && allPages.length === 215) {
            console.log('\n✅ DISCREPANCY CONFIRMED: This matches the reported issue!');
            console.log('   • App discovers 215 pages');
            console.log('   • Validation reduces to 210 pages');
            console.log('   • 5 pages filtered out due to 403/501 errors');
        }
        
        console.log('\n💡 RECOMMENDATIONS:');
        if (filteredOut.length > 0) {
            console.log('   1. DISABLE gap filtering for Florence (pages may work with retry logic)');
            console.log('   2. OR adjust validation to use actual image URLs instead of info.json');
            console.log('   3. OR make validation less strict (only filter on repeated 404s)');
            console.log('   4. Test if filtered pages actually download in app context');
        } else {
            console.log('   • No pages filtered out in this test - investigate further');
        }
        
    } catch (error) {
        console.error('\n❌ ANALYSIS FAILED:', error);
    }
}

// Run the analysis
analyzeDiscrepancy().catch(console.error);