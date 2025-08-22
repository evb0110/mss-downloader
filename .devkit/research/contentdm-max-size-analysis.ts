#!/usr/bin/env bun

/**
 * Analyze the actual maximum resolution ContentDM provides
 * and determine the size threshold that causes 403 errors
 */

async function analyzeMaxResolution() {
    console.log('🔍 Analyzing ContentDM Maximum Resolution');
    
    const baseUrl = 'https://cdm21059.contentdm.oclc.org/iiif/2/plutei:217706';
    
    // Test the maximum size by getting actual content
    const maxUrl = `${baseUrl}/full/max/0/default.jpg`;
    console.log('📥 Getting actual maximum resolution image...');
    
    try {
        const response = await fetch(maxUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Referer': 'https://cdm21059.contentdm.oclc.org/',
            }
        });
        
        if (response.ok) {
            const buffer = await response.arrayBuffer();
            console.log(`✅ Maximum size download successful: ${Math.round(buffer.byteLength / 1024)}KB`);
            
            // Save a small sample to analyze actual dimensions (first 1KB for header analysis)
            const sample = new Uint8Array(buffer.slice(0, 1024));
            await Bun.write('.devkit/research/max-image-sample.jpg', sample);
            console.log('💾 Saved image header sample for dimension analysis');
            
        } else {
            console.log(`❌ Failed to download max image: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.log(`❌ Error downloading max image: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Test the boundary between working and failing sizes
    console.log('\n🎯 Testing size boundary (where 403 starts)...');
    
    const sizesToTest = [5000, 5500, 5800, 5900, 5950, 6000, 6050, 6100];
    
    for (const size of sizesToTest) {
        const testUrl = `${baseUrl}/full/${size},/0/default.jpg`;
        
        try {
            const response = await fetch(testUrl, {
                method: 'HEAD',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                    'Referer': 'https://cdm21059.contentdm.oclc.org/',
                }
            });
            
            const statusEmoji = response.ok ? '✅' : '❌';
            console.log(`${statusEmoji} ${size}px → ${response.status} ${response.statusText}`);
            
            // Small delay to be nice to server
            await new Promise(resolve => setTimeout(resolve, 300));
            
        } catch (error) {
            console.log(`❌ ${size}px → Network Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    // Test percentage-based scaling limits
    console.log('\n📊 Testing percentage-based scaling limits...');
    
    const percentages = [200, 250, 300, 350, 400, 450, 500];
    
    for (const pct of percentages) {
        const testUrl = `${baseUrl}/full/pct:${pct}/0/default.jpg`;
        
        try {
            const response = await fetch(testUrl, {
                method: 'HEAD',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                    'Referer': 'https://cdm21059.contentdm.oclc.org/',
                }
            });
            
            const statusEmoji = response.ok ? '✅' : '❌';
            console.log(`${statusEmoji} ${pct}% scale → ${response.status} ${response.statusText}`);
            
            // Small delay
            await new Promise(resolve => setTimeout(resolve, 300));
            
        } catch (error) {
            console.log(`❌ ${pct}% scale → Network Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

// Test other ContentDM libraries if any exist in the codebase
async function findOtherContentDMInstances() {
    console.log('\n🔍 Checking for other ContentDM instances in codebase...');
    
    // This is a simple check - in a real implementation we'd search the codebase
    // For now, let's check if there are any other known ContentDM patterns
    const knownContentDMPatterns = [
        'contentdm.oclc.org',
        '.contentdm.',
        '/contentdm/',
    ];
    
    console.log('📋 Known ContentDM patterns to investigate:');
    knownContentDMPatterns.forEach(pattern => {
        console.log(`   ${pattern}`);
    });
    
    console.log('\n💡 Recommendation: Search codebase for these patterns to find other ContentDM libraries');
}

async function main() {
    await analyzeMaxResolution();
    await findOtherContentDMInstances();
}

if (import.meta.main) {
    main();
}