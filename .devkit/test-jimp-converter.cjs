const { NegativeConverterService } = require('../dist/main/services/NegativeConverterService.js');
const fs = require('fs').promises;
const path = require('path');

async function testJimpConverter() {
  console.log('🧪 Testing jimp-based negative converter...');
  
  try {
    // Create a simple test PDF (you'll need to provide one)
    const testPdfPath = path.join(__dirname, 'test.pdf');
    
    // Check if test PDF exists
    try {
      await fs.access(testPdfPath);
    } catch {
      console.log('⚠️ No test.pdf found, skipping test');
      console.log('To test, place a PDF file at .devkit/test.pdf');
      return;
    }
    
    const converter = new NegativeConverterService();
    const fileData = await fs.readFile(testPdfPath);
    
    console.log('📄 Loading test PDF...');
    
    const result = await converter.convertPdf(
      new Uint8Array(fileData),
      'test.pdf',
      { quality: 90, dpi: 300 },
      (progress) => {
        console.log(`${progress.stage}: ${progress.message} (${progress.progress || 0}%)`);
      }
    );
    
    if (result.success) {
      console.log(`✅ Conversion successful!`);
      console.log(`📁 Output: ${result.outputPath}`);
      console.log(`📊 Pages: ${result.pageCount}`);
    } else {
      console.log(`❌ Conversion failed: ${result.error}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('Could not execute')) {
      console.log('');
      console.log('🔧 PDF2PIC requires ImageMagick or GraphicsMagick to be installed:');
      console.log('   macOS: brew install imagemagick');
      console.log('   Windows: Download and install ImageMagick');
      console.log('   Linux: apt-get install imagemagick');
    }
  }
}

testJimpConverter();