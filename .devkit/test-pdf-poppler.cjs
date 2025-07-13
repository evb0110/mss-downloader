const { convert } = require('pdf-poppler');
const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');

async function testPdfPoppler() {
  console.log('🧪 Testing pdf-poppler...');
  
  try {
    // Create a simple test PDF
    const doc = new jsPDF();
    doc.text('Test PDF for Poppler', 10, 10);
    doc.text('This is a test page', 10, 20);
    const pdfBytes = doc.output('arraybuffer');
    
    // Save to temp file
    const tempPdfPath = path.join(__dirname, 'temp-test.pdf');
    fs.writeFileSync(tempPdfPath, Buffer.from(pdfBytes));
    
    console.log('📄 Created test PDF');
    
    // Test pdf-poppler conversion
    const options = {
      format: 'jpeg',
      out_dir: __dirname,
      out_prefix: 'test-page',
      page: null
    };
    
    await convert(tempPdfPath, options);
    
    console.log('✅ pdf-poppler conversion successful!');
    
    // Check for output files
    const files = fs.readdirSync(__dirname);
    const imageFiles = files.filter(f => f.startsWith('test-page') && f.endsWith('.jpg'));
    console.log(`📁 Generated ${imageFiles.length} image files:`, imageFiles);
    
    // Cleanup
    fs.unlinkSync(tempPdfPath);
    imageFiles.forEach(f => fs.unlinkSync(path.join(__dirname, f)));
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testPdfPoppler();