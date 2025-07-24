const { execSync } = require('child_process');

try {
    const path = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/validation/hhu-final';
    execSync(`open "${path}"`);
    console.log('Opened HHU validation directory in Finder');
} catch (error) {
    console.error('Error opening directory:', error.message);
}