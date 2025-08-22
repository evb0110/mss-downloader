#!/usr/bin/env node
const fs = require('fs');

const issues = JSON.parse(fs.readFileSync('.devkit/all-open-issues.json', 'utf8'));

console.log('=== EXTRACTING USER-REPORTED URLs FROM ALL ISSUES ===\n');

const testCases = {};

for (const issue of issues) {
    const urls = issue.body.match(/https?:\/\/[^\s\)]+/g) || [];
    // Filter out GitHub URLs and clean up
    const manuscriptUrls = urls.filter(url => !url.includes('github.com')).map(url => url.replace(/[)\]]+$/, ''));
    
    console.log(`Issue #${issue.number} (${issue.title}):`);
    console.log(`  Author: ${issue.author.login}`);
    console.log(`  URLs found: ${manuscriptUrls.length}`);
    if (manuscriptUrls.length > 0) {
        console.log(`  Primary URL: ${manuscriptUrls[0]}`);
    }
    
    testCases[`issue_${issue.number}`] = {
        number: issue.number,
        title: issue.title,
        author: issue.author.login,
        urls: manuscriptUrls,
        primaryUrl: manuscriptUrls[0] || null,
        body: issue.body.substring(0, 500)
    };
    console.log('');
}

// Save test cases
fs.writeFileSync('.devkit/issue-test-cases.json', JSON.stringify(testCases, null, 2));
console.log(`\nSaved ${Object.keys(testCases).length} test cases to .devkit/issue-test-cases.json`);
