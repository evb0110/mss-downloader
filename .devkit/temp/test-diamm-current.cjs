const { spawn } = require('child_process');
const path = require('path');

// Test the current implementation
const url = 'https://musmed.eu/visualiseur-iiif?manifest=https%3A%2F%2Fiiif.diamm.net%2Fmanifests%2FI-Rc-Ms-1907%2Fmanifest.json';

console.log('Testing current DIAMM implementation...');
console.log('URL:', url);

// Start the Electron app in development mode
const electronProcess = spawn('npm', ['run', 'dev'], {
    cwd: '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader',
    stdio: 'inherit'
});

console.log('Electron app started. Please:');
console.log('1. Enter the URL in the app');
console.log('2. Click "Load Manuscript"');
console.log('3. Set "Pages to download" to 3');
console.log('4. Click "Download"');
console.log('5. Check the file size of the downloaded PDF');
console.log('6. Press Ctrl+C to stop the app when done');

// Handle process termination
process.on('SIGINT', () => {
    console.log('\nStopping Electron app...');
    electronProcess.kill();
    process.exit(0);
});

electronProcess.on('close', (code) => {
    console.log(`Electron app exited with code ${code}`);
    process.exit(code);
});