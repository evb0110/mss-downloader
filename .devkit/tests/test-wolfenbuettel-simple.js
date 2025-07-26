const fetch = require('node-fetch');

async function testWolfenbuettelSimple() {
    console.log('=== SIMPLE WOLFENBÜTTEL TEST ===\n');
    
    const manuscriptId = 'varia/selecta/ed000011';
    let pointer = 0;
    let totalPages = 0;
    let iterations = 0;
    
    console.log('Testing pagination for:', manuscriptId);
    console.log('Looking for forward button pattern: pfeilrechtsaktiv.gif\n');
    
    while (iterations < 20) { // Safety limit
        const thumbsUrl = `https://diglib.hab.de/thumbs.php?dir=${manuscriptId}&pointer=${pointer}`;
        console.log(`\nIteration ${iterations + 1}:`);
        console.log(`  URL: ${thumbsUrl}`);
        
        try {
            const response = await fetch(thumbsUrl);
            const html = await response.text();
            
            // Count images
            const imageMatches = html.matchAll(/image=([^'"&]+)/g);
            const imageCount = Array.from(imageMatches).length;
            totalPages += imageCount;
            console.log(`  Images on this page: ${imageCount}`);
            
            // Test original regex (that was failing)
            const oldRegex = /href="thumbs\.php\?dir=[^&]+&pointer=(\d+)"[^>]*><img[^>]*title="forward"/;
            const oldMatch = html.match(oldRegex);
            console.log(`  Old regex match: ${oldMatch ? 'YES' : 'NO'}`);
            
            // Test new regex (fixed)
            const newRegex = /href="thumbs\.php\?dir=[^&]+&pointer=(\d+)"[^>]*>.*?pfeilrechtsaktiv\.gif/;
            const newMatch = html.match(newRegex);
            console.log(`  New regex match: ${newMatch ? 'YES' : 'NO'}`);
            
            if (newMatch) {
                const nextPointer = parseInt(newMatch[1], 10);
                console.log(`  Next pointer: ${nextPointer}`);
                
                if (nextPointer === pointer) {
                    console.log(`  => Reached end (same pointer)`);
                    break;
                }
                
                pointer = nextPointer;
            } else {
                console.log(`  => No forward button found`);
                break;
            }
            
        } catch (err) {
            console.error(`  Error: ${err.message}`);
            break;
        }
        
        iterations++;
    }
    
    console.log('\n=== RESULTS ===');
    console.log(`Total iterations: ${iterations}`);
    console.log(`Total images found: ${totalPages}`);
    console.log(`Status: ${totalPages > 20 ? 'SUCCESS - Found many pages!' : 'FAILED - Too few pages'}`);
}

testWolfenbuettelSimple().catch(console.error);