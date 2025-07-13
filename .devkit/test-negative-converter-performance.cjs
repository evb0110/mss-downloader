const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

async function testNegativeConverter() {
  console.log('🧪 Testing negative converter performance...');
  
  // Test with the existing PDF file
  const testPdfPath = path.join(__dirname, '..', 'artefacts', 'Страницы из GB-Lbl-Add-29988_pages_1-79.pdf');
  
  try {
    await fs.access(testPdfPath);
    console.log('✅ Found test PDF file');
  } catch (error) {
    console.log('❌ Test PDF file not found at:', testPdfPath);
    console.log('Please provide a test PDF file to test the performance');
    return;
  }

  // Get file size
  const stats = await fs.stat(testPdfPath);
  const originalSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`📄 Original PDF size: ${originalSizeMB} MB`);

  // Start timing
  const startTime = Date.now();
  
  try {
    // Run the electron app in headless mode to test conversion
    console.log('🚀 Starting conversion test...');
    
    const { stdout, stderr } = await execAsync('npm run dev:headless', {
      timeout: 120000, // 2 minutes timeout
      cwd: path.join(__dirname, '..')
    });
    
    const endTime = Date.now();
    const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`⏱️ Conversion completed in ${durationSeconds} seconds`);
    
    // Check if output file exists
    const outputPath = path.join(require('os').homedir(), 'Downloads', 'Страницы из GB-Lbl-Add-29988_pages_1-79_positive.pdf');
    
    try {
      const outputStats = await fs.stat(outputPath);
      const outputSizeMB = (outputStats.size / (1024 * 1024)).toFixed(2);
      const sizeRatio = (outputStats.size / stats.size).toFixed(2);
      
      console.log(`📄 Output PDF size: ${outputSizeMB} MB`);
      console.log(`📊 Size ratio: ${sizeRatio}x (${sizeRatio > 1 ? 'increased' : 'decreased'})`);
      
      if (sizeRatio > 3) {
        console.log('⚠️  WARNING: Output size is more than 3x larger than input');
      } else if (sizeRatio < 2) {
        console.log('✅ Good: Output size is reasonable');
      }
      
    } catch (error) {
      console.log('❌ Output file not found - conversion may have failed');
    }
    
  } catch (error) {
    console.error('❌ Conversion test failed:', error.message);
  }
}

// Run the test
testNegativeConverter().catch(console.error);