#!/usr/bin/env node

const https = require('https');
const fs = require('fs');

async function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function analyzeEManuscripta() {
    console.log('🔍 Analyzing E-Manuscripta Multi-Block Structure...\n');
    
    // Test the main manifest URL
    const manifestUrl = 'https://www.e-manuscripta.ch/i3f/v20/5157222/manifest';
    
    try {
        console.log('📋 Fetching IIIF Manifest...');
        const manifest = await fetchJson(manifestUrl);
        
        console.log('📊 MANIFEST ANALYSIS:');
        console.log(`- Type: ${manifest['@type']}`);
        console.log(`- Label: ${manifest.label}`);
        console.log(`- Total Sequences: ${manifest.sequences?.length || 0}`);
        
        if (manifest.sequences && manifest.sequences[0]) {
            const sequence = manifest.sequences[0];
            console.log(`- Total Canvases: ${sequence.canvases?.length || 0}`);
            
            // Analyze ranges (blocks)
            if (manifest.structures) {
                console.log(`\n📚 STRUCTURE ANALYSIS (${manifest.structures.length} ranges):`);
                
                manifest.structures.forEach((range, index) => {
                    console.log(`\n${index + 1}. ${range.label}`);
                    console.log(`   - Type: ${range['@type']}`);
                    console.log(`   - ID: ${range['@id']}`);
                    
                    if (range.canvases) {
                        console.log(`   - Direct Canvases: ${range.canvases.length}`);
                        console.log(`   - First Canvas: ${range.canvases[0]}`);
                        console.log(`   - Last Canvas: ${range.canvases[range.canvases.length - 1]}`);
                    }
                    
                    if (range.ranges) {
                        console.log(`   - Sub-ranges: ${range.ranges.length}`);
                    }
                });
            }
            
            // Analyze first few canvases to understand structure
            console.log(`\n🖼️  CANVAS ANALYSIS (First 5):`);
            sequence.canvases.slice(0, 5).forEach((canvas, index) => {
                console.log(`\n${index + 1}. ${canvas.label || 'Unlabeled'}`);
                console.log(`   - ID: ${canvas['@id']}`);
                if (canvas.images && canvas.images[0]) {
                    const imageUrl = canvas.images[0].resource['@id'];
                    console.log(`   - Image URL: ${imageUrl}`);
                }
            });
            
            // Check if there are multiple "blocks" based on URLs
            console.log(`\n🔗 URL PATTERN ANALYSIS:`);
            const allCanvases = sequence.canvases;
            const canvasIds = allCanvases.map(c => c['@id']);
            
            // Extract numeric IDs from canvas URLs
            const numericIds = canvasIds.map(url => {
                const match = url.match(/canvas\/(\d+)/);
                return match ? parseInt(match[1]) : null;
            }).filter(id => id !== null);
            
            console.log(`- Canvas ID Range: ${Math.min(...numericIds)} to ${Math.max(...numericIds)}`);
            console.log(`- Total Unique IDs: ${numericIds.length}`);
            
            // Check for gaps that might indicate blocks
            numericIds.sort((a, b) => a - b);
            const gaps = [];
            for (let i = 1; i < numericIds.length; i++) {
                if (numericIds[i] - numericIds[i-1] > 1) {
                    gaps.push({
                        from: numericIds[i-1],
                        to: numericIds[i],
                        gap: numericIds[i] - numericIds[i-1] - 1
                    });
                }
            }
            
            if (gaps.length > 0) {
                console.log(`\n⚠️  POTENTIAL BLOCK GAPS DETECTED:`);
                gaps.forEach(gap => {
                    console.log(`   - Gap between ${gap.from} and ${gap.to} (missing ${gap.gap} IDs)`);
                });
            }
            
            // Test related URLs to see if they're part of the same manuscript
            const testIds = [5157228, 5157615, 5157616];
            console.log(`\n🧪 TESTING RELATED URLS:`);
            
            for (const id of testIds) {
                try {
                    const testUrl = `https://www.e-manuscripta.ch/i3f/v20/${id}/manifest`;
                    console.log(`\n   Testing: ${testUrl}`);
                    const testManifest = await fetchJson(testUrl);
                    console.log(`   ✅ Valid manifest found for ${id}`);
                    console.log(`   - Label: ${testManifest.label}`);
                    if (testManifest.sequences && testManifest.sequences[0]) {
                        console.log(`   - Canvases: ${testManifest.sequences[0].canvases.length}`);
                    }
                } catch (e) {
                    console.log(`   ❌ No manifest for ${id}: ${e.message}`);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Error fetching manifest:', error.message);
    }
}

// Run analysis
analyzeEManuscripta().catch(console.error);