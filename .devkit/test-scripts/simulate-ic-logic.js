const axios = require('axios');

// Simulate the exact logic from EnhancedManuscriptDownloaderService
async function simulateInternetCulturaleLogic(internetCulturaleUrl) {
    console.log('\n=== Simulating Internet Culturale Logic ===');
    console.log('URL:', internetCulturaleUrl);
    
    try {
        // Extract OAI identifier from URL
        const oaiMatch = internetCulturaleUrl.match(/id=([^&]+)/);
        if (!oaiMatch) {
            throw new Error('Invalid Internet Culturale URL: missing OAI identifier');
        }
        
        const oaiId = decodeURIComponent(oaiMatch[1]);
        console.log(`OAI ID: ${oaiId}`);
        
        // Extract teca parameter for institution info
        const tecaMatch = internetCulturaleUrl.match(/teca=([^&]+)/);
        const teca = tecaMatch ? decodeURIComponent(tecaMatch[1]) : 'Unknown';
        
        // CRITICAL FIX: Establish session first by visiting main page
        console.log('Establishing Internet Culturale session...');
        const sessionHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
        };
        
        // Visit main page to establish session and get cookies
        await axios.get(internetCulturaleUrl, { headers: sessionHeaders });
        
        // Construct API URL for manifest data with all required parameters
        const apiUrl = `https://www.internetculturale.it/jmms/magparser?id=${encodeURIComponent(oaiId)}&teca=${encodeURIComponent(teca)}&mode=all&fulltext=0`;
        
        // Set headers similar to browser request
        const headers = {
            ...sessionHeaders,
            'Accept': 'text/xml, application/xml, */*; q=0.01',
            'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
            'Referer': internetCulturaleUrl,
            'X-Requested-With': 'XMLHttpRequest',
        };
        
        console.log(`Fetching Internet Culturale API: ${apiUrl}`);
        
        // Fetch manifest data from API
        const response = await axios.get(apiUrl, { headers });
        const xmlText = response.data;
        
        console.log('XML response length:', xmlText.length, 'characters');
        
        // Parse pages
        const pageLinks = [];
        
        // Array of regex patterns to try
        const pageRegexPatterns = [
            /<page[^>]+src="([^"]+)"[^>]*>/g,
            /<page[^>]*>([^<]+)<\/page>/g,
            /src="([^"]*cacheman[^"]*\.jpg)"/g,
            /url="([^"]*cacheman[^"]*\.jpg)"/g,
            /"([^"]*cacheman[^"]*\.jpg)"/g
        ];
        
        console.log(`[Internet Culturale] XML preview: ${xmlText.substring(0, 500)}...`);
        
        let foundPages = false;
        for (const pageRegex of pageRegexPatterns) {
            let match;
            const tempLinks = [];
            
            while ((match = pageRegex.exec(xmlText)) !== null) {
                let relativePath = match[1];
                
                // Skip non-image URLs
                if (!relativePath.includes('.jpg') && !relativePath.includes('.jpeg')) {
                    continue;
                }
                
                // Optimize Internet Culturale resolution: use 'normal' for highest quality images
                if (relativePath.includes('cacheman/web/')) {
                    relativePath = relativePath.replace('cacheman/web/', 'cacheman/normal/');
                }
                
                // Ensure absolute URL
                const imageUrl = relativePath.startsWith('http') 
                    ? relativePath 
                    : `https://www.internetculturale.it/jmms/${relativePath}`;
                
                tempLinks.push(imageUrl);
            }
            
            if (tempLinks.length > 0) {
                pageLinks.push(...tempLinks);
                foundPages = true;
                console.log(`[Internet Culturale] Found ${tempLinks.length} pages using regex pattern ${pageRegex.source}`);
                break;
            }
        }
        
        if (!foundPages) {
            console.error('[Internet Culturale] No pages found with any regex pattern');
            console.log('[Internet Culturale] Full XML response:', xmlText.substring(0, 2000));
            throw new Error('No image URLs found in XML manifest');
        }
        
        console.log('\n=== BEFORE DEDUPLICATION ===');
        console.log('Total page links:', pageLinks.length);
        console.log('First 5 URLs:');
        pageLinks.slice(0, 5).forEach((url, i) => console.log(`${i + 1}: ${url}`));
        
        // Detect and handle duplicate URLs (infinite loop prevention)
        const urlCounts = new Map();
        const uniquePageLinks = [];
        
        pageLinks.forEach((url, index) => {
            const count = urlCounts.get(url) || 0;
            urlCounts.set(url, count + 1);
            
            if (count === 0) {
                uniquePageLinks.push(url);
            } else {
                console.warn(`[Internet Culturale] Duplicate URL detected for page ${index + 1}: ${url}`);
            }
        });
        
        console.log('\n=== AFTER DEDUPLICATION ===');
        console.log('Unique URLs:', uniquePageLinks.length);
        
        // If only one unique page found, attempt to generate additional pages
        if (uniquePageLinks.length === 1 && pageLinks.length > 1) {
            console.warn(`\n⚠️  PROBLEM DETECTED: Only 1 unique page found but ${pageLinks.length} total pages expected`);
            console.log('[Internet Culturale] Attempting to generate additional page URLs...');
            
            const baseUrl = uniquePageLinks[0];
            const urlPattern = baseUrl.replace(/\/\d+\.jpg$/, '');
            
            console.log('Base URL:', baseUrl);
            console.log('URL Pattern:', urlPattern);
            
            // Generate URLs for pages 1-50 (reasonable limit)
            const generatedLinks = [];
            for (let i = 1; i <= Math.min(50, pageLinks.length); i++) {
                const generatedUrl = `${urlPattern}/${i}.jpg`;
                generatedLinks.push(generatedUrl);
            }
            
            console.log(`[Internet Culturale] Generated ${generatedLinks.length} page URLs from pattern`);
            console.log('First 5 generated URLs:');
            generatedLinks.slice(0, 5).forEach((url, i) => console.log(`${i + 1}: ${url}`));
            
            pageLinks.length = 0; // Clear original array
            pageLinks.push(...generatedLinks);
        } else {
            // Use unique pages only
            pageLinks.length = 0;
            pageLinks.push(...uniquePageLinks);
        }
        
        console.log(`\n[Internet Culturale] Final page count: ${pageLinks.length} pages`);
        
        return {
            totalPages: pageLinks.length,
            uniqueCount: uniquePageLinks.length,
            hadDuplicates: uniquePageLinks.length < pageLinks.length,
            pageLinks: pageLinks.slice(0, 5) // Just first 5 for display
        };
        
    } catch (error) {
        console.error(`Internet Culturale manifest loading failed:`, error.message);
        return null;
    }
}

// Test with problematic URLs
async function runTest() {
    const testUrls = [
        'https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Abncf.firenze.sbn.it%3A21%3AFI0098%3AManoscrittiInRete%3AB.R.231&mode=all&teca=Bncf',
        'https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Ainternetculturale.sbn.it%3A21%3ABO0049%3ACSTOR020-00013&mode=all&teca=Archiginnasio',
        'https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?id=oai%3Ateca.bmlonline.it%3A21%3AFI0095%3APalat%3A200000002260&mode=all&teca=Laurenziana'
    ];
    
    for (const url of testUrls) {
        const result = await simulateInternetCulturaleLogic(url);
        if (result) {
            console.log('\n=== RESULT ===');
            console.log(`Total pages: ${result.totalPages}`);
            console.log(`Had duplicates: ${result.hadDuplicates}`);
            if (result.totalPages <= 2) {
                console.log('❌ BUG CONFIRMED: Only 2 or fewer pages!');
            }
        }
        console.log('\n' + '='.repeat(80) + '\n');
    }
}

runTest().catch(console.error);