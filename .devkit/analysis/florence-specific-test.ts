/**
 * FLORENCE SPECIFIC TEST: Original Problematic URL
 * 
 * This tests the exact URL that was failing before the intelligent parsing fix:
 * https://cdm21059.contentdm.oclc.org/iiif/2/plutei:217702/full/max/0/default.jpg
 */

import { FlorenceLoader } from '../../../src/main/services/library-loaders/FlorenceLoader';

// Mock dependencies for testing
const mockDeps = {
    fetchWithHTTPS: async (url: string) => {
        console.log(`🌐 Mock fetch: ${url}`);
        return {
            ok: true,
            status: 200,
            text: async () => `<html><script>window.__INITIAL_STATE__ = JSON.parse("{\\"item\\":{\\"item\\":{\\"title\\":\\"Test Manuscript\\",\\"parentId\\":-1}}}");</script></html>`,
            json: async () => ({ sequences: [{ canvases: [{ images: [{ resource: { service: { '@id': 'https://cdm21059.contentdm.oclc.org/iiif/2/plutei:217702' } } }] }] }] }),
            headers: {
                get: (name: string) => name === 'set-cookie' ? 'JSESSIONID=abc123' : null
            }
        };
    },
    logger: {
        log: (data: any) => console.log(`📝 LOG: ${data.message || JSON.stringify(data)}`),
        logDownloadError: (library: string, url: string, error: Error) => {
            console.log(`❌ ERROR: ${library} - ${url} - ${error.message}`);
        }
    }
};

async function testOriginalProblematicUrl() {
    console.log('🧪 FLORENCE SPECIFIC TEST: Original Problematic URL');
    console.log('===================================================');
    
    const problematicUrl = 'https://cdm21059.contentdm.oclc.org/iiif/2/plutei:217702/full/max/0/default.jpg';
    
    console.log(`\n🎯 Testing URL: ${problematicUrl}`);
    console.log('\n📋 Expected Results:');
    console.log('  ✅ Should parse collection=plutei, itemId=217702');
    console.log('  ✅ Should detect urlType=iiif_image');
    console.log('  ✅ Should convert to manuscript viewer URL for processing');
    console.log('  ✅ Should NOT throw "Could not extract collection and item ID" error');
    
    try {
        const loader = new FlorenceLoader(mockDeps as any);
        
        console.log('\n🚀 Starting Florence manifest load...');
        const manifest = await loader.loadManifest(problematicUrl);
        
        console.log('\n🎉 SUCCESS! Manifest loaded successfully:');
        console.log(`   Library: ${manifest.library}`);
        console.log(`   Display Name: ${manifest.displayName}`);
        console.log(`   Total Pages: ${manifest.totalPages}`);
        console.log(`   Page Links: ${manifest.pageLinks?.length} URLs generated`);
        
    } catch (error) {
        console.log('\n❌ TEST FAILED:');
        console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
        
        if (error instanceof Error && error.message.includes('Could not extract collection and item ID')) {
            console.log('\n🚨 CRITICAL: The original error still exists! The fix was not applied correctly.');
        }
    }
}

testOriginalProblematicUrl();
