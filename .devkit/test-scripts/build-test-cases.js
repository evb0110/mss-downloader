#!/usr/bin/env node

const fs = require('fs');

// Load ALL issues from our comprehensive fetch
const allIssues = JSON.parse(fs.readFileSync('.devkit/all-open-issues.json'));

console.log(`Building test cases for ALL ${allIssues.length} issues...`);

// Build test configuration with EXACT user URLs from ALL GitHub issues
const USER_REPORTED_URLS = {};

for (const issue of allIssues) {
    // Extract URL from issue body (more comprehensive regex)
    const urlMatch = issue.body.match(/https?:\/\/[^\s\)]+/);
    
    // Extract error message
    const errorMatch = issue.body.match(/Error[^:]*:\s*(.+?)(?:\n|https|$)/);
    
    // Also look for common error patterns in Russian
    const russianErrorMatch = issue.body.match(/(ошибк[а-я]*|[Nn]ot available|[Ff]ailed|[Tt]imeout)[^.\n]*/i);
    
    USER_REPORTED_URLS[`issue_${issue.number}`] = {
        issue: `#${issue.number}`,
        title: issue.title,
        userUrl: urlMatch ? urlMatch[0].trim() : 'NO_URL_PROVIDED',
        userError: errorMatch ? errorMatch[1].trim() : (russianErrorMatch ? russianErrorMatch[0].trim() : issue.body.substring(0, 100)),
        author: issue.author.login,
        fullBody: issue.body,
        expectedBehavior: `Should handle ${issue.title} library correctly`
    };
}

console.log(`Created test cases for ${Object.keys(USER_REPORTED_URLS).length} issues\n`);

// Display each test case
for (const [id, config] of Object.entries(USER_REPORTED_URLS)) {
    console.log(`${config.issue} (${config.title}):`);
    console.log(`  URL: ${config.userUrl}`);
    console.log(`  Error: ${config.userError}`);
    console.log(`  Author: ${config.author}`);
    console.log('');
}

// Save test cases for use by other scripts
fs.writeFileSync('.devkit/test-cases.json', JSON.stringify(USER_REPORTED_URLS, null, 2));
console.log('Test cases saved to .devkit/test-cases.json');