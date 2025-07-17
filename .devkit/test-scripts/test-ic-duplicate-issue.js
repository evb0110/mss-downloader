const axios = require('axios');

// Test URLs that might have duplicate issues
const TEST_URLS = [
    'https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Adigitallibrary.sns.it%3A1001%3AM000003&mode=all&teca=Unknown',
    'https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Ainternetculturale.sbn.it%3A21%3AVE0049%3ACSTOR094-01251&mode=all&teca=Unknown',
    'https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Adl.sismelfirenze.it%3A21%3AFI0098%3AMSS%3ADLFE_000000000076&mode=all&teca=Unknown'
];

async function analyzeInternetCulturaleXML(url) {
    console.log('\n=== Analyzing:', url);
    
    try {
        // Extract OAI ID
        const oaiMatch = url.match(/id=([^&]+)/);
        if (!oaiMatch) {
            console.error('Invalid URL');
            return;
        }
        
        const oaiId = decodeURIComponent(oaiMatch[1]);
        const tecaMatch = url.match(/teca=([^&]+)/);
        const teca = tecaMatch ? decodeURIComponent(tecaMatch[1]) : 'Unknown';
        
        console.log('OAI ID:', oaiId);
        
        // Establish session
        await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }
        });
        
        // Fetch XML
        const apiUrl = `https://www.internetculturale.it/jmms/magparser?id=${encodeURIComponent(oaiId)}&teca=${encodeURIComponent(teca)}&mode=all&fulltext=0`;
        
        const response = await axios.get(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/xml, application/xml, */*; q=0.01',
                'Referer': url,
                'X-Requested-With': 'XMLHttpRequest',
            }
        });
        
        const xmlText = response.data;
        console.log('XML length:', xmlText.length);
        
        // Extract all page URLs
        const pageRegex = /<page[^>]+src="([^"]+)"[^>]*>/g;
        const allUrls = [];
        let match;
        
        while ((match = pageRegex.exec(xmlText)) !== null) {
            allUrls.push(match[1]);
        }
        
        console.log('Total page elements found:', allUrls.length);
        
        // Analyze for duplicates
        const urlCounts = new Map();
        allUrls.forEach(url => {
            const count = urlCounts.get(url) || 0;
            urlCounts.set(url, count + 1);
        });
        
        const uniqueUrls = Array.from(urlCounts.keys());
        console.log('Unique URLs:', uniqueUrls.length);
        
        // Check for duplicate patterns
        let hasDuplicates = false;
        urlCounts.forEach((count, url) => {
            if (count > 1) {
                hasDuplicates = true;
                console.log(`DUPLICATE: "${url}" appears ${count} times`);
            }
        });
        
        if (hasDuplicates) {
            console.log('\n⚠️  DUPLICATE ISSUE DETECTED!');
            
            // Show first few unique URLs
            console.log('\nFirst 5 unique URLs:');
            uniqueUrls.slice(0, 5).forEach((url, i) => {
                console.log(`${i + 1}: ${url}`);
            });
            
            // Try to detect pattern
            if (uniqueUrls.length === 1) {
                console.log('\n❌ CRITICAL: Only 1 unique URL but multiple pages expected!');
                console.log('Single URL:', uniqueUrls[0]);
                
                // Check if XML has a different structure
                console.log('\nChecking for alternative patterns...');
                
                const altPatterns = [
                    /<page[^>]*>([^<]+)<\/page>/g,
                    /src="([^"]*cacheman[^"]*\.jpg)"/g,
                    /url="([^"]*cacheman[^"]*\.jpg)"/g
                ];
                
                for (const altRegex of altPatterns) {
                    const altMatches = [];
                    let altMatch;
                    while ((altMatch = altRegex.exec(xmlText)) !== null) {
                        if (altMatch[1].includes('.jpg') || altMatch[1].includes('.jpeg')) {
                            altMatches.push(altMatch[1]);
                        }
                    }
                    
                    if (altMatches.length > 0) {
                        console.log(`\nAlternative pattern found: ${altRegex.source}`);
                        console.log(`Matches: ${altMatches.length}`);
                        
                        const altUnique = new Set(altMatches);
                        console.log(`Unique: ${altUnique.size}`);
                        
                        if (altUnique.size > 1) {
                            console.log('First 3 URLs:');
                            Array.from(altUnique).slice(0, 3).forEach(url => console.log(' -', url));
                        }
                    }
                }
            }
        } else {
            console.log('✓ No duplicate issues found');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
        }
    }
}

async function runAnalysis() {
    console.log('Analyzing Internet Culturale URLs for duplicate issues...\n');
    
    for (const url of TEST_URLS) {
        await analyzeInternetCulturaleXML(url);
    }
    
    console.log('\n=== Analysis Complete ===');
}

runAnalysis().catch(console.error);