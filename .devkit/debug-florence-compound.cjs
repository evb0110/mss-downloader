const fs = require('fs');
const https = require('https');

async function debugFlorenceCompound() {
    console.log('=== Florence Compound Object Debug ===\n');
    
    const url = 'https://cdm21059.contentdm.oclc.org/digital/collection/plutei/id/317515/';
    
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (res) => {
            let html = '';
            res.on('data', chunk => html += chunk);
            res.on('end', () => {
                try {
                    console.log('Searching for __INITIAL_STATE__...');
                    
                    // Save raw HTML for inspection
                    fs.writeFileSync('/tmp/florence_debug.html', html);
                    console.log('Raw HTML saved to /tmp/florence_debug.html');
                    
                    // Look for the initial state with better parsing
                    const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*JSON\.parse\s*\(\s*"([^"]+(?:\\.[^"]*)*)"\s*\)\s*;/);
                    
                    if (stateMatch) {
                        console.log('Found __INITIAL_STATE__ pattern');
                        console.log('Raw JSON string length:', stateMatch[1].length);
                        console.log('First 200 chars:', stateMatch[1].substring(0, 200));
                        
                        try {
                            // Decode the JSON string properly
                            let jsonString = stateMatch[1];
                            
                            // Handle common escape sequences
                            jsonString = jsonString
                                .replace(/\\"/g, '"')
                                .replace(/\\\\/g, '\\')
                                .replace(/\\n/g, '\n')
                                .replace(/\\r/g, '\r')
                                .replace(/\\t/g, '\t')
                                .replace(/\\u([0-9a-fA-F]{4})/g, (match, code) => {
                                    return String.fromCharCode(parseInt(code, 16));
                                });
                            
                            const initialState = JSON.parse(jsonString);
                            console.log('✅ Successfully parsed JSON');
                            
                            // Inspect the structure
                            console.log('\n=== Structure Analysis ===');
                            console.log('Has item:', !!initialState.item);
                            
                            if (initialState.item) {
                                console.log('Has item.item:', !!initialState.item.item);
                                
                                if (initialState.item.item) {
                                    const item = initialState.item.item;
                                    console.log('Item ID:', item.id);
                                    console.log('Parent ID:', item.parentId);
                                    console.log('Has parent:', !!item.parent);
                                    
                                    if (item.parent) {
                                        console.log('Parent has children:', !!item.parent.children);
                                        console.log('Parent has nodes:', !!item.parent.nodes);
                                        
                                        if (item.parent.children) {
                                            console.log('Children count:', item.parent.children.length);
                                            console.log('First child:', item.parent.children[0]);
                                            console.log('Last child:', item.parent.children[item.parent.children.length - 1]);
                                        }
                                        
                                        if (item.parent.nodes) {
                                            console.log('Nodes count:', item.parent.nodes.length);
                                        }
                                    }
                                }
                            }
                            
                        } catch (parseError) {
                            console.log('❌ JSON parse failed:', parseError.message);
                            
                            // Try to find where the JSON becomes invalid
                            let testLength = 1000;
                            while (testLength < stateMatch[1].length) {
                                try {
                                    const testString = stateMatch[1].substring(0, testLength)
                                        .replace(/\\"/g, '"')
                                        .replace(/\\\\/g, '\\');
                                    JSON.parse(testString);
                                    testLength += 1000;
                                } catch (e) {
                                    console.log(`JSON becomes invalid around character ${testLength}`);
                                    console.log('Context:', stateMatch[1].substring(testLength - 50, testLength + 50));
                                    break;
                                }
                            }
                        }
                    } else {
                        console.log('❌ Could not find __INITIAL_STATE__ pattern');
                        
                        // Look for alternative patterns
                        const altPatterns = [
                            /window\.__INITIAL_STATE__.*?=.*?(\{.*?\});/s,
                            /__INITIAL_STATE__.*?=.*?JSON\.parse.*?\("([^"]+)"\)/,
                            /initialState.*?=.*?(\{.*?\})/s
                        ];
                        
                        for (let i = 0; i < altPatterns.length; i++) {
                            const match = html.match(altPatterns[i]);
                            if (match) {
                                console.log(`Found alternative pattern ${i + 1}:`, match[1].substring(0, 100));
                            }
                        }
                    }
                    
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', reject);
    });
}

debugFlorenceCompound().catch(console.error);