const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { performance } = require('perf_hooks');

// Import the service directly for testing
const { createRequire } = require('module');
const require_main = createRequire(path.join(__dirname, '../dist/main/main.js'));

async function testNegativeConverter() {
  console.log('🧪 Testing negative converter performance...');
  
  // Test with the existing PDF file
  const testPdfPath = path.join(__dirname, 'artefacts', 'Страницы из GB-Lbl-Add-29988_pages_1-79.pdf');
  
  try {
    const stats = await fs.stat(testPdfPath);
    const originalSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📄 Original PDF size: ${originalSizeMB} MB`);
    
    // Read the PDF file
    const pdfData = await fs.readFile(testPdfPath);
    const uint8Data = new Uint8Array(pdfData);
    
    console.log('🚀 Starting conversion...');
    const startTime = performance.now();
    
    // Import and test the service
    try {
      const { NegativeConverterService } = require_main('../dist/main/services/NegativeConverterService.js');
      const service = new NegativeConverterService();
      
      const result = await service.convertPdf(
        uint8Data,
        'Страницы из GB-Lbl-Add-29988_pages_1-79.pdf',
        { quality: 90, dpi: 0 },
        (progress) => {
          console.log(`📊 ${progress.stage}: ${progress.message} (${progress.progress || 0}%)`);
        }
      );
      
      const endTime = performance.now();
      const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
      
      console.log(`⏱️ Conversion completed in ${durationSeconds} seconds`);
      
      if (result.success) {
        console.log('✅ Conversion successful!');
        console.log(`📄 Pages converted: ${result.pageCount}`);
        console.log(`📁 Output path: ${result.outputPath}`);
        
        // Check output file size
        try {
          const outputStats = await fs.stat(result.outputPath);
          const outputSizeMB = (outputStats.size / (1024 * 1024)).toFixed(2);
          const sizeRatio = (outputStats.size / stats.size).toFixed(2);
          
          console.log(`📄 Output PDF size: ${outputSizeMB} MB`);
          console.log(`📊 Size ratio: ${sizeRatio}x`);
          
          // Performance assessment
          if (parseFloat(durationSeconds) < 15) {
            console.log('⚡ EXCELLENT: Very fast conversion');
          } else if (parseFloat(durationSeconds) < 30) {
            console.log('✅ GOOD: Fast conversion');
          } else {
            console.log('⚠️ SLOW: Conversion took longer than expected');
          }
          
          // Size assessment
          if (parseFloat(sizeRatio) < 2) {
            console.log('✅ EXCELLENT: Good size efficiency');
          } else if (parseFloat(sizeRatio) < 4) {
            console.log('✅ GOOD: Reasonable size increase');
          } else {
            console.log('⚠️ LARGE: Significant size increase');
          }
          
        } catch (error) {
          console.log('❌ Could not access output file:', error.message);
        }
        
      } else {
        console.log('❌ Conversion failed:', result.error);
      }
      
    } catch (error) {
      console.log('❌ Could not load service:', error.message);
      console.log('Building the app first...');
      
      // Try to build and test
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      try {
        await execAsync('npm run build', { cwd: path.join(__dirname, '..') });
        console.log('✅ Build successful, please run the test again');
      } catch (buildError) {
        console.log('❌ Build failed:', buildError.message);
      }
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

// Run the test
testNegativeConverter().catch(console.error);