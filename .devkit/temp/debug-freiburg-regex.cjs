const https = require('https');

async function fetchAndDebugMets() {
    const url = 'https://dl.ub.uni-freiburg.de/diglitData/mets/hs360a.xml';
    
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('METS XML fetched successfully\n');
                
                // Debug the XML structure
                const fileGrpRegex = /<mets:fileGrp[^>]*USE="([^"]*)"[^>]*>(.*?)<\/mets:fileGrp>/gs;
                const fileRegex = /<mets:file[^>]*ID="([^"]*)"[^>]*MIMETYPE="([^"]*)"[^>]*>.*?<mets:FLocat[^>]*xlink:href="([^"]*)"[^>]*\/?>.*?<\/mets:file>/gs;
                
                let fileGrpMatch;
                let groupCount = 0;
                
                while ((fileGrpMatch = fileGrpRegex.exec(data)) !== null && groupCount < 2) {
                    groupCount++;
                    const use = fileGrpMatch[1];
                    const grpContent = fileGrpMatch[2];
                    
                    console.log(`=== File Group ${groupCount}: ${use} ===`);
                    console.log(`Group content length: ${grpContent.length} chars`);
                    
                    // Show first few lines of group content
                    const lines = grpContent.split('\n').slice(0, 10);
                    console.log('First 10 lines:');
                    lines.forEach((line, i) => {
                        if (line.trim()) {
                            console.log(`${i + 1}: ${line.trim()}`);
                        }
                    });
                    
                    // Try to match files
                    let fileMatch;
                    let fileCount = 0;
                    fileRegex.lastIndex = 0;
                    
                    console.log('\nTesting file regex...');
                    
                    while ((fileMatch = fileRegex.exec(grpContent)) !== null && fileCount < 5) {
                        fileCount++;
                        console.log(`File ${fileCount}:`);
                        console.log(`  ID: ${fileMatch[1]}`);
                        console.log(`  MIMETYPE: ${fileMatch[2]}`);
                        console.log(`  href: ${fileMatch[3]}`);
                        
                        if (fileMatch[3]) {
                            const filename = fileMatch[3].split('/').pop();
                            console.log(`  filename: ${filename}`);
                        }
                        console.log('');
                    }
                    
                    console.log(`Total files found in ${use}: ${fileCount}\n`);
                }
                
                // Try alternative regex patterns
                console.log('=== Testing Alternative Patterns ===\n');
                
                const altRegex1 = /<mets:FLocat[^>]*xlink:href="([^"]*)"[^>]*\/?>/g;
                const hrefMatches = [];
                let match;
                
                while ((match = altRegex1.exec(data)) !== null && hrefMatches.length < 10) {
                    hrefMatches.push(match[1]);
                }
                
                console.log('Found hrefs with simple pattern:');
                hrefMatches.forEach((href, i) => {
                    console.log(`${i + 1}: ${href}`);
                });
                
                resolve(data);
            });
        }).on('error', reject);
    });
}

if (require.main === module) {
    fetchAndDebugMets().catch(console.error);
}