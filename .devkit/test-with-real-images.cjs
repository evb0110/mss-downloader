const { NegativeConverterService } = require('../dist/main/services/NegativeConverterService.js');
const fs = require('fs').promises;
const path = require('path');

async function testWithRealImages() {
  console.log('🧪 Testing with real image-based PDF...');
  
  try {
    // Create a PDF that actually contains embedded images (simulating a scanned manuscript)
    const { PDFDocument, rgb } = require('pdf-lib');
    const { Jimp } = require('jimp');
    
    console.log('📄 Creating test PDF with embedded images...');
    
    // Create a realistic scanned manuscript page image
    const manuscriptImage = new Jimp({ 
      width: 1200, 
      height: 1600, 
      color: 0xF8F8F8FF // Off-white paper color
    });
    
    // Add manuscript-like content
    const margin = 80;
    const lineHeight = 12;
    const lineSpacing = 25;
    
    // Add realistic manuscript lines
    for (let y = margin + 100; y < manuscriptImage.height - margin; y += lineSpacing) {
      if (Math.random() > 0.05) { // 95% chance of text line
        const lineStart = margin + Math.random() * 30;
        const lineLength = 0.75 + Math.random() * 0.2;
        const lineEnd = lineStart + (manuscriptImage.width - margin * 2) * lineLength;
        
        for (let x = lineStart; x < lineEnd && x < manuscriptImage.width - margin; x++) {
          for (let dy = 0; dy < lineHeight; dy++) {
            const yPos = y + dy;
            if (yPos < manuscriptImage.height) {
              // Dark ink color with slight variation
              const grayLevel = 25 + Math.random() * 15;
              const color = (grayLevel << 24) | (grayLevel << 16) | (grayLevel << 8) | 0xFF;
              manuscriptImage.setPixelColor(color, x, yPos);
            }
          }
        }
      }
    }
    
    // Add title
    for (let y = margin; y < margin + 50; y++) {
      for (let x = margin; x < manuscriptImage.width - margin; x++) {
        const grayLevel = 20 + Math.random() * 20;
        const color = (grayLevel << 24) | (grayLevel << 16) | (grayLevel << 8) | 0xFF;
        manuscriptImage.setPixelColor(color, x, y);
      }
    }
    
    // Convert to PNG buffer
    const imageBuffer = await manuscriptImage.getBuffer('image/png');
    console.log(`✅ Created ${imageBuffer.length} byte manuscript image`);
    
    // Create PDF with embedded image
    const pdfDoc = await PDFDocument.create();
    const pngImage = await pdfDoc.embedPng(imageBuffer);
    const page = pdfDoc.addPage([pngImage.width * 0.75, pngImage.height * 0.75]); // Scale down a bit
    
    page.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: pngImage.width * 0.75,
      height: pngImage.height * 0.75,
    });
    
    const pdfBytes = await pdfDoc.save();
    const testPdfPath = path.join(__dirname, 'test-with-images.pdf');
    await fs.writeFile(testPdfPath, pdfBytes);
    console.log(`✅ Created test PDF with embedded image: ${pdfBytes.length} bytes`);
    
    // Now test the converter with this real image PDF
    const converter = new NegativeConverterService();
    
    console.log('\n🔄 Testing converter with image-based PDF...\n');
    
    const startTime = Date.now();
    
    const result = await converter.convertPdf(
      new Uint8Array(pdfBytes),
      'test-with-images.pdf',
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
      
      const outputData = await fs.readFile(result.outputPath);
      console.log(`📤 Output size: ${outputData.length} bytes`);
      console.log(`📐 Size difference: ${outputData.length - pdfBytes.length} bytes`);
      
      if (Math.abs(outputData.length - pdfBytes.length) < 100) {
        console.log('⚠️ SAME SIZE - Might be passthrough mode');
      } else {
        console.log('✅ DIFFERENT SIZE - Real processing occurred!');
      }
      
      // Open result for inspection
      const { exec } = require('child_process');
      const outputDir = path.dirname(result.outputPath);
      exec(`open "${outputDir}"`, (error) => {
        if (error) {
          console.log('💡 Manual check: Open Downloads folder to see result');
        } else {
          console.log('📂 Opened Downloads folder - check the inverted result!');
        }
      });
      
    } else {
      console.log(`❌ FAILED: ${result.error}`);
    }
    
    // Cleanup
    await fs.unlink(testPdfPath);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

testWithRealImages();