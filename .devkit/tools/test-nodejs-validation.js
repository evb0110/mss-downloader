/**
 * Test script to verify the Node.js validation template works correctly
 * This ensures the handle-issues workflow will use proper Node.js testing
 */

const { validateIssueFix } = require('./nodejs-validation-template.js');

async function testValidationTemplate() {
    console.log('🧪 Testing Node.js validation template...\n');
    
    // Test with a known working library (Morgan Library)
    const testIssue = {
        number: 9999, // Test issue number
        testUrl: 'https://www.themorgan.org/collection/lindau-gospels/thumbs',
        library: 'morgan',
        expectedBehavior: 'Multiple pages should load correctly'
    };
    
    console.log('Testing with Morgan Library manuscript...');
    console.log('This will verify that Node.js validation works the same as Electron.');
    console.log('');
    
    try {
        const success = await validateIssueFix(
            testIssue.number,
            testIssue.testUrl,
            testIssue.library,
            testIssue.expectedBehavior
        );
        
        if (success) {
            console.log('\n✅ Node.js validation template test PASSED!');
            console.log('✅ The handle-issues workflow will work correctly with Node.js testing.');
            console.log('✅ SharedManifestLoaders works properly in Node.js environment.');
            process.exit(0);
        } else {
            console.log('\n❌ Node.js validation template test FAILED!');
            console.log('❌ The handle-issues workflow needs debugging.');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('\n💥 Test crashed with error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run the test
testValidationTemplate().catch(console.error);