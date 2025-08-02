#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

async function fixPageLimits() {
    const filePath = path.join(__dirname, '../src/shared/SharedManifestLoaders.js');
    let content = await fs.readFile(filePath, 'utf8');
    
    const replacements = [
        // Remove Math.min limits (except for timeouts and retry delays)
        {
            pattern: /for \(let i = 0; i < Math\.min\(([^,]+), (?:10|50)\)/g,
            replacement: 'for (let i = 0; i < $1'
        },
        // Remove maxPages = Math.min(..., 10/50/200)
        {
            pattern: /const maxPages = Math\.min\(([^,]+), (?:10|50|200)\);/g,
            replacement: 'const maxPages = $1;'
        },
        // Fix BNE hardcoded 10 pages
        {
            pattern: /for \(let i = 1; i <= 10; i\+\+\) {/g,
            replacement: 'for (let i = 1; i <= 300; i++) { // Extended to 300 pages for full manuscripts'
        },
        // Fix Morgan ICA hardcoded 10 pages
        {
            pattern: /for \(let i = 1; i <= 10; i\+\+\) {\s*images\.push\({/g,
            replacement: 'for (let i = 1; i <= 100; i++) { // Extended for full manuscripts\n                        images.push({'
        },
        // Remove "first 10 pages" comments
        {
            pattern: /\/\/ Extract first 10 pages.*\n/g,
            replacement: '// Extract all pages with IIIF URLs\n'
        },
        {
            pattern: /\/\/ Get first 10 pages.*\n/g,
            replacement: '// Get all pages\n'
        },
        {
            pattern: /\/\/ Fetch first 10 individual pages.*\n/g,
            replacement: '// Fetch all individual pages to get high-res URLs\n'
        },
        {
            pattern: /\/\/ Process first 10 pages for initial load.*\n/g,
            replacement: '// Process all pages\n'
        },
        // Keep reasonable limits for e-manuscripta (500 is reasonable)
        // Keep timeout limits (300000ms) 
        // Keep exponential backoff limits
    ];
    
    // Apply replacements
    for (const {pattern, replacement} of replacements) {
        const before = content.match(pattern)?.length || 0;
        content = content.replace(pattern, replacement);
        const after = content.match(pattern)?.length || 0;
        console.log(`Pattern ${pattern}: ${before} replacements made`);
    }
    
    // Write back
    await fs.writeFile(filePath, content);
    console.log('Fixed all page limits in SharedManifestLoaders.js');
}

fixPageLimits().catch(console.error);