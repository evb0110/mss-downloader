const https = require('https');

// Test fetching the Roman Archive page
const url = 'https://imagoarchiviodistatoroma.cultura.gov.it/Preziosi/scheda.php?r=995-882';

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('HTML Length:', data.length);
    
    // Try to extract paths
    const pathMatch = data.match(/Path=([^&"'\s]+)/g);
    if (pathMatch) {
      console.log('\nAll Path= patterns found:');
      pathMatch.forEach(p => console.log(' -', p));
    }
    
    // Try to extract manuscript paths from image sources
    const imgMatches = data.match(/\/preziosi\/[^/]+\/[^/]+\/[^/]+\.jp2/g);
    if (imgMatches) {
      console.log('\nAll image paths found:');
      const uniquePaths = [...new Set(imgMatches.map(m => {
        const parts = m.split('/');
        return `${parts[1]}/${parts[2]}/${parts[3]}`;
      }))];
      uniquePaths.forEach(p => console.log(' -', p));
    }
    
    // Try to extract r= parameters (manuscript references)
    const rMatches = data.match(/r=([^&"'\s]+\.jp2)/g);
    if (rMatches) {
      console.log('\nAll r= image references found:');
      rMatches.forEach(r => console.log(' -', r));
    }
    
    // Extract Carte (page count)
    const pageCountMatch = data.match(/<td class="intestazione">\s*Carte\s*<\/td>\s*<td class="dati">[^<]*?(\d+)/);
    if (pageCountMatch) {
      console.log('\nPage count from Carte field:', pageCountMatch[1]);
    }
  });
}).on('error', (err) => {
  console.error('Error:', err);
});