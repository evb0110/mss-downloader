#!/usr/bin/env node
const fs = require('fs');

const testCases = JSON.parse(fs.readFileSync('.devkit/issue-test-cases.json', 'utf8'));

const libraryMethods = {
    'bordeaux': 'getBordeauxManifest',
    'linz': 'getLinzManifest', 
    'walters': 'getWaltersManifest',
    'ambrosiana': 'getAmbrosianaManifest',
    'codices': 'getCodicesManifest'
};

const sharedLoadersFile = fs.readFileSync('src/shared/SharedManifestLoaders.ts', 'utf8');

console.log('=== CHECKING FOR MISSING LIBRARY IMPLEMENTATIONS ===\n');

for (const [key, testCase] of Object.entries(testCases)) {
    if (!testCase.primaryUrl) continue;
    
    const url = testCase.primaryUrl;
    let libraryName = null;
    let methodName = null;
    
    if (url.includes('selene.bordeaux.fr')) {
        libraryName = 'Bordeaux';
        methodName = 'getBordeauxManifest';
    } else if (url.includes('digi.landesbibliothek.at')) {
        libraryName = 'Linz';
        methodName = 'getLinzManifest';
    } else if (url.includes('thedigitalwalters.org')) {
        libraryName = 'Digital Walters';
        methodName = 'getWaltersManifest';
    } else if (url.includes('ambrosiana.comperio.it')) {
        libraryName = 'Ambrosiana';
        methodName = 'getAmbrosianaManifest';
    } else if (url.includes('codices.at')) {
        libraryName = 'Codices';
        methodName = 'getCodicesManifest';
    }
    
    if (methodName) {
        const hasMethod = sharedLoadersFile.includes(`async ${methodName}(`);
        console.log(`Issue #${testCase.number} (${testCase.title}):`);
        console.log(`  Library: ${libraryName}`);
        console.log(`  Expected method: ${methodName}`);
        console.log(`  Implementation exists: ${hasMethod ? '✅ YES' : '❌ NO'}`);
        console.log('');
    }
}
