const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

async function validateNegativeConverter() {
  console.log('🧪 Starting negative converter validation...');
  
  // Test with the existing PDF file
  const testPdfPath = path.join(__dirname, 'artefacts', 'Страницы из GB-Lbl-Add-29988_pages_1-79.pdf');
  
  try {
    await fs.access(testPdfPath);
    console.log('✅ Found test PDF file');
  } catch (error) {
    console.log('❌ Test PDF file not found at:', testPdfPath);
    console.log('Please provide a test PDF file to test the validation');
    return;
  }

  // Get original file size
  const stats = await fs.stat(testPdfPath);
  const originalSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`📄 Original PDF size: ${originalSizeMB} MB`);

  // Start timing
  const startTime = Date.now();
  
  console.log('🚀 Starting performance validation...');
  console.log('⏱️ Timing extraction and conversion speed...');
  
  try {
    // Run the electron app in headless mode
    const child = spawn('npm', ['run', 'dev:headless'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe'
    });
    
    let output = '';
    let errorOutput = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
      // Look for conversion progress indicators
      if (data.toString().includes('conversion') || data.toString().includes('progress')) {
        console.log('📊 Conversion progress detected');
      }
    });
    
    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    // Wait for the process to complete or timeout
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Timeout: Process took longer than 60 seconds'));
      }, 60000); // 60 second timeout
      
      child.on('close', (code) => {
        clearTimeout(timeout);
        resolve({ code, output, errorOutput });
      });
      
      child.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
    
    const endTime = Date.now();
    const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`⏱️ Process completed in ${durationSeconds} seconds`);
    
    if (parseFloat(durationSeconds) > 30) {
      console.log('⚠️  WARNING: Process took longer than 30 seconds');
    } else if (parseFloat(durationSeconds) < 15) {
      console.log('✅ EXCELLENT: Process completed quickly');
    } else {
      console.log('✅ GOOD: Process completed in reasonable time');
    }
    
    // Check if output file exists
    const outputPath = path.join(os.homedir(), 'Downloads', 'Страницы из GB-Lbl-Add-29988_pages_1-79_positive.pdf');
    
    try {
      const outputStats = await fs.stat(outputPath);
      const outputSizeMB = (outputStats.size / (1024 * 1024)).toFixed(2);
      const sizeRatio = (outputStats.size / stats.size).toFixed(2);
      
      console.log(`📄 Output PDF size: ${outputSizeMB} MB`);
      console.log(`📊 Size ratio: ${sizeRatio}x`);
      
      if (sizeRatio > 4) {
        console.log('❌ FAILED: Output size is more than 4x larger than input');
      } else if (sizeRatio > 2) {
        console.log('⚠️  WARNING: Output size is more than 2x larger than input');
      } else {
        console.log('✅ PASSED: Output size is reasonable');
      }
      
      // Test PDF validity with pdfimages
      console.log('🔍 Testing PDF validity...');
      
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      try {
        await execAsync(`pdfimages -list "${outputPath}"`);
        console.log('✅ PDF structure is valid');
      } catch (error) {
        console.log('❌ PDF structure validation failed:', error.message);
      }
      
      console.log('📁 Validation complete! Check the output file at:', outputPath);
      
    } catch (error) {
      console.log('❌ Output file not found - conversion failed');
    }
    
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
  }
}

// Run the validation
validateNegativeConverter().catch(console.error);