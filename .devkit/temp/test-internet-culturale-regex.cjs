const https = require('https');

// Test the new regex against the actual XML
const url = 'https://www.internetculturale.it/jmms/magparser?id=oai%3Ateca.bmlonline.it%3A21%3AXXXX%3APlutei%3AIT%253AFI0100_Plutei_21.29&teca=Laurenziana+-+FI&mode=all&fulltext=0&_=1751184402139';

https.get(url, (res) => {
    let xmlText = '';
    res.on('data', (chunk) => {
        xmlText += chunk;
    });
    
    res.on('end', () => {
        console.log('XML Response Length:', xmlText.length);
        
        // Old regex (incorrect - expects src in opening tag)
        const oldRegex = /<page[^>]+src="([^"]+)"[^>]*>/g;
        const oldMatches = [];
        let oldMatch;
        while ((oldMatch = oldRegex.exec(xmlText)) !== null) {
            oldMatches.push(oldMatch[1]);
        }
        
        // New regex (correct - finds src attributes anywhere)
        const newRegex = /src="(cacheman[^"]+\.jpg)"/g;
        const newMatches = [];
        let newMatch;
        while ((newMatch = newRegex.exec(xmlText)) !== null) {
            newMatches.push(newMatch[1]);
        }
        
        console.log('Old regex matches:', oldMatches.length);
        console.log('New regex matches:', newMatches.length);
        console.log('First few new matches:');
        newMatches.slice(0, 5).forEach((match, i) => {
            console.log(`  ${i + 1}: ${match}`);
        });
        
        if (newMatches.length > 0) {
            console.log('\nLast few new matches:');
            newMatches.slice(-3).forEach((match, i) => {
                console.log(`  ${newMatches.length - 2 + i}: ${match}`);
            });
        }
    });
}).on('error', (err) => {
    console.error('Error:', err);
});