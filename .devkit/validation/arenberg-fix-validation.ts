#!/usr/bin/env ts-node

/**
 * ARENBERG GOSPELS DOWNLOAD FIX VALIDATION
 * 
 * This script tests that the Morgan loader correctly constructs ZIF URLs for the Arenberg Gospels
 * by using the manuscript code (m869) instead of the URL slug (arenberg-gospels).
 * 
 * Expected Results:
 * - Should discover manuscriptCode: "m869"
 * - Should use ZIF directory: "m869" (not "arenberg-gospels") 
 * - Should generate working ZIF URLs like: https://host.themorgan.org/facsimile/images/m869/159161v_0017.zif
 * 
 * Issue: Before fix, system was getting 404s because it used wrong directory name
 * Fix: Enhanced ZIF directory selection to prefer manuscriptCode over manuscriptId slug
 */

import { MorganLoader } from '../src/main/services/library-loaders/MorganLoader';
import type { LoaderDependencies } from '../src/main/services/library-loaders/types';

console.log('🔍 ARENBERG GOSPELS ZIF URL VALIDATION');
console.log('=====================================\n');

// Mock dependencies for testing
const mockDeps: LoaderDependencies = {
    fetchDirect: async (url: string) => {
        console.log(`[FETCH] ${url}`);
        
        if (url === 'https://www.themorgan.org/collection/arenberg-gospels/thumbs') {
            // Mock redirect to main page
            return {
                ok: false,
                status: 302,
                headers: {
                    get: (name: string) => name === 'location' ? 'https://www.themorgan.org/collection/arenberg-gospels' : null
                }
            } as Response;
        }
        
        if (url === 'https://www.themorgan.org/collection/arenberg-gospels') {
            // Mock main page with basic content
            return {
                ok: true,
                status: 200,
                text: async () => `
                    <title>Arenberg Gospels | The Morgan Library & Museum</title>
                    <div>MS M.869 - Arenberg Gospels</div>
                    <a href="/collection/arenberg-gospels/1">Page 1</a>
                    <a href="/collection/arenberg-gospels/2">Page 2</a>
                `
            } as Response;
        }
        
        if (url === 'https://www.themorgan.org/collection/arenberg-gospels/1') {
            // Mock individual page with facsimile viewer iframe
            return {
                ok: true,
                status: 200,
                text: async () => `
                    <iframe src="https://host.themorgan.org/facsimile/m869/default.asp?id=1&width=100%25&height=100%25&iframe=true"></iframe>
                    <div>Page 1 of Arenberg Gospels</div>
                    /sites/default/files/facsimile/159161/159161v_0017.jpg
                `
            } as Response;
        }
        
        // Mock other requests
        return {
            ok: true,
            status: 200,
            text: async () => '<html><body>Mock content</body></html>'
        } as Response;
    },
    logger: {
        log: (entry: any) => {
            console.log(`[LOG] ${entry.message}`, entry.details || '');
        }
    }
};

async function validateArenbergFix() {
    try {
        const loader = new MorganLoader(mockDeps);
        
        console.log('🧪 Testing Arenberg Gospels manuscript loading...\n');
        
        const manifest = await loader.loadManifest('https://www.themorgan.org/collection/arenberg-gospels/thumbs');
        
        console.log('\n✅ VALIDATION RESULTS:');
        console.log('======================');
        console.log(`📖 Display Name: ${manifest.displayName}`);
        console.log(`🔢 Total Pages: ${manifest.totalPages}`);
        console.log(`🏛️ Library: ${manifest.library}`);
        console.log(`🔗 Original URL: ${manifest.originalUrl}`);
        
        console.log('\n🖼️ SAMPLE ZIF URLs:');
        console.log('==================');
        const sampleUrls = manifest.pageLinks.slice(0, 3);
        sampleUrls.forEach((url, idx) => {
            const isZif = url.endsWith('.zif');
            const hasCorrectDir = url.includes('/m869/');
            const status = isZif && hasCorrectDir ? '✅' : '❌';
            console.log(`${status} Page ${idx + 1}: ${url}`);
        });
        
        // Check for the specific problematic URL pattern
        const hasOldPattern = manifest.pageLinks.some(url => url.includes('/arenberg-gospels/'));
        const hasNewPattern = manifest.pageLinks.some(url => url.includes('/m869/'));
        
        console.log('\n🔍 URL PATTERN ANALYSIS:');
        console.log('=======================');
        console.log(`❌ Old broken pattern (/arenberg-gospels/): ${hasOldPattern ? 'FOUND - ISSUE REMAINS!' : 'Not found - Good!'}`);
        console.log(`✅ New correct pattern (/m869/): ${hasNewPattern ? 'FOUND - FIX WORKING!' : 'Not found - Fix may not be working'}`);
        
        if (!hasOldPattern && hasNewPattern) {
            console.log('\n🎉 SUCCESS: Fix appears to be working correctly!');
            console.log('   ZIF URLs now use manuscript code "m869" instead of slug "arenberg-gospels"');
        } else {
            console.log('\n⚠️  WARNING: Fix may not be fully working');
            console.log('   Please check the ZIF directory construction logic');
        }
        
    } catch (error) {
        console.error('\n❌ VALIDATION FAILED:', error);
    }
}

// Run validation
validateArenbergFix().catch(console.error);