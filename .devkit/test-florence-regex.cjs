const https = require('https');

async function testFlorenceRegex() {
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
                // Test various regex patterns
                const patterns = [
                    /window\.__INITIAL_STATE__\s*=\s*JSON\.parse\s*\(\s*"([^"]*(?:\\.[^"]*)*)"\s*\)\s*;/,
                    /window\.__INITIAL_STATE__\s*=\s*JSON\.parse\("([^"]*)"\);/,
                    /window\.__INITIAL_STATE__[^"]*"([^"]*(?:\\.[^"]*)*)"[^;]*;/,
                    /__INITIAL_STATE__.*?"([^"]+(?:\\.[^"]*)*)"[^;]*;/
                ];
                
                console.log('Testing regex patterns:');
                
                for (let i = 0; i < patterns.length; i++) {
                    const match = html.match(patterns[i]);
                    if (match) {
                        console.log(`✅ Pattern ${i + 1} MATCHES`);
                        console.log(`Captured length: ${match[1].length}`);
                        console.log(`First 100 chars: ${match[1].substring(0, 100)}`);
                        
                        // Test if we can parse it
                        try {
                            let jsonString = match[1]
                                .replace(/\\"/g, '"')
                                .replace(/\\\\/g, '\\')
                                .replace(/\\n/g, '\n')
                                .replace(/\\r/g, '\r')
                                .replace(/\\t/g, '\t')
                                .replace(/\\u([0-9a-fA-F]{4})/g, (m, code) => {
                                    return String.fromCharCode(parseInt(code, 16));
                                });
                            
                            const parsed = JSON.parse(jsonString);
                            console.log(`✅ JSON parses successfully`);
                            console.log(`Has item.item.parent.children: ${!!parsed.item?.item?.parent?.children}`);
                            if (parsed.item?.item?.parent?.children) {
                                console.log(`Children count: ${parsed.item.item.parent.children.length}`);
                            }
                            
                            console.log(`This is the correct pattern to use!\n`);
                            break;
                        } catch (e) {
                            console.log(`❌ JSON parse failed: ${e.message}\n`);
                        }
                    } else {
                        console.log(`❌ Pattern ${i + 1} no match`);
                    }
                }
                
                resolve();
            });
        }).on('error', reject);
    });
}

testFlorenceRegex().catch(console.error);