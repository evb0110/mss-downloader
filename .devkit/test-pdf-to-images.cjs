const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function testPdfToImages() {
  console.log('🧪 Testing PDF to Images conversion...');
  
  try {
    // Create a test PDF
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 800]);
    
    page.drawText('Test PDF for Image Conversion', {
      x: 50,
      y: 750,
      size: 20,
      color: rgb(0, 0, 0),
    });
    
    page.drawText('This should be converted to PNG images', {
      x: 50,
      y: 700,
      size: 14,
      color: rgb(0, 0, 0),
    });
    
    page.drawText('Page 1 of test document', {
      x: 50,
      y: 650,
      size: 12,
      color: rgb(0.5, 0.5, 0.5),
    });
    
    // Add a second page
    const page2 = doc.addPage([600, 800]);
    page2.drawText('Second Page', {
      x: 50,
      y: 750,
      size: 20,
      color: rgb(0, 0, 0),
    });
    
    const pdfBytes = await doc.save();
    
    // Save test PDF
    const testPdfPath = path.join(__dirname, 'test-for-images.pdf');
    fs.writeFileSync(testPdfPath, pdfBytes);
    console.log('📄 Created test PDF:', testPdfPath);
    
    // Create output directory
    const outputDir = path.join(__dirname, 'pdf-images-output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    console.log('📁 Output directory:', outputDir);
    console.log('');
    console.log('✅ Test PDF ready for conversion!');
    console.log('📄 PDF path:', testPdfPath);
    console.log('📁 Output path:', outputDir);
    console.log('');
    console.log('Now you can test the PDF-to-images conversion with:');
    console.log(`  PDF: ${testPdfPath}`);
    console.log(`  Output: ${outputDir}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testPdfToImages();