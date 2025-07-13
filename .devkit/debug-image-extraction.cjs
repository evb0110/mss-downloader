const { NegativeConverterService } = require('../dist/main/services/NegativeConverterService.js');
const fs = require('fs').promises;
const path = require('path');

async function debugImageExtraction() {
  console.log('🔍 Debugging image extraction...');
  
  try {
    // Check if test PDF exists
    const testPdfPath = path.join(__dirname, 'test.pdf');
    
    try {
      await fs.access(testPdfPath);
    } catch {
      console.log('⚠️ No test.pdf found, skipping debug');
      console.log('To debug, place a PDF file at .devkit/test.pdf');
      return;
    }
    
    const converter = new NegativeConverterService();
    const fileData = await fs.readFile(testPdfPath);
    
    console.log('📄 Testing with PDF size:', fileData.length, 'bytes');
    
    // Call the conversion with detailed logging
    const result = await converter.convertPdf(
      new Uint8Array(fileData),
      'test.pdf',
      { quality: 90, dpi: 300 },
      (progress) => {
        console.log(`[${progress.progress || 0}%] ${progress.stage}: ${progress.message}`);
      }
    );
    
    if (result.success) {
      console.log(`✅ Result: ${result.outputPath}`);
      console.log(`📊 Pages: ${result.pageCount}`);
      
      // Check if the output file is actually different from input
      const outputData = await fs.readFile(result.outputPath);
      console.log(`📤 Output size: ${outputData.length} bytes`);
      console.log(`📐 Size difference: ${outputData.length - fileData.length} bytes`);
      
      if (Math.abs(outputData.length - fileData.length) < 100) {
        console.log('❌ SAME SIZE - Likely passthrough mode!');
      } else {
        console.log('✅ DIFFERENT SIZE - Processing likely worked!');
      }
    } else {
      console.log(`❌ Failed: ${result.error}`);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugImageExtraction();