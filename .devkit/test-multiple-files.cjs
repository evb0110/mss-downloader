const { NegativeConverterService } = require('../dist/main/services/NegativeConverterService.js');
const fs = require('fs').promises;
const path = require('path');

async function createTestPdf(name, textContent) {
  console.log(`📄 Creating test PDF: ${name}...`);
  
  // Create a PDF that actually contains embedded images (simulating a scanned manuscript)
  const { PDFDocument, rgb } = require('pdf-lib');
  const { Jimp } = require('jimp');
  
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
  
  // Add title with text content
  for (let y = margin; y < margin + 50; y++) {
    for (let x = margin; x < manuscriptImage.width - margin; x++) {
      const grayLevel = 20 + Math.random() * 20;
      const color = (grayLevel << 24) | (grayLevel << 16) | (grayLevel << 8) | 0xFF;
      manuscriptImage.setPixelColor(color, x, y);
    }
  }
  
  // Convert to PNG buffer
  const imageBuffer = await manuscriptImage.getBuffer('image/png');
  
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
  console.log(`✅ Created ${name}: ${pdfBytes.length} bytes`);
  
  return pdfBytes;
}

async function testMultipleFiles() {
  console.log('🧪 Testing with multiple PDF files...');
  
  try {
    // Create multiple test PDFs
    const pdf1 = await createTestPdf('manuscript1.pdf', 'First Manuscript');
    const pdf2 = await createTestPdf('manuscript2.pdf', 'Second Manuscript');
    const pdf3 = await createTestPdf('manuscript3.pdf', 'Third Manuscript');
    
    console.log('\\n🔄 Testing converter with multiple PDFs sequentially...\\n');
    
    const converter = new NegativeConverterService();
    const results = [];
    
    // Test converting multiple files in sequence (simulating user adding files one by one)
    for (const [index, pdfData] of [[pdf1, 'manuscript1.pdf'], [pdf2, 'manuscript2.pdf'], [pdf3, 'manuscript3.pdf']].entries()) {
      console.log(`\\n--- Converting File ${index + 1} ---`);
      const startTime = Date.now();
      
      const result = await converter.convertPdf(
        new Uint8Array(pdfData[0]),
        pdfData[1],
        { quality: 90, dpi: 300 },
        (progress) => {
          console.log(`[${progress.progress || 0}%] ${progress.stage}: ${progress.message}`);
        }
      );
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      console.log(`⏱️ File ${index + 1} conversion took ${duration}s`);
      
      if (result.success) {
        console.log(`✅ SUCCESS! File ${index + 1}`);
        console.log(`📁 Output: ${result.outputPath}`);
        console.log(`📊 Pages: ${result.pageCount}`);
        
        const outputData = await fs.readFile(result.outputPath);
        console.log(`📤 Output size: ${outputData.length} bytes`);
        console.log(`📐 Size difference: ${outputData.length - pdfData[0].length} bytes`);
        
        results.push({ success: true, file: pdfData[1], outputPath: result.outputPath });
      } else {
        console.log(`❌ FAILED File ${index + 1}: ${result.error}`);
        results.push({ success: false, file: pdfData[1], error: result.error });
      }
      
      // Add small delay between conversions to simulate real usage
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\\n📊 FINAL RESULTS:');
    results.forEach((result, index) => {
      if (result.success) {
        console.log(`✅ File ${index + 1} (${result.file}): SUCCESS -> ${result.outputPath}`);
      } else {
        console.log(`❌ File ${index + 1} (${result.file}): FAILED -> ${result.error}`);
      }
    });
    
    const successCount = results.filter(r => r.success).length;
    console.log(`\\n🎯 Overall: ${successCount}/${results.length} files converted successfully`);
    
    if (successCount > 0) {
      // Open Downloads folder to see results
      const { exec } = require('child_process');
      exec(`open "/Users/e.barsky/Downloads"`, (error) => {
        if (error) {
          console.log('💡 Manual check: Open Downloads folder to see all converted files');
        } else {
          console.log('📂 Opened Downloads folder - check all the inverted results!');
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

testMultipleFiles();