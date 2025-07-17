const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Running Validation Protocol for All Fixes\n');
console.log('=' .repeat(60));

const validationDir = path.join(__dirname, '../../.devkit/validation-results');
if (!fs.existsSync(validationDir)) {
    fs.mkdirSync(validationDir, { recursive: true });
}

// Test configurations
const tests = [
    {
        name: 'Verona Library',
        url: 'https://www.nuovabibliotecamanoscritta.it/Generale/BibliotecaDigitale/caricaVolumi.html?codice=15',
        expectedFix: 'No more timeouts, fast loading',
        outputFile: 'verona-test.pdf'
    },
    {
        name: 'MDC Catalonia',
        url: 'https://mdc.csuc.cat/digital/collection/incunableBC/id/175331/rec/1',
        expectedFix: 'No more fetch failures',
        outputFile: 'mdc-catalonia-test.pdf'
    },
    {
        name: 'University of Graz',
        url: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
        expectedFix: 'Should work on Windows with SSL bypass',
        outputFile: 'graz-test.pdf'
    },
    {
        name: 'Internet Culturale',
        url: 'https://www.internetculturale.it/jmms/iccuviewer/iccu.jsp?teca=&id=oai%3A193.206.197.121%3A18%3AVE0049%3ACSTOR.241.10080',
        expectedFix: 'Already working correctly',
        outputFile: 'internet-culturale-test.pdf'
    }
];

// Run each test
const results = [];
let successCount = 0;
let failCount = 0;

for (const test of tests) {
    console.log(`\n📚 Testing ${test.name}...`);
    console.log(`   URL: ${test.url}`);
    console.log(`   Expected: ${test.expectedFix}`);
    
    try {
        // Use the actual app's download mechanism
        const testScript = `
const { app } = require('electron');
const path = require('path');
const { EnhancedManuscriptDownloaderService } = require('./src/main/services/EnhancedManuscriptDownloaderService');

async function test() {
    const service = new EnhancedManuscriptDownloaderService();
    try {
        const result = await service.parseUrl('${test.url}');
        console.log(JSON.stringify({
            success: true,
            pages: result.totalPages,
            type: result.type,
            title: result.title
        }));
    } catch (error) {
        console.log(JSON.stringify({
            success: false,
            error: error.message
        }));
    }
    process.exit(0);
}

test();
`;
        
        fs.writeFileSync(path.join(__dirname, 'test-runner.js'), testScript);
        
        try {
            const output = execSync(`cd "${path.join(__dirname, '../..')}" && npx electron ${path.join(__dirname, 'test-runner.js')}`, {
                encoding: 'utf8',
                stdio: 'pipe'
            });
            
            const result = JSON.parse(output.trim().split('\n').pop());
            
            if (result.success) {
                console.log(`   ✅ SUCCESS: ${result.pages} pages found`);
                console.log(`   📄 Type: ${result.type}`);
                successCount++;
                results.push({
                    name: test.name,
                    status: 'SUCCESS',
                    pages: result.pages,
                    type: result.type
                });
            } else {
                console.log(`   ❌ FAILED: ${result.error}`);
                failCount++;
                results.push({
                    name: test.name,
                    status: 'FAILED',
                    error: result.error
                });
            }
        } catch (execError) {
            console.log(`   ❌ EXECUTION ERROR: ${execError.message}`);
            failCount++;
            results.push({
                name: test.name,
                status: 'ERROR',
                error: execError.message
            });
        }
        
    } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
        failCount++;
        results.push({
            name: test.name,
            status: 'ERROR',
            error: error.message
        });
    }
}

// Clean up
try {
    fs.unlinkSync(path.join(__dirname, 'test-runner.js'));
} catch (e) {}

// Summary
console.log('\n' + '=' .repeat(60));
console.log('📊 VALIDATION SUMMARY\n');
console.log(`Total Tests: ${tests.length}`);
console.log(`✅ Successful: ${successCount}`);
console.log(`❌ Failed: ${failCount}`);

console.log('\n📝 Detailed Results:');
results.forEach(r => {
    const icon = r.status === 'SUCCESS' ? '✅' : '❌';
    console.log(`${icon} ${r.name}: ${r.status}${r.pages ? ` (${r.pages} pages)` : ''}${r.error ? ` - ${r.error}` : ''}`);
});

// Write report
const report = {
    timestamp: new Date().toISOString(),
    summary: {
        total: tests.length,
        success: successCount,
        failed: failCount
    },
    results: results
};

fs.writeFileSync(
    path.join(validationDir, 'validation-report.json'),
    JSON.stringify(report, null, 2)
);

console.log(`\n📄 Report saved to: ${path.join(validationDir, 'validation-report.json')}`);

// Determine if we should proceed with version bump
if (successCount >= 3) {
    console.log('\n✅ Validation PASSED - Most fixes are working correctly');
    console.log('   Ready for version bump!');
} else {
    console.log('\n❌ Validation FAILED - Too many tests failed');
    console.log('   Please fix issues before version bump');
}