// Test Morgan manuscript ID extraction
const testUrl = 'https://www.themorgan.org/collection/lindau-gospels/thumbs';

// Test single page match
const singlePageMatch = testUrl.match(/\/collection\/([^/]+)\/(\d+)/);
console.log('Single page match:', singlePageMatch);

// Test collection match  
const collectionMatch = testUrl.match(/\/collection\/([^/]+)/);
console.log('Collection match:', collectionMatch);

if (collectionMatch) {
    const manuscriptId = collectionMatch[1];
    console.log('Extracted manuscript ID:', manuscriptId);
    console.log('Is manuscriptId truthy?', !!manuscriptId);
} else {
    console.log('No collection match found');
}