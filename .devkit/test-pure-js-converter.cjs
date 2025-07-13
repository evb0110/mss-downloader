const { NegativeConverterService } = require('../dist/main/services/NegativeConverterService.js');
const fs = require('fs').promises;
const path = require('path');

async function testPureJSConverter() {
  console.log('🧪 Testing pure JavaScript PDF renderer + jimp converter...');
  
  try {
    // Check if test PDF exists
    const testPdfPath = path.join(__dirname, 'test.pdf');
    
    try {
      await fs.access(testPdfPath);
    } catch {
      console.log('⚠️ No test.pdf found, creating a simple test PDF...');
      
      // Create a simple test PDF using pdf-lib
      const { PDFDocument, rgb } = require('pdf-lib');
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([400, 600]);
      
      // Add some text and shapes (negative content)
      page.drawRectangle({
        x: 50,
        y: 50,
        width: 300,
        height: 500,
        color: rgb(0, 0, 0), // Black background
      });
      
      page.drawText('NEGATIVE TEST CONTENT', {
        x: 60,
        y: 520,
        color: rgb(1, 1, 1), // White text
        size: 20,
      });
      
      page.drawText('This should be inverted to positive', {
        x: 60,
        y: 480,
        color: rgb(1, 1, 1), // White text
        size: 12,
      });
      
      const pdfBytes = await pdfDoc.save();
      await fs.writeFile(testPdfPath, pdfBytes);
      console.log('✅ Created test PDF with negative content');
    }
    
    const converter = new NegativeConverterService();
    const fileData = await fs.readFile(testPdfPath);
    
    console.log(`📄 Testing with PDF: ${fileData.length} bytes`);
    console.log('🔄 Starting conversion...\n');
    
    const startTime = Date.now();
    
    // Call the conversion with detailed logging
    const result = await converter.convertPdf(
      new Uint8Array(fileData),
      'test.pdf',
      { quality: 90, dpi: 300 },
      (progress) => {
        console.log(`[${progress.progress || 0}%] ${progress.stage}: ${progress.message}`);
      }
    );
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`\n⏱️ Conversion took ${duration}s`);
    
    if (result.success) {
      console.log(`✅ SUCCESS!`);
      console.log(`📁 Output: ${result.outputPath}`);
      console.log(`📊 Pages: ${result.pageCount}`);
      
      // Check if the output file is different from input
      const outputData = await fs.readFile(result.outputPath);
      console.log(`📤 Output size: ${outputData.length} bytes`);
      console.log(`📐 Size difference: ${outputData.length - fileData.length} bytes`);
      
      // Size difference indicates processing occurred
      if (Math.abs(outputData.length - fileData.length) < 100) {
        console.log('⚠️ SAME SIZE - Likely passthrough mode!');
      } else {
        console.log('✅ DIFFERENT SIZE - Processing worked!');
      }
      
      // Open the result in Finder for visual inspection
      const { exec } = require('child_process');
      const outputDir = path.dirname(result.outputPath);
      exec(`open "${outputDir}"`, (error) => {
        if (error) {
          console.log('💡 Manual check: Open Downloads folder to see result');
        } else {
          console.log('📂 Opened Downloads folder - check the result file');
        }
      });
      
    } else {
      console.log(`❌ FAILED: ${result.error}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

testPureJSConverter();