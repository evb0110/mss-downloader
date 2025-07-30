/**
 * Run validations for all issues in the handle-issues workflow
 * This script reads issues from .devkit/current-issues.json and validates fixes
 * CRITICAL: Uses Node.js only - never spawns Electron
 */

const { validateMultipleIssues } = require('./nodejs-validation-template.js');
const fs = require('fs').promises;
const path = require('path');

/**
 * Parse issue text to extract test URLs and library information
 */
function parseIssueForTestData(issue) {
    const title = issue.title.toLowerCase();
    const body = issue.body || '';
    
    // Extract URLs from issue body
    const urlMatches = body.match(/https?:\/\/[^\s\)]+/g) || [];
    const testUrl = urlMatches[0]; // Use first URL found
    
    // Determine library from URL or title
    let library = 'unknown';
    if (testUrl) {
        if (testUrl.includes('gallica.bnf.fr')) library = 'gallica';
        else if (testUrl.includes('themorgan.org')) library = 'morgan';
        else if (testUrl.includes('manuscripts.bordan.fr')) library = 'bordeaux';
        else if (testUrl.includes('florence')) library = 'florence';
        else if (testUrl.includes('graz')) library = 'graz';
        else if (testUrl.includes('verona') || testUrl.includes('nuovabibliotecamanoscritta')) library = 'verona';
        else if (testUrl.includes('hhu.de')) library = 'hhu';
        else if (testUrl.includes('loc.gov')) library = 'loc';
        else if (testUrl.includes('vatican')) library = 'vatican';
        // Add more library detection as needed
    }
    
    // Determine expected behavior from issue content
    let expectedBehavior = 'Issue should be resolved';
    if (title.includes('timeout') || body.includes('timeout')) {
        expectedBehavior = 'No timeouts should occur';
    } else if (title.includes('hang') || body.includes('hang')) {
        expectedBehavior = 'Download should not hang';
    } else if (title.includes('error') || body.includes('error')) {
        expectedBehavior = 'No errors should occur';
    } else if (title.includes('page') || body.includes('page')) {
        expectedBehavior = 'All pages should download correctly';
    }
    
    return {
        number: issue.number,
        testUrl,
        library,
        expectedBehavior,
        title: issue.title
    };
}

async function main() {
    console.log('🔄 Handle-Issues Validation Runner');
    console.log('='*50);
    
    try {
        // Read current issues
        const issuesPath = path.join(__dirname, '../current-issues.json');
        const issuesData = await fs.readFile(issuesPath, 'utf8');
        const issues = JSON.parse(issuesData);
        
        if (issues.length === 0) {
            console.log('✅ No issues to validate!');
            return;
        }
        
        console.log(`📋 Found ${issues.length} issues to validate`);
        
        // Parse issues to extract test data
        const testData = [];
        for (const issue of issues) {
            const parsed = parseIssueForTestData(issue);
            if (parsed.testUrl) {
                testData.push(parsed);
                console.log(`   📌 Issue #${parsed.number}: ${parsed.library} - ${parsed.title}`);
            } else {
                console.log(`   ⚠️  Issue #${issue.number}: No test URL found - ${issue.title}`);
            }
        }
        
        if (testData.length === 0) {
            console.log('❌ No testable issues found (no URLs detected)');
            return;
        }
        
        console.log(`\n🧪 Starting validation of ${testData.length} testable issues...\n`);
        
        // Run validations consecutively (never parallel)
        const allPassed = await validateMultipleIssues(testData);
        
        // Create summary report
        const summary = {
            totalIssues: issues.length,
            testableIssues: testData.length,
            validationDate: new Date().toISOString(),
            allPassed,
            issues: testData.map(t => ({
                number: t.number,
                library: t.library,
                title: t.title,
                testUrl: t.testUrl
            }))
        };
        
        const summaryPath = path.join(__dirname, '../validation/validation-summary.json');
        await fs.mkdir(path.dirname(summaryPath), { recursive: true });
        await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
        
        console.log(`\n📊 Summary report saved: ${summaryPath}`);
        
        if (allPassed) {
            console.log('\n🎉 ALL VALIDATIONS PASSED!');
            console.log('✅ Ready for autonomous version bump');
            process.exit(0);
        } else {
            console.log('\n❌ Some validations failed');
            console.log('⚠️  Fix issues before version bump');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('\n💥 Validation runner crashed:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { parseIssueForTestData, main };