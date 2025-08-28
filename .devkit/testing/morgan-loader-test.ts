#!/usr/bin/env bun

import { MorganLoader } from '../src/main/services/library-loaders/MorganLoader';
import type { LoaderDependencies } from '../src/main/services/library-loaders/types';

// Mock dependencies
const mockDeps: LoaderDependencies = {
    fetchDirect: fetch,
    logger: {
        log: (entry) => console.log(`[${entry.level}] ${entry.message}`, entry.details || ''),
        error: (message) => console.error(message),
        info: (message) => console.log(message),
        warn: (message) => console.warn(message)
    }
};

async function testMorganLoader() {
    const loader = new MorganLoader(mockDeps);
    const testUrl = 'https://www.themorgan.org/collection/gospel-book/143812';
    
    console.log('=== Testing MorganLoader ===');
    console.log('URL:', testUrl);
    
    try {
        const manifest = await loader.loadManifest(testUrl);
        console.log('\n=== Manifest Results ===');
        console.log('Display Name:', manifest.displayName);
        console.log('Total Pages:', manifest.totalPages);
        console.log('Library:', manifest.library);
        
        console.log('\n=== First 5 Page URLs ===');
        manifest.pageLinks.slice(0, 5).forEach((url, i) => {
            console.log(`${i + 1}: ${url}`);
            // Check URL type
            if (url.includes('/styles/')) {
                console.log('   ^ THUMBNAIL (styled)');
            } else if (url.includes('/facsimile/') && url.includes('.jpg')) {
                console.log('   ^ HIGH-RESOLUTION JPEG');
            } else if (url.includes('.zif')) {
                console.log('   ^ ZIF (ultra-high resolution)');
            }
        });
        
        // Test file sizes of first few images
        console.log('\n=== Testing Image Sizes ===');
        for (let i = 0; i < Math.min(3, manifest.pageLinks.length); i++) {
            const url = manifest.pageLinks[i];
            try {
                const response = await fetch(url, { method: 'HEAD' });
                if (response.ok) {
                    const size = response.headers.get('content-length');
                    const sizeKB = size ? Math.round(parseInt(size) / 1024) : 'unknown';
                    console.log(`Image ${i + 1}: ${sizeKB}KB - ${url.split('/').pop()}`);
                } else {
                    console.log(`Image ${i + 1}: ${response.status} ERROR`);
                }
            } catch (error) {
                console.log(`Image ${i + 1}: FETCH ERROR`);
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testMorganLoader();