import https from 'https';

async function fetchWithSSLBypass(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const options = { rejectUnauthorized: false };
        
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function testManifestURL(manifestUrl: string) {
    console.log(`\n🔍 Testing: ${manifestUrl}`);
    try {
        const response = await fetchWithSSLBypass(manifestUrl);
        
        if (response.includes('{"@context"') || response.includes('"@context"')) {
            console.log('✅ SUCCESS: Valid JSON-LD manifest found!');
            
            // Parse and extract basic info
            try {
                const manifest = JSON.parse(response);
                console.log(`   📋 Type: ${manifest['@type']}`);
                console.log(`   📋 Context: ${manifest['@context']}`);
                console.log(`   📋 ID: ${manifest['@id'] || manifest.id}`);
                
                // Check sequences vs items
                if (manifest.sequences) {
                    const canvases = manifest.sequences[0]?.canvases?.length || 0;
                    console.log(`   📋 IIIF v2: ${canvases} canvases`);
                } else if (manifest.items) {
                    console.log(`   📋 IIIF v3: ${manifest.items.length} items`);
                }
                
                return true;
            } catch (e) {
                console.log('   ⚠️  Valid response but JSON parse failed');
                console.log(`   📋 Response preview: ${response.substring(0, 200)}`);
                return false;
            }
        } else {
            console.log('❌ FAILURE: Not a valid manifest');
            console.log(`   📋 Response: ${response.substring(0, 150)}`);
            return false;
        }
    } catch (error) {
        console.log(`❌ ERROR: ${error}`);
        return false;
    }
}

async function findWorkingPattern() {
    console.log('🔍 BODLEIAN MANIFEST URL PATTERN DISCOVERY');
    console.log('Testing different URL patterns with known object IDs...\n');
    
    // Test manuscripts from search results
    const knownObjectIds = [
        '8b5d46f6-ba06-4f4f-96c9-ed85bad1f98c', // From search: MS. Auct. T. inf. 2. 2
        'ae9f6cca-ae5c-4149-8fe4-95e6eca1f73c'  // From search: MS. Bodl. 264
    ];
    
    // Different URL patterns to test
    const patterns = [
        // Current pattern (known to fail)
        'https://iiif.bodleian.ox.ac.uk/iiif/manifest/{id}.json',
        
        // Alternative patterns based on common IIIF conventions
        'https://iiif.bodleian.ox.ac.uk/manifest/{id}.json',
        'https://digital.bodleian.ox.ac.uk/manifest/{id}.json',
        'https://digital.bodleian.ox.ac.uk/iiif/manifest/{id}.json',
        'https://digital.bodleian.ox.ac.uk/iiif/{id}/manifest.json',
        'https://iiif.bodleian.ox.ac.uk/iiif/{id}/manifest.json',
        
        // With additional path segments
        'https://iiif.bodleian.ox.ac.uk/manifest/objects/{id}.json',
        'https://digital.bodleian.ox.ac.uk/manifest/objects/{id}.json',
        
        // Version-specific patterns
        'https://iiif.bodleian.ox.ac.uk/iiif/presentation/v2/{id}/manifest',
        'https://iiif.bodleian.ox.ac.uk/iiif/presentation/v3/{id}/manifest',
        'https://digital.bodleian.ox.ac.uk/iiif/presentation/{id}/manifest'
    ];
    
    console.log(`Testing ${patterns.length} different URL patterns with ${knownObjectIds.length} object IDs...\n`);
    
    const workingPatterns: string[] = [];
    
    for (const pattern of patterns) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📋 TESTING PATTERN: ${pattern.replace('{id}', '{OBJECT_ID}')}`);
        console.log(`${'='.repeat(80)}`);
        
        let patternWorks = 0;
        
        for (const objectId of knownObjectIds) {
            const manifestUrl = pattern.replace('{id}', objectId);
            const success = await testManifestURL(manifestUrl);
            if (success) patternWorks++;
        }
        
        if (patternWorks > 0) {
            console.log(`\n🎉 PATTERN WORKS: ${patternWorks}/${knownObjectIds.length} manuscripts successful`);
            workingPatterns.push(pattern);
        } else {
            console.log(`\n❌ PATTERN FAILED: 0/${knownObjectIds.length} manuscripts successful`);
        }
    }
    
    console.log('\n' + '🏁 FINAL RESULTS '.padStart(50, '=').padEnd(80, '='));
    
    if (workingPatterns.length > 0) {
        console.log('\n✅ WORKING PATTERNS DISCOVERED:');
        workingPatterns.forEach((pattern, i) => {
            console.log(`   ${i + 1}. ${pattern}`);
        });
        
        console.log('\n🔧 RECOMMENDED FIX:');
        console.log('Update getBodleianManifest() in SharedManifestLoaders.ts:');
        console.log(`   OLD: https://iiif.bodleian.ox.ac.uk/iiif/manifest/\${objectId}.json`);
        console.log(`   NEW: ${workingPatterns[0].replace('{id}', '${objectId}')}`);
    } else {
        console.log('\n❌ NO WORKING PATTERNS FOUND');
        console.log('Need to investigate further - may require different approach');
    }
}

findWorkingPattern().catch(console.error);