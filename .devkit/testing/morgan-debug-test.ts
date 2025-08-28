#!/usr/bin/env bun

// Test Morgan Library URL parsing for specific manuscript
// https://www.themorgan.org/collection/gospel-book/143812

const testUrl = 'https://www.themorgan.org/collection/gospel-book/143812';

console.log('=== Morgan URL Analysis ===');
console.log('Input URL:', testUrl);

// Parse URL components like MorganLoader does
const objBaseMatch = testUrl.match(/\/collection\/([^/]+)\/(\d+)(?:[?#]|$)/);
if (objBaseMatch) {
    const manuscriptId = objBaseMatch[1];
    const objectId = objBaseMatch[2];
    console.log('Manuscript ID:', manuscriptId);
    console.log('Object ID:', objectId);
    console.log('Expected thumbs URL:', `https://www.themorgan.org/collection/${manuscriptId}/${objectId}/thumbs`);
}

// Test what happens when we fetch the page
async function testFetch() {
    try {
        const response = await fetch(testUrl);
        if (!response.ok) {
            console.error('Failed to fetch:', response.status);
            return;
        }
        
        const html = await response.text();
        console.log('\n=== HTML Analysis ===');
        console.log('HTML length:', html.length);
        
        // Look for image patterns
        const facsimileRegex = /\/sites\/default\/files\/facsimile\/[^"']+\.jpg/g;
        const facsimileMatches = html.match(facsimileRegex) || [];
        console.log('Facsimile matches found:', facsimileMatches.length);
        facsimileMatches.slice(0, 3).forEach((match, i) => {
            console.log(`  ${i + 1}: ${match}`);
        });
        
        // Look for styled images
        const styledRegex = /\/styles\/[^"']*\/public\/facsimile\/[^"']+\.jpg/g;
        const styledMatches = html.match(styledRegex) || [];
        console.log('Styled matches found:', styledMatches.length);
        styledMatches.slice(0, 3).forEach((match, i) => {
            console.log(`  ${i + 1}: ${match}`);
        });
        
        // Look for ZIF candidates
        const zifPattern = /facsimile\/(\d+)\/([^"'?]+)\.jpg/g;
        const zifCandidates: string[] = [];
        let match;
        while ((match = zifPattern.exec(html)) !== null) {
            if (match[1] && match[2]) {
                zifCandidates.push(`https://host.themorgan.org/facsimile/${match[1]}/${match[2]}.zif`);
            }
        }
        console.log('Potential ZIF URLs:', zifCandidates.length);
        zifCandidates.slice(0, 3).forEach((url, i) => {
            console.log(`  ${i + 1}: ${url}`);
        });
        
    } catch (error) {
        console.error('Fetch error:', error);
    }
}

testFetch();