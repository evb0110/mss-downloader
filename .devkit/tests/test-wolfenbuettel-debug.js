const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');

async function debugWolfenbuettelThumbs() {
    const testUrl = 'https://diglib.hab.de/varia/selecta/ed000011/start.htm?distype=thumbs-img&imgtyp=0&size=';
    
    console.log('=== WOLFENBÜTTEL DEBUG TEST ===\n');
    console.log('Original URL:', testUrl);
    
    // Extract manuscript ID from URL
    const pathMatch = testUrl.match(/diglib\.hab\.de\/([^/]+\/[^/]+\/[^/]+)/);
    const manuscriptId = pathMatch ? pathMatch[1] : null;
    console.log('Extracted manuscript ID:', manuscriptId);
    
    if (!manuscriptId) {
        console.error('Failed to extract manuscript ID');
        return;
    }
    
    // Test different thumb URLs
    const thumbsVariations = [
        `https://diglib.hab.de/thumbs.php?dir=${manuscriptId}&pointer=0`,
        `https://diglib.hab.de/${manuscriptId}/thumbs.htm?pointer=0`,
        `https://diglib.hab.de/${manuscriptId}/thumbs.htm`,
        `https://diglib.hab.de/${manuscriptId}/start.htm?distype=thumbs`,
    ];
    
    console.log('\n=== TESTING THUMBS URLS ===');
    
    for (const thumbsUrl of thumbsVariations) {
        console.log(`\nTesting: ${thumbsUrl}`);
        try {
            const response = await fetch(thumbsUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            console.log(`  Status: ${response.status}`);
            console.log(`  Content-Type: ${response.headers.get('content-type')}`);
            
            if (response.ok) {
                const html = await response.text();
                console.log(`  Response length: ${html.length} bytes`);
                
                // Check for images
                const imageMatches = html.match(/image=([^'"&]+)/g) || [];
                console.log(`  Images found (image= pattern): ${imageMatches.length}`);
                
                // Check for jpg links
                const jpgMatches = html.match(/href="[^"]*\.jpg"/gi) || [];
                console.log(`  JPG links found: ${jpgMatches.length}`);
                
                // Check for forward button
                const hasForward = html.includes('forward.gif');
                console.log(`  Has forward button: ${hasForward}`);
                
                // Save first successful response for analysis
                if (imageMatches.length > 0 || jpgMatches.length > 0) {
                    const outputDir = path.join(__dirname, '../reports/wolfenbuettel-debug');
                    await fs.mkdir(outputDir, { recursive: true });
                    await fs.writeFile(path.join(outputDir, 'thumbs-response.html'), html);
                    console.log(`  ✓ Saved response to: ${outputDir}/thumbs-response.html`);
                    
                    // Extract some sample content
                    if (jpgMatches.length > 0) {
                        console.log('\n  Sample JPG links:');
                        jpgMatches.slice(0, 5).forEach(match => {
                            console.log(`    ${match}`);
                        });
                    }
                }
            }
        } catch (err) {
            console.log(`  Error: ${err.message}`);
        }
    }
    
    // Try to directly access the start page
    console.log('\n=== CHECKING START PAGE ===');
    try {
        const response = await fetch(testUrl);
        console.log(`Status: ${response.status}`);
        const html = await response.text();
        
        // Look for any patterns that might help
        const frameMatch = html.match(/<frame[^>]*src="([^"]+)"/gi);
        console.log(`Frame sources found: ${frameMatch ? frameMatch.length : 0}`);
        
        if (frameMatch) {
            console.log('Frame sources:');
            frameMatch.forEach(match => {
                console.log(`  ${match}`);
            });
        }
        
        // Check for thumbnail links
        const thumbLinks = html.match(/thumbs[^'"]*\.htm[^'"]*pointer=\d+/gi) || [];
        console.log(`\nThumb page links found: ${thumbLinks.length}`);
        if (thumbLinks.length > 0) {
            console.log('Sample thumb links:');
            thumbLinks.slice(0, 3).forEach(link => {
                console.log(`  ${link}`);
            });
        }
    } catch (err) {
        console.error('Error fetching start page:', err.message);
    }
    
    console.log('\n=== DEBUG COMPLETE ===');
}

debugWolfenbuettelThumbs().catch(console.error);