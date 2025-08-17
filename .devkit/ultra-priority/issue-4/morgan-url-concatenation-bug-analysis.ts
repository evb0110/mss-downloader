// ULTRATHINK AGENT: Deep Analysis of Morgan Library URL Concatenation Bug
// Issue #4 - 13th Failed Fix Attempt Analysis

/**
 * CRITICAL BUG DISCOVERED:
 * 
 * USER ERROR MESSAGE:
 * "Failed to fetch Morgan page: 301 for URL: https://www.themorgan.org/collection/lindau-gospels/thumbshttps://www.themorgan.org/collection/lindau-gospels/thumbs"
 * 
 * ANALYSIS:
 * The URL is being duplicated during redirect handling.
 * Expected: https://www.themorgan.org/collection/lindau-gospels/thumbs
 * Actual:   https://www.themorgan.org/collection/lindau-gospels/thumbshttps://www.themorgan.org/collection/lindau-gospels/thumbs
 * 
 * SUSPECTED LOCATION: MorganLoader.ts line 94
 * const fullRedirectUrl = redirectUrl.startsWith('http') ? redirectUrl : `${baseUrl}${redirectUrl}`;
 */

import { readFileSync, writeFileSync } from 'fs';

// Let's analyze the exact redirect logic in MorganLoader.ts
function analyzeMorganRedirectBug() {
    console.log('🔍 ULTRATHINK ANALYSIS: Morgan URL Concatenation Bug');
    console.log('='.repeat(60));
    
    // Simulate the actual bug scenario
    const userUrl = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';
    console.log(`User URL: ${userUrl}`);
    
    // This is what happens in the code:
    const baseUrl = 'https://www.themorgan.org';
    const manuscriptId = 'lindau-gospels';
    
    // Line 67: pageUrl is constructed correctly
    let pageUrl = `${baseUrl}/collection/${manuscriptId}/thumbs`;
    console.log(`Initial pageUrl: ${pageUrl}`);
    
    // But when a 301 redirect happens...
    // Let's simulate what the redirect header might contain
    
    // SCENARIO 1: Redirect to absolute URL
    const redirectToAbsolute = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';
    const fullRedirectUrl1 = redirectToAbsolute.startsWith('http') ? redirectToAbsolute : `${baseUrl}${redirectToAbsolute}`;
    console.log(`Scenario 1 - Absolute redirect: ${fullRedirectUrl1}`);
    
    // SCENARIO 2: Redirect to relative URL
    const redirectToRelative = '/collection/lindau-gospels/thumbs';
    const fullRedirectUrl2 = redirectToRelative.startsWith('http') ? redirectToRelative : `${baseUrl}${redirectToRelative}`;
    console.log(`Scenario 2 - Relative redirect: ${fullRedirectUrl2}`);
    
    // SCENARIO 3: BUG SCENARIO - What if redirect URL is malformed?
    // What if the original pageUrl is somehow being used as redirectUrl?
    const buggyRedirectUrl = pageUrl; // This would be the bug!
    const fullRedirectUrl3 = buggyRedirectUrl.startsWith('http') ? buggyRedirectUrl : `${baseUrl}${buggyRedirectUrl}`;
    console.log(`Scenario 3 - BUGGY (pageUrl as redirectUrl): ${fullRedirectUrl3}`);
    
    // SCENARIO 4: What if pageUrl was already duplicated before the redirect?
    const duplicatedPageUrl = `${pageUrl}${pageUrl}`;
    console.log(`Scenario 4 - Pre-duplicated pageUrl: ${duplicatedPageUrl}`);
    
    console.log('\n🚨 SUSPECTED ROOT CAUSE:');
    console.log('The redirect URL might be getting the original pageUrl instead of the actual redirect location.');
    console.log('OR the pageUrl is getting corrupted before the redirect handling.');
    
    return {
        expectedUrl: userUrl,
        buggyUrl: 'https://www.themorgan.org/collection/lindau-gospels/thumbshttps://www.themorgan.org/collection/lindau-gospels/thumbs',
        suspectedLocation: 'MorganLoader.ts line 94',
        potentialCauses: [
            'redirectUrl contains the original pageUrl instead of the actual redirect location',
            'pageUrl gets corrupted before redirect handling',
            'Multiple concatenations happening in sequence',
            'redirectUrl header is being misread from the response'
        ]
    };
}

function createProductionTest() {
    console.log('\n🧪 CREATING PRODUCTION TEST TO REPRODUCE BUG');
    console.log('='.repeat(60));
    
    const testCode = `
// Test to reproduce the exact Morgan Library URL concatenation bug
import { MorganLoader } from '../../../src/main/services/library-loaders/MorganLoader';

async function testMorganUrlConcatenation() {
    console.log('Testing Morgan URL concatenation bug...');
    
    // Mock dependencies
    const mockFetchDirect = async (url: string, options?: any) => {
        console.log(\`Fetch called with URL: \${url}\`);
        
        // Simulate 301 redirect response
        if (url.includes('/thumbs')) {
            return {
                status: 301,
                headers: {
                    get: (headerName: string) => {
                        if (headerName === 'location') {
                            // This might be where the bug is - what if the location header is malformed?
                            return '/collection/lindau-gospels/thumbs'; // or url itself?
                        }
                        return null;
                    }
                }
            };
        }
        
        return {
            ok: true,
            text: async () => '<html>mock response</html>'
        };
    };
    
    const mockLogger = {
        log: (data: any) => console.log('Logger:', data)
    };
    
    const loader = new MorganLoader({
        fetchDirect: mockFetchDirect,
        logger: mockLogger
    });
    
    try {
        const userUrl = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';
        console.log(\`Testing with user URL: \${userUrl}\`);
        
        const result = await loader.loadManifest(userUrl);
        console.log('Test passed:', result);
    } catch (error) {
        console.error('Test failed with error:', error.message);
        
        // Check if the error contains the duplicated URL
        if (error.message.includes('thumbshttps://')) {
            console.log('🚨 BUG REPRODUCED! URL concatenation bug confirmed.');
            return { bugReproduced: true, error: error.message };
        }
    }
    
    return { bugReproduced: false };
}

testMorganUrlConcatenation();
`;
    
    writeFileSync('/home/evb/WebstormProjects/mss-downloader/.devkit/ultra-priority/issue-4/reproduce-bug-test.ts', testCode);
    console.log('Test file created: reproduce-bug-test.ts');
}

// Run the analysis
const analysis = analyzeMorganRedirectBug();
createProductionTest();

console.log('\n📊 ANALYSIS SUMMARY:');
console.log(JSON.stringify(analysis, null, 2));