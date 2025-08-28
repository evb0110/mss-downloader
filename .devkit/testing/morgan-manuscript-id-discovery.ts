#!/usr/bin/env bun

// Discover how to find the manuscript identifier (m651) from the webpage
async function discoverManuscriptId() {
    const url = 'https://www.themorgan.org/collection/gospel-book/143812';
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error('Failed to fetch:', response.status);
            return;
        }
        
        const html = await response.text();
        console.log('=== Searching for Manuscript ID Pattern ===');
        
        // Look for m651 or similar patterns
        const manuscriptIdPatterns = [
            /m\d+/g,
            /M\d+/g,
            /"m\d+"/g,
            /'m\d+'/g,
            /manuscript[_-]?id[^"']*["']([^"']+)/gi,
            /manuscript[^"']*["']([^"']+)/gi,
            /ms[_-]?id[^"']*["']([^"']+)/gi,
            /object[_-]?id[^"']*["']([^"']+)/gi,
            /host\.themorgan\.org\/facsimile\/images\/([^\/]+)/g,
            /facsimile\/images\/([^\/]+)/g
        ];
        
        for (const pattern of manuscriptIdPatterns) {
            const matches = [...html.matchAll(pattern)];
            if (matches.length > 0) {
                console.log(`Pattern ${pattern}: Found ${matches.length} matches`);
                matches.slice(0, 5).forEach((match, i) => {
                    console.log(`  ${i + 1}: ${match[0]} (group1: ${match[1] || 'none'})`);
                });
            }
        }
        
        // Look for any reference to host.themorgan.org
        const hostReferences = html.match(/host\.themorgan\.org[^"']*/g) || [];
        console.log('\n=== Host References ===');
        hostReferences.slice(0, 10).forEach((ref, i) => {
            console.log(`${i + 1}: ${ref}`);
        });
        
        // Look for iframe or embedded viewer references
        const iframeMatches = html.match(/<iframe[^>]*src="([^"]*host\.themorgan\.org[^"]*)"[^>]*>/gi) || [];
        console.log('\n=== Iframe References ===');
        iframeMatches.forEach((iframe, i) => {
            console.log(`${i + 1}: ${iframe}`);
        });
        
        // Look for JavaScript variables or data attributes
        const jsVarPatterns = [
            /var\s+manuscript\s*=\s*["']([^"']+)["']/gi,
            /data-manuscript[^=]*=\s*["']([^"']+)["']/gi,
            /data-object[^=]*=\s*["']([^"']+)["']/gi,
            /"manuscript":\s*["']([^"']+)["']/gi,
            /"objectId":\s*["']([^"']+)["']/gi
        ];
        
        console.log('\n=== JavaScript Variables ===');
        for (const pattern of jsVarPatterns) {
            const matches = [...html.matchAll(pattern)];
            if (matches.length > 0) {
                console.log(`Pattern ${pattern}: Found ${matches.length} matches`);
                matches.forEach((match, i) => {
                    console.log(`  ${i + 1}: ${match[1]}`);
                });
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

discoverManuscriptId();