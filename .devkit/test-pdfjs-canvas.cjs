const { getDocument } = require('pdfjs-dist');
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');

async function testPdfJSCanvas() {
  console.log('🧪 Testing PDF.js + Canvas...');
  
  try {
    // Create a simple test PDF
    const doc = new jsPDF();
    doc.text('Test PDF for PDF.js', 10, 10);
    doc.text('This is a test page', 10, 20);
    const pdfBytes = doc.output('arraybuffer');
    
    console.log('📄 Created test PDF');
    
    // Test PDF.js + Canvas conversion
    const pdfDoc = await getDocument({ data: pdfBytes }).promise;
    console.log(`📋 PDF has ${pdfDoc.numPages} pages`);
    
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });
    
    console.log(`📐 Page dimensions: ${viewport.width}x${viewport.height}`);
    
    const canvas = createCanvas(viewport.width, viewport.height);
    const canvasContext = canvas.getContext('2d');
    
    const renderContext = {
      canvasContext,
      viewport
    };
    
    await page.render(renderContext).promise;
    
    // Convert canvas to JPEG buffer
    const imageBuffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
    console.log(`🖼️  Generated image buffer: ${imageBuffer.length} bytes`);
    
    // Save for verification
    const outputPath = path.join(__dirname, 'test-output.jpg');
    fs.writeFileSync(outputPath, imageBuffer);
    console.log(`💾 Saved test image to: ${outputPath}`);
    
    console.log('✅ PDF.js + Canvas conversion successful!');
    
    // Cleanup
    fs.unlinkSync(outputPath);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testPdfJSCanvas();