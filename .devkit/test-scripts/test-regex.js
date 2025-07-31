#!/usr/bin/env node

/**
 * Test regex patterns
 */

// Test data from our debug output
const testString = '"id":317515,"parentId":317539,"collectionAlias":"plutei"';

console.log('Test string:', testString);
console.log('');

// Test different regex patterns
const patterns = [
    /"id":(\d+)/g,
    /"id":\s*(\d+)/g,
    /id.*?(\d+)/g,
    /(\d+)/g
];

patterns.forEach((pattern, i) => {
    console.log(`Pattern ${i + 1}: ${pattern}`);
    const matches = [...testString.matchAll(pattern)];
    console.log(`Matches: ${matches.length}`);
    matches.forEach((match, j) => {
        console.log(`  ${j + 1}. ${match[1]} (full: ${match[0]})`);
    });
    console.log('');
});

console.log('Direct includes test:');
console.log('Contains "id":', testString.includes('"id"'));
console.log('Contains ":317515":', testString.includes(':317515'));
console.log('Contains "317515":', testString.includes('317515'));