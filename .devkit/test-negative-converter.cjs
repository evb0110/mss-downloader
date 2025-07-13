const { NegativeConverterService } = require('../dist/main/services/NegativeConverterService.js');
const fs = require('fs');
const path = require('path');

async function testNegativeConverter() {
  console.log('🧪 Testing Negative Converter Service...');
  
  try {
    const service = new NegativeConverterService();
    
    // Create a simple test PDF with pdf-lib
    const { PDFDocument, rgb } = require('pdf-lib');
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 800]);
    page.drawText('Test PDF for Negative Conversion', {
      x: 50,
      y: 750,
      size: 16,
      color: rgb(0, 0, 0),
    });
    page.drawText('This is a test page', {
      x: 50,
      y: 720,
      size: 12,
      color: rgb(0, 0, 0),
    });
    const pdfBytes = await doc.save();
    
    console.log('📄 Created test PDF');
    
    // Test the conversion
    const result = await service.convertPdf(
      new Uint8Array(pdfBytes),
      'test-negative.pdf',
      { quality: 90, dpi: 300 },
      (progress) => {
        console.log(`📊 ${progress.stage}: ${progress.message}${progress.progress ? ` (${progress.progress}%)` : ''}`);
      }
    );
    
    if (result.success) {
      console.log('✅ Conversion successful!');
      console.log(`📁 Output: ${result.outputPath}`);
      console.log(`📄 Pages: ${result.pageCount}`);
    } else {
      console.log('❌ Conversion failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testNegativeConverter();