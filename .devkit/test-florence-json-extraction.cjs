const https = require('https');

async function testFlorenceJsonExtraction() {
    console.log('=== Florence JSON Extraction Test ===\n');
    
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
                    console.log('Testing different regex patterns...\n');
                    
                    // Method 1: Look for the start and find the matching closing
                    const startIndex = html.indexOf('window.__INITIAL_STATE__ = JSON.parse(');
                    if (startIndex !== -1) {
                        const jsonStart = html.indexOf('"', startIndex);
                        let depth = 0;
                        let inString = false;
                        let escaped = false;
                        let jsonEnd = -1;
                        
                        for (let i = jsonStart + 1; i < html.length; i++) {
                            const char = html[i];
                            
                            if (escaped) {
                                escaped = false;
                                continue;
                            }
                            
                            if (char === '\\') {
                                escaped = true;
                                continue;
                            }
                            
                            if (char === '"' && !inString) {
                                inString = true;
                            } else if (char === '"' && inString) {
                                inString = false;
                            }
                            
                            if (!inString) {
                                if (char === '{') depth++;
                                else if (char === '}') depth--;
                                
                                if (depth === 0 && char === '"' && html[i + 1] === ')') {
                                    jsonEnd = i;
                                    break;
                                }
                            }
                        }
                        
                        if (jsonEnd !== -1) {
                            const rawJson = html.substring(jsonStart + 1, jsonEnd);
                            console.log('Raw JSON length:', rawJson.length);
                            console.log('Raw JSON start:', rawJson.substring(0, 100) + '...');
                            
                            try {
                                // Decode escaped characters
                                const decodedJson = rawJson
                                    .replace(/\\"/g, '"')
                                    .replace(/\\\\/g, '\\')
                                    .replace(/\\n/g, '\n')
                                    .replace(/\\r/g, '\r')
                                    .replace(/\\t/g, '\t');
                                
                                const initialState = JSON.parse(decodedJson);
                                console.log('✅ Successfully parsed JSON');
                                console.log('Item data exists:', !!initialState.item?.item);
                                
                                if (initialState.item?.item) {
                                    const item = initialState.item.item;
                                    console.log('Item ID:', item.id);
                                    console.log('Parent ID:', item.parentId);
                                    console.log('Has parent children:', !!item.parent?.children);
                                    
                                    if (item.parent?.children) {
                                        console.log('Children count:', item.parent.children.length);
                                        console.log('First child ID:', item.parent.children[0]?.id);
                                        console.log('First child title:', item.parent.children[0]?.title);
                                    }
                                }
                                
                            } catch (parseError) {
                                console.log('❌ JSON parse failed:', parseError.message);
                                console.log('First 200 chars of decoded JSON:', decodedJson.substring(0, 200));
                            }
                        } else {
                            console.log('❌ Could not find JSON end');
                        }
                    } else {
                        console.log('❌ Could not find __INITIAL_STATE__ start');
                    }
                    
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', reject);
    });
}

testFlorenceJsonExtraction().catch(console.error);