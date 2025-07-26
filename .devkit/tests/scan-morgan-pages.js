async function scanMorganPages() {
    console.log('📖 Scanning Morgan Library pages...\n');
    
    const manuscripts = [
        { id: 'lindau-gospels', name: 'Lindau Gospels', pages: [1, 2, 3, 4, 5] },
        { id: 'arenberg-gospels', name: 'Arenberg Gospels', pages: [1, 2, 3, 4, 5] }
    ];
    
    for (const manuscript of manuscripts) {
        console.log(`\n🔍 ${manuscript.name}`);
        console.log('=' .repeat(50));
        
        for (const pageNum of manuscript.pages) {
            const pageUrl = `https://www.themorgan.org/collection/${manuscript.id}/${pageNum}`;
            console.log(`\nPage ${pageNum}: ${pageUrl}`);
            
            try {
                const response = await fetch(pageUrl);
                if (!response.ok) {
                    console.log(`  ❌ Failed: ${response.status}`);
                    continue;
                }
                
                const html = await response.text();
                
                // Find facsimile image
                const facsimileMatch = html.match(/\/sites\/default\/files\/facsimile\/[^"']+\.jpg/);
                if (facsimileMatch) {
                    console.log(`  ✅ Found: ${facsimileMatch[0]}`);
                    
                    // Extract just the filename
                    const filename = facsimileMatch[0].split('/').pop();
                    console.log(`     Filename: ${filename}`);
                } else {
                    console.log('  ❌ No facsimile image found');
                }
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.log(`  ❌ Error: ${error.message}`);
            }
        }
    }
}

scanMorganPages().catch(console.error);