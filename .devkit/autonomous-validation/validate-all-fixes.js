const { validateIssueFix } = require('./validation-template.js');
const { execSync } = require('child_process');

/**
 * Autonomous validation for all current fixes
 * This runs WITHOUT user interaction
 */

async function validateAllFixes() {
    console.log('=== AUTONOMOUS VALIDATION SYSTEM ===');
    console.log('Running programmatic validation for all fixes...\n');
    
    const validations = [
        {
            issueNumber: 1,
            testUrl: 'https://hs.manuscriptorium.com/cs/detail/?callno=HHU_H_1B&pg=41',
            libraryId: 'hhu',
            expectedBehavior: 'Downloads without logger errors',
            errorToCheck: 'this.logger.logInfo is not a function'
        },
        {
            issueNumber: 2,
            testUrl: 'https://unipub.uni-graz.at/obvugrscript/content/titleinfo/8224538',
            libraryId: 'graz',
            expectedBehavior: 'Completes loading without infinite hanging',
            errorToCheck: 'infinite manifest loading'
        },
        {
            issueNumber: 3,
            testUrl: 'https://nuovabibliotecamanoscritta.it/Generale/manoscritti/MANOSCRITTO.html?idManoscritto=76251',
            libraryId: 'verona',
            expectedBehavior: 'Downloads without timeout errors',
            errorToCheck: 'ETIMEDOUT'
        },
        {
            issueNumber: 4,
            testUrl: 'https://www.themorgan.org/collection/lindau-gospels/thumbs',
            libraryId: 'morgan',
            expectedBehavior: 'Finds multiple pages (not just 1)',
            errorToCheck: 'only finding 1 page'
        }
    ];
    
    const results = [];
    
    // Run all validations
    for (const validation of validations) {
        console.log(`\n${'='.repeat(60)}`);
        const success = await validateIssueFix(validation);
        results.push({ ...validation, success });
        
        // Small delay between validations
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Summary
    console.log('\n\n=== VALIDATION SUMMARY ===');
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`Total: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    
    results.forEach(r => {
        console.log(`\nIssue #${r.issueNumber} (${r.libraryId}): ${r.success ? '✅ PASSED' : '❌ FAILED'}`);
    });
    
    // Pre-release checks
    if (failed === 0) {
        console.log('\n\n=== PRE-RELEASE CHECKS ===');
        
        console.log('\n1. Running lint...');
        try {
            execSync('npm run lint', { stdio: 'pipe' });
            console.log('   ✅ Lint passed');
        } catch (error) {
            console.error('   ❌ Lint failed!');
            return false;
        }
        
        console.log('\n2. Running build...');
        try {
            execSync('npm run build', { stdio: 'pipe' });
            console.log('   ✅ Build passed');
        } catch (error) {
            console.error('   ❌ Build failed!');
            return false;
        }
        
        console.log('\n\n✅ ALL VALIDATIONS PASSED!');
        console.log('Ready for autonomous version bump and release.');
        return true;
    } else {
        console.log('\n\n❌ VALIDATION FAILED!');
        console.log('Fix the failing issues before proceeding.');
        return false;
    }
}

// Run if called directly
if (require.main === module) {
    validateAllFixes().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { validateAllFixes };