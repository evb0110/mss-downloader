#!/usr/bin/env tsx

/**
 * Test script to validate the Lindau Gospels (Morgan Library) pagination fix
 * 
 * ISSUE: Lindau only downloads first chunk (~16 pages) instead of full 100+ pages
 * FIX: Applied Bordeaux-style exponential + binary search page discovery
 * 
 * This script tests the enhanced Morgan loader to ensure it discovers all pages.
 */

import { MorganLoader } from '../../src/main/services/library-loaders/MorganLoader';
import { createRequire } from 'module';
import { setTimeout } from 'timers/promises';

const require = createRequire(import.meta.url);

// Mock dependencies for testing
const mockDeps = {
    fetchDirect: async (url: string, options?: any) => {
        console.log(`[TEST] Fetching: ${url}`);
        
        // Simulate real HTTP requests to Morgan Library
        const response = await fetch(url, options);
        return response;
    },
    logger: {
        log: (entry: any) => {
            console.log(`[LOGGER] ${entry.level}: ${entry.message}`, entry.details || '');
        }
    }
};

async function testLindauPagination() {
    console.log('🧪 TESTING: Lindau Gospels pagination fix');
    console.log('='.repeat(50));
    
    const morganLoader = new MorganLoader(mockDeps);
    
    // Test URLs for Lindau Gospels
    const testUrls = [
        'https://www.themorgan.org/collection/lindau-gospels/thumbs',
        'https://www.themorgan.org/collection/lindau-gospels',
        'https://www.themorgan.org/collection/lindau-gospels/1'
    ];
    
    for (const url of testUrls) {
        try {
            console.log(`\n📖 Testing URL: ${url}`);
            console.log('-'.repeat(40));
            
            const startTime = Date.now();
            const manifest = await morganLoader.loadManifest(url);
            const endTime = Date.now();
            
            console.log(`\n✅ SUCCESS for ${url}`);
            console.log(`📊 Results:`);
            console.log(`   - Total pages discovered: ${manifest.totalPages}`);
            console.log(`   - Display name: ${manifest.displayName}`);
            console.log(`   - Time taken: ${endTime - startTime}ms`);
            console.log(`   - Library: ${manifest.library}`);
            
            // Validate the fix worked
            if (manifest.totalPages > 50) {
                console.log(`🎉 PAGINATION FIX SUCCESSFUL: Found ${manifest.totalPages} pages (> 50 page limit)`);
            } else {
                console.log(`⚠️  POTENTIAL ISSUE: Only found ${manifest.totalPages} pages (may still be using old limit)`);
            }
            
            // Show first few and last few page URLs
            const firstPages = manifest.pageLinks.slice(0, 3);
            const lastPages = manifest.pageLinks.slice(-3);
            console.log(`   - First 3 pages: ${firstPages.length > 0 ? firstPages.join(', ') : 'None'}`);
            console.log(`   - Last 3 pages: ${lastPages.length > 0 ? lastPages.join(', ') : 'None'}`);
            
        } catch (error) {
            console.error(`❌ ERROR for ${url}:`, error instanceof Error ? error.message : String(error));
        }
        
        // Rate limiting between tests
        await setTimeout(1000);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('🏁 Test completed');
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
    testLindauPagination().catch(console.error);
}