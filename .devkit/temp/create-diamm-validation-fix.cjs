const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Creating DIAMM validation PDF with fix...');

// Test URL from the original issue
const testUrl = 'https://musmed.eu/visualiseur-iiif?manifest=https%3A%2F%2Fiiif.diamm.net%2Fmanifests%2FI-Rc-Ms-1907%2Fmanifest.json';

// Create validation directory
const validationDir = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/CURRENT-VALIDATION';
if (!fs.existsSync(validationDir)) {
    fs.mkdirSync(validationDir, { recursive: true });
}

// Start the Electron app for testing
console.log('Starting Electron app for manual testing...');
console.log('');
console.log('📋 MANUAL TESTING INSTRUCTIONS:');
console.log('1. The app will start automatically');
console.log('2. Enter this URL in the app:');
console.log('   ', testUrl);
console.log('3. Click "Load Manuscript"');
console.log('4. Set "Pages to download" to 5');
console.log('5. Click "Download"');
console.log('6. Check the PDF file size - should be much larger than 209KB');
console.log('7. Open the PDF and verify it contains high-resolution manuscript pages');
console.log('8. Press Ctrl+C to stop the app when done');
console.log('');
console.log('🎯 EXPECTED RESULTS:');
console.log('- PDF should be several MB (not 209KB)');
console.log('- Images should be high-resolution (3640x5000 pixels)');
console.log('- Should show different manuscript pages');
console.log('');

const electronProcess = spawn('npm', ['run', 'dev'], {
    cwd: '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader',
    stdio: 'inherit'
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n\n🔧 Stopping Electron app...');
    electronProcess.kill();
    process.exit(0);
});

electronProcess.on('close', (code) => {
    console.log(`\n🔧 Electron app exited with code ${code}`);
    
    // Check if validation PDF was created
    const files = fs.readdirSync(validationDir);
    const pdfFiles = files.filter(f => f.endsWith('.pdf') && f.includes('DIAMM'));
    
    if (pdfFiles.length > 0) {
        console.log('✅ Found validation PDF(s):');
        pdfFiles.forEach(file => {
            const filePath = path.join(validationDir, file);
            const stats = fs.statSync(filePath);
            const sizeKB = Math.round(stats.size / 1024);
            console.log(`   - ${file}: ${sizeKB}KB`);
            
            if (sizeKB > 1000) {
                console.log('     ✅ File size looks good for high-resolution images');
            } else {
                console.log('     ⚠️  File size might still be too small');
            }
        });
    } else {
        console.log('❌ No DIAMM validation PDF found');
    }
    
    process.exit(code);
});