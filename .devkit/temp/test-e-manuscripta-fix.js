const { spawn } = require('child_process');

console.log('Testing e-manuscripta.ch fix...');
console.log('URL: https://www.e-manuscripta.ch/zuzcmi/content/zoom/3229497');
console.log('Expected: 463 pages (not 11)');
console.log('');

const testProcess = spawn('npm', ['run', 'test:e2e:start'], {
    stdio: 'inherit',
    env: {
        ...process.env,
        TEST_URL: 'https://www.e-manuscripta.ch/zuzcmi/content/zoom/3229497',
        TEST_EXPECTED_PAGES: '463'
    }
});

testProcess.on('close', (code) => {
    console.log(`Test process exited with code ${code}`);
    
    // Kill any remaining processes
    spawn('npm', ['run', 'test:e2e:kill'], { stdio: 'inherit' });
});

// Timeout after 5 minutes
setTimeout(() => {
    console.log('Test timeout - killing processes');
    testProcess.kill();
    spawn('npm', ['run', 'test:e2e:kill'], { stdio: 'inherit' });
}, 300000);