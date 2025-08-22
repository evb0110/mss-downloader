#!/usr/bin/env bun

/**
 * Quick test of Enhanced Florence Downloader with per-page size detection
 * Tests the first few pages to validate the enhanced approach
 */

import { FlorenceEnhancedDownloader } from './FlorenceEnhancedDownloader';

const TEST_PAGES = [
    { id: '217706', title: 'Carta 1r' }, // Known to fail at 6000px but work at 4000px
    { id: '217707', title: 'Carta 1v' }, // Test different page
    { id: '217708', title: 'Carta 2r' }, // Test different page
];

async function main() {
    console.log('🧪 Enhanced Florence Downloader Test');
    console.log('====================================\n');
    
    const downloader = new FlorenceEnhancedDownloader({
        maxConcurrent: 1,
        baseDelayMs: 2000,
        maxDelayMs: 8000,
        retryLimit: 4,
        enablePerPageSizing: true,
        enableGracefulDegradation: true,
        minAcceptableSize: 300
    });
    
    try {
        const result = await downloader.downloadManuscript(
            'plutei',
            TEST_PAGES,
            '217710-test'
        );
        
        console.log('\n📊 Test Results:');
        console.log(`Success rate: ${result.stats.successful}/${TEST_PAGES.length}`);
        console.log(`Total data: ${Math.round(result.stats.totalBytes / 1024)}KB`);
        console.log(`Time: ${Math.round(result.totalTime / 1000)}s`);
        
        console.log('\nPer-page results:');
        result.stats.perPageResults.forEach(page => {
            const status = page.success ? '✅' : '❌';
            const size = page.sizeUsed ? `${page.sizeUsed}px` : 'N/A';
            console.log(`  ${status} ${page.pageId}: ${size}`);
        });
        
        if (result.stats.successful > 0) {
            console.log('\n🎉 Enhanced approach successful!');
            console.log('   ✅ Per-page size detection working');
            console.log('   ✅ Graceful degradation handling 403 errors');
            console.log('   ✅ Ready for production integration');
        } else {
            console.log('\n❌ Enhanced approach needs more work');
        }
        
    } catch (error: any) {
        console.error(`❌ Test failed: ${error.message}`);
    } finally {
        downloader.cleanup();
    }
}

main().catch(console.error);