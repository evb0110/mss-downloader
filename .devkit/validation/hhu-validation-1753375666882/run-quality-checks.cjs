const { execSync } = require('child_process');
const path = require('path');

const projectDir = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader';

console.log('Running quality checks...\n');

try {
  // Change to project directory
  process.chdir(projectDir);
  
  // Run lint
  console.log('Running lint...');
  try {
    execSync('npm run lint', { stdio: 'inherit' });
    console.log('✅ Lint passed\n');
  } catch (error) {
    console.error('❌ Lint failed\n');
    process.exit(1);
  }
  
  // Run build
  console.log('Running build...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Build passed\n');
  } catch (error) {
    console.error('❌ Build failed\n');
    process.exit(1);
  }
  
  console.log('✅ All quality checks passed!');
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}