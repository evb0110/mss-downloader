#!/usr/bin/env bun

import { SharedManifestLoaders } from '../../src/shared/SharedManifestLoaders.ts';

async function debugBordeauxManifest() {
    console.log('🔍 Debugging Bordeaux manifest loading issue...');
    
    // Test URL - a real Bordeaux manuscript
    const testUrl = 'https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778';
    
    try {
        console.log('\n1️⃣ Testing SharedManifestLoaders.getBordeauxManifest()...');
        const loader = new SharedManifestLoaders();
        const result = await loader.getBordeauxManifest(testUrl);
        
        console.log('✅ getBordeauxManifest result structure:');
        console.log('Type:', typeof result);
        console.log('Keys:', Object.keys(result));
        
        if ('images' in result) {
            console.log('Images array length:', result.images?.length);
            console.log('First image:', result.images?.[0]);
            console.log('requiresTileProcessor:', result.requiresTileProcessor);
            console.log('tileConfig:', result.tileConfig);
            console.log('type:', result.type);
            console.log('baseId:', result.baseId);
            console.log('tileBaseUrl:', result.tileBaseUrl);
        }
        
        console.log('\n2️⃣ Testing SharedManifestAdapter conversion...');
        // Let's simulate what SharedManifestAdapter does
        const manifest = {
            pageLinks: result.images ? result.images.map((image: { url: string }) => image.url) : [],
            totalPages: result.images ? result.images?.length : (result.pageCount || 0),
            library: 'bordeaux' as const,
            displayName: result.displayName || 'Bordeaux Manuscript',
            originalUrl: testUrl
        };
        
        // Handle special properties for tile-based libraries
        if (result.type === 'bordeaux_tiles' && result.requiresTileProcessor) {
            (manifest as any).requiresTileProcessor = true;
            (manifest as any).tileConfig = {
                type: result.type,
                baseId: result.baseId,
                publicId: result.publicId,
                startPage: result.startPage,
                pageCount: result.pageCount,
                tileBaseUrl: result.tileBaseUrl
            };
            
            // Generate placeholder page links 
            const placeholderLinks = [];
            for (let i = 0; i < result.pageCount; i++) {
                const pageNum = result.startPage + i;
                placeholderLinks.push(`${result.tileBaseUrl}/${result.baseId}_${String(pageNum).padStart(4, '0')}`);
            }
            manifest.pageLinks = placeholderLinks;
            manifest.totalPages = result.pageCount;
        }
        
        console.log('✅ Final manifest structure:');
        console.log('pageLinks length:', manifest.pageLinks.length);
        console.log('totalPages:', manifest.totalPages);
        console.log('requiresTileProcessor:', (manifest as any).requiresTileProcessor);
        console.log('tileConfig:', (manifest as any).tileConfig);
        console.log('First pageLink:', manifest.pageLinks[0]);
        
        console.log('\n3️⃣ Checking tile processor condition...');
        const hasRequiresTileProcessor = !!(manifest as any).requiresTileProcessor;
        const hasTileConfig = !!(manifest as any).tileConfig;
        
        console.log('requiresTileProcessor:', hasRequiresTileProcessor);
        console.log('tileConfig exists:', hasTileConfig);
        console.log('Condition result:', hasRequiresTileProcessor && hasTileConfig);
        
        if (hasRequiresTileProcessor && hasTileConfig) {
            console.log('✅ Bordeaux manuscript should trigger DirectTileProcessor');
            console.log('Expected baseId:', (manifest as any).tileConfig?.baseId);
            console.log('Expected tileBaseUrl:', (manifest as any).tileConfig?.tileBaseUrl);
        } else {
            console.log('❌ Bordeaux manuscript will NOT trigger DirectTileProcessor');
            console.log('This could be the source of the issue!');
        }
        
        console.log('\n4️⃣ Debugging image URLs structure...');
        if (result.images && result.images.length > 0) {
            console.log('Sample image objects:');
            for (let i = 0; i < Math.min(3, result.images.length); i++) {
                console.log(`Image ${i + 1}:`, result.images[i]);
            }
        }
        
    } catch (error) {
        console.error('❌ Error during debug:', error);
        console.error('Stack:', (error as Error).stack);
    }
}

debugBordeauxManifest().catch(console.error);