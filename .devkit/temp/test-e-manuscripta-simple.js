const { execSync } = require('child_process');

console.log('Testing e-manuscripta.ch fix...');
console.log('URL: https://www.e-manuscripta.ch/zuzcmi/content/zoom/3229497');
console.log('Expected: 463 pages (not 11)');
console.log('');

try {
    // Start the test
    console.log('Starting e2e test...');
    const result = execSync('npm run test:e2e:start -- --grep "e-manuscripta"', { 
        encoding: 'utf8',
        timeout: 300000 // 5 minutes
    });
    console.log(result);
} catch (error) {
    console.error('Test failed:', error.message);
} finally {
    // Always cleanup
    try {
        execSync('npm run test:e2e:kill', { encoding: 'utf8' });
        console.log('Cleanup completed');
    } catch (cleanupError) {
        console.warn('Cleanup warning:', cleanupError.message);
    }
}