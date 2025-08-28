#!/usr/bin/env bun

// Analyze Morgan viewer page to find ZIF pattern
async function analyzeViewerPage() {
    // Try different potential viewer URLs
    const baseUrl = 'https://www.themorgan.org/collection/gospel-book/143812';
    const potentialViewerUrls = [
        `${baseUrl}/thumbs`,
        `${baseUrl}/1`, // First page
        `${baseUrl}/2`, // Second page
        'https://www.themorgan.org/collection/gospel-book/143812/1'
    ];
    
    for (const url of potentialViewerUrls) {
        console.log(`\n=== Analyzing: ${url} ===`);
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.log(`Status: ${response.status} ${response.statusText}`);
                continue;
            }
            
            const html = await response.text();
            
            // Look for host.themorgan.org references
            const hostRefs = html.match(/host\.themorgan\.org[^"'\s]*/g) || [];
            if (hostRefs.length > 0) {
                console.log('Host references found:');
                hostRefs.slice(0, 5).forEach((ref, i) => {
                    console.log(`  ${i + 1}: ${ref}`);
                });
            }
            
            // Look for iframe src
            const iframes = html.match(/<iframe[^>]*src="([^"]*)"[^>]*>/gi) || [];
            if (iframes.length > 0) {
                console.log('Iframes found:');
                iframes.forEach((iframe, i) => {
                    const srcMatch = iframe.match(/src="([^"]*)"/i);
                    if (srcMatch) {
                        console.log(`  ${i + 1}: ${srcMatch[1]}`);
                    }
                });
            }
            
            // Look for any ZIF or facsimile references
            const zifRefs = html.match(/[^"'\s]*facsimile[^"'\s]*/g) || [];
            if (zifRefs.length > 0) {
                console.log('Facsimile references:');
                zifRefs.slice(0, 10).forEach((ref, i) => {
                    console.log(`  ${i + 1}: ${ref}`);
                });
            }
            
        } catch (error) {
            console.log(`Error: ${error}`);
        }
    }
    
    // Let's also try to reverse-engineer from known working ZIF URL
    console.log('\n=== Reverse Engineering from Working ZIF ===');
    console.log('Working ZIF: https://host.themorgan.org/facsimile/images/m651/143812v_0009.zif');
    console.log('Pattern: /facsimile/images/{manuscript_code}/{object_id}v_{page_num}.zif');
    console.log('Need to find: manuscript_code = m651');
    console.log('Known: object_id = 143812');
    
    // Common manuscript patterns for Morgan
    const commonPatterns = [
        'm651', 'm652', 'm653', 'm654', 'm655', // Sequential
        'ms651', 'ms143812', // Different prefixes
        'M651', 'M143812' // Uppercase
    ];
    
    console.log('\n=== Testing Common Patterns ===');
    for (const pattern of commonPatterns.slice(0, 3)) {
        const testUrl = `https://host.themorgan.org/facsimile/images/${pattern}/143812v_0001.zif`;
        try {
            const response = await fetch(testUrl, { method: 'HEAD' });
            console.log(`${pattern}: ${response.status} ${response.statusText}`);
            if (response.ok) {
                console.log(`  ✅ WORKING PATTERN: ${pattern}`);
            }
        } catch (error) {
            console.log(`${pattern}: ERROR`);
        }
    }
}

analyzeViewerPage();