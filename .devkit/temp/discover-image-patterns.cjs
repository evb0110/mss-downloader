const fs = require('fs');

async function discoverImagePatterns() {
    try {
        console.log('=== DISCOVERING ACTUAL IMAGE PATTERNS ===');
        
        // Get the basic setup
        const testUrl = 'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415';
        
        const docResponse = await fetch(testUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });
        
        const cookies = docResponse.headers.get('set-cookie');
        const docHtml = await docResponse.text();
        const uurlMatch = docHtml.match(/https:\/\/uurl\.kbr\.be\/(\d+)/);
        
        const uurlResponse = await fetch(uurlMatch[0], {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': testUrl,
                'Cookie': cookies || ''
            }
        });
        
        const uurlHtml = await uurlResponse.text();
        const mapMatch = uurlHtml.match(/map=([^"'&]+)/);
        const mapPath = mapMatch[1];
        
        const galleryUrl = `https://viewerd.kbr.be/gallery.php?map=${mapPath}`;
        
        console.log('Map path:', mapPath);
        console.log('Gallery URL:', galleryUrl);
        
        // Try many different image naming patterns
        const patterns = [
            // Different prefixes
            { desc: 'BE-KBR MS prefix', base: 'BE-KBR_MS_', formats: [(n) => `${n.toString().padStart(4, '0')}.jpg`] },
            { desc: 'BE-KBR prefix only', base: 'BE-KBR_', formats: [(n) => `${n.toString().padStart(4, '0')}.jpg`] },
            { desc: 'KBR prefix', base: 'KBR_', formats: [(n) => `${n.toString().padStart(4, '0')}.jpg`] },
            { desc: 'MS prefix', base: 'MS_', formats: [(n) => `${n.toString().padStart(4, '0')}.jpg`] },
            { desc: 'No prefix', base: '', formats: [(n) => `${n.toString().padStart(4, '0')}.jpg`] },
            
            // Different number formats with original prefix
            { desc: 'BE-KBR00 standard', base: 'BE-KBR00_', formats: [
                (n) => `${n.toString().padStart(5, '0')}.jpg`,
                (n) => `${n.toString().padStart(6, '0')}.jpg`,
                (n) => `${n.toString().padStart(7, '0')}.jpg`,
                (n) => `${n.toString().padStart(8, '0')}.jpg`
            ]},
            
            // Different file extensions
            { desc: 'TIFF files', base: 'BE-KBR00_', formats: [
                (n) => `${n.toString().padStart(4, '0')}.tif`,
                (n) => `${n.toString().padStart(4, '0')}.tiff`
            ]},
            
            // Different separators
            { desc: 'Underscore separator', base: 'BE_KBR00_', formats: [(n) => `${n.toString().padStart(4, '0')}.jpg`] },
            { desc: 'Dash separator', base: 'BE-KBR-00-', formats: [(n) => `${n.toString().padStart(4, '0')}.jpg`] },
            { desc: 'No separator', base: 'BEKBR00', formats: [(n) => `${n.toString().padStart(4, '0')}.jpg`] },
            
            // Document ID based patterns
            { desc: 'Document ID based', base: '16994415_', formats: [
                (n) => `${n.toString().padStart(4, '0')}.jpg`,
                (n) => `${n.toString().padStart(3, '0')}.jpg`,
                (n) => `${n.toString().padStart(2, '0')}.jpg`,
                (n) => `${n.toString()}.jpg`
            ]},
            
            // Try some common manuscript digitization patterns
            { desc: 'Page format', base: 'page_', formats: [(n) => `${n.toString().padStart(4, '0')}.jpg`] },
            { desc: 'Folio format', base: 'folio_', formats: [(n) => `${n.toString().padStart(4, '0')}.jpg`] },
            { desc: 'Image format', base: 'image_', formats: [(n) => `${n.toString().padStart(4, '0')}.jpg`] },
            { desc: 'Scan format', base: 'scan_', formats: [(n) => `${n.toString().padStart(4, '0')}.jpg`] },
        ];
        
        console.log('\nTesting various image naming patterns...');
        
        for (const pattern of patterns) {
            console.log(`\nTesting: ${pattern.desc}`);
            
            for (const formatFunc of pattern.formats) {
                const testImageName = pattern.base + formatFunc(1);
                const testImageUrl = `https://viewerd.kbr.be/display/${mapPath}${testImageName}`;
                
                console.log(`  Trying: ${testImageName}`);
                
                try {
                    const testResponse = await fetch(testImageUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Accept': 'image/*,*/*;q=0.8',
                            'Referer': galleryUrl,
                            'Cookie': cookies || ''
                        }
                    });
                    
                    console.log(`    Response: ${testResponse.status}`);
                    
                    if (testResponse.ok) {
                        const imageData = await testResponse.arrayBuffer();
                        console.log(`    ✓ SUCCESS: ${testImageName} (${imageData.byteLength} bytes)`);
                        
                        // Save the successful image
                        fs.writeFileSync(`.devkit/temp/belgica-discovered-${testImageName}`, Buffer.from(imageData));
                        
                        // Test a few more with this pattern
                        console.log(`    Testing sequence with this pattern...`);
                        let sequenceCount = 1;
                        
                        for (let i = 2; i <= 10; i++) {
                            const seqImageName = pattern.base + formatFunc(i);
                            const seqImageUrl = `https://viewerd.kbr.be/display/${mapPath}${seqImageName}`;
                            
                            const seqResponse = await fetch(seqImageUrl, {
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                    'Accept': 'image/*,*/*;q=0.8',
                                    'Referer': galleryUrl,
                                    'Cookie': cookies || ''
                                }
                            });
                            
                            if (seqResponse.ok) {
                                const seqData = await seqResponse.arrayBuffer();
                                if (seqData.byteLength > 1000) {
                                    sequenceCount++;
                                    console.log(`      ✓ ${seqImageName} (${seqData.byteLength} bytes)`);
                                } else {
                                    break;
                                }
                            } else if (seqResponse.status === 404) {
                                console.log(`      End at: ${seqImageName} (404)`);
                                break;
                            } else {
                                console.log(`      Error at: ${seqImageName} (${seqResponse.status})`);
                                break;
                            }
                            
                            await new Promise(resolve => setTimeout(resolve, 200));
                        }
                        
                        console.log(`    ✓ FOUND WORKING PATTERN: ${pattern.desc}`);
                        console.log(`    ✓ Base: ${pattern.base}`);
                        console.log(`    ✓ Format: ${formatFunc(1)}`);
                        console.log(`    ✓ Sequence: ${sequenceCount} images`);
                        
                        return {
                            success: true,
                            pattern: pattern.desc,
                            base: pattern.base,
                            formatExample: testImageName,
                            sequenceCount,
                            mapPath,
                            galleryUrl
                        };
                    }
                } catch (error) {
                    console.log(`    Error: ${error.message}`);
                }
                
                // Small delay between tests
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        // If no standard patterns work, try to examine the actual directory contents
        console.log('\n=== ATTEMPTING DIRECTORY INSPECTION ===');
        
        // Sometimes the directory listing works if we use the right endpoint
        const directoryEndpoints = [
            `https://viewerd.kbr.be/display/${mapPath}`,
            `https://viewerd.kbr.be/data/${mapPath}`,
            `https://viewerd.kbr.be/images/${mapPath}`,
            `https://viewerd.kbr.be/files/${mapPath}`,
            `https://viewerd.kbr.be/content/${mapPath}`
        ];
        
        for (const endpoint of directoryEndpoints) {
            console.log(`Trying directory endpoint: ${endpoint}`);
            
            try {
                const dirResponse = await fetch(endpoint, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'text/html,*/*',
                        'Referer': galleryUrl,
                        'Cookie': cookies || ''
                    }
                });
                
                console.log(`  Response: ${dirResponse.status}`);
                
                if (dirResponse.ok) {
                    const dirContent = await dirResponse.text();
                    
                    // Look for any image file references
                    const imageRefs = dirContent.match(/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|tif|tiff)/gi) || [];
                    
                    if (imageRefs.length > 0) {
                        console.log(`  ✓ Found image references:`, imageRefs.slice(0, 10));
                        
                        // Try the first few references
                        for (const imageRef of imageRefs.slice(0, 3)) {
                            const testUrl = `${endpoint}${imageRef}`;
                            console.log(`  Testing: ${testUrl}`);
                            
                            const testResponse = await fetch(testUrl, {
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                    'Accept': 'image/*,*/*;q=0.8',
                                    'Referer': galleryUrl,
                                    'Cookie': cookies || ''
                                }
                            });
                            
                            if (testResponse.ok) {
                                const imageData = await testResponse.arrayBuffer();
                                console.log(`    ✓ SUCCESS: ${imageRef} (${imageData.byteLength} bytes)`);
                                
                                return {
                                    success: true,
                                    method: 'directory_listing',
                                    endpoint,
                                    imageRefs: imageRefs.slice(0, 10),
                                    workingImage: imageRef,
                                    mapPath,
                                    galleryUrl
                                };
                            }
                        }
                    } else {
                        console.log(`  No image references found in directory listing`);
                    }
                }
            } catch (error) {
                console.log(`  Error: ${error.message}`);
            }
        }
        
        return {
            success: false,
            error: 'No working image patterns discovered'
        };
        
    } catch (error) {
        console.error('Discovery error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

discoverImagePatterns().then(result => {
    console.log('\n=== DISCOVERY COMPLETE ===');
    console.log(JSON.stringify(result, null, 2));
}).catch(error => {
    console.error('Unexpected error:', error);
});