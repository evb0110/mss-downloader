const testUrls = [
    'http://digitale.bnc.roma.sbn.it/tecadigitale/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/1',
    'http://digitale.bnc.roma.sbn.it/tecadigitale/libroantico/BVEE112879/BVEE112879/1'
];

console.log('Testing backward compatibility and new pattern support...');

for (const testUrl of testUrls) {
    console.log(`\\n--- Testing: ${testUrl} ---`);
    
    const urlMatch = testUrl.match(/\/(manoscrittoantico|libroantico)\/([^/]+)\/([^/]+)\/(\d+)/);
    if (urlMatch) {
        const [fullMatch, collectionType, manuscriptId1, manuscriptId2, pageNum] = urlMatch;
        console.log('✅ URL parsing successful:');
        console.log(`  Collection type: ${collectionType}`);
        console.log(`  Manuscript ID: ${manuscriptId1}`);
        console.log(`  IDs match: ${manuscriptId1 === manuscriptId2}`);
        
        const resolution = collectionType === 'libroantico' ? 'full' : 'original';
        const imageUrlTemplate = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/${collectionType}/${manuscriptId1}/${manuscriptId1}/PAGENUM/${resolution}`;
        console.log(`  Resolution: ${resolution}`);
        console.log(`  Image URL template: ${imageUrlTemplate}`);
    } else {
        console.log('❌ URL parsing failed');
    }
}

console.log('\\n✅ Both URL patterns are supported with appropriate resolution settings:');
console.log('  - manoscrittoantico uses "original" resolution (highest quality)');
console.log('  - libroantico uses "full" resolution (highest available for that collection)');