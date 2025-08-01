#!/usr/bin/env node

const { ProductionCodeTester, USER_REPORTED_URLS } = require('./production-code-test-framework.js');

// Test only the issues we've fixed
const FIXED_ISSUES = ['issue_6', 'issue_8', 'issue_10'];

async function testFixedIssues() {
    const tester = new ProductionCodeTester();
    
    console.log('Testing fixed issues...\n');
    
    for (const issueId of FIXED_ISSUES) {
        const config = USER_REPORTED_URLS[issueId];
        if (config) {
            const result = await tester.testLibrary(issueId, config);
            console.log(`Result: ${result.success ? '✅' : '❌'}\n`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

testFixedIssues().catch(console.error);