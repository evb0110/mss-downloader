const { NegativeConverterService } = require('../dist/main/services/NegativeConverterService.js');
const fs = require('fs').promises;
const path = require('path');

// Monkey patch to simulate Windows ARM64 packaged environment
const originalRequire = require;
const originalPlatform = process.platform;
const originalDirname = __dirname;

// Simulate Windows platform and packaged app environment
Object.defineProperty(process, 'platform', {
  value: 'win32',
  writable: false
});

// Set test environment to simulate packaged mode
process.env.TEST_PACKAGED_MODE = 'true';

console.log('🧪 Testing ARM64 Windows simulation...');
console.log(`📦 Simulated platform: ${process.platform}`);
console.log(`📁 Simulated __dirname: ${global.__dirname}`);

async function createTestPdf() {
  console.log('📄 Creating test PDF...');
  
  const { PDFDocument, rgb } = require('pdf-lib');
  const { Jimp } = require('jimp');
  
  // Create a simple PDF with embedded image
  const manuscriptImage = new Jimp({ 
    width: 800, 
    height: 1000, 
    color: 0xF8F8F8FF 
  });
  
  // Add some content
  for (let y = 50; y < 950; y += 25) {
    for (let x = 50; x < 750; x += 5) {
      if (Math.random() > 0.8) {
        manuscriptImage.setPixelColor(0x404040FF, x, y);
      }
    }
  }
  
  const imageBuffer = await manuscriptImage.getBuffer('image/png');
  
  const pdfDoc = await PDFDocument.create();
  const pngImage = await pdfDoc.embedPng(imageBuffer);
  const page = pdfDoc.addPage([pngImage.width * 0.75, pngImage.height * 0.75]);
  
  page.drawImage(pngImage, {
    x: 0,
    y: 0,
    width: pngImage.width * 0.75,
    height: pngImage.height * 0.75,
  });
  
  const pdfBytes = await pdfDoc.save();
  console.log(`✅ Created test PDF: ${pdfBytes.length} bytes`);
  
  return pdfBytes;
}

async function testArm64Simulation() {
  try {
    const pdfData = await createTestPdf();
    
    console.log('\\n🔄 Testing converter in simulated ARM64 Windows environment...\\n');
    
    const converter = new NegativeConverterService();
    const startTime = Date.now();
    
    const result = await converter.convertPdf(
      new Uint8Array(pdfData),
      'test-arm64-simulation.pdf',
      { quality: 90, dpi: 300 },
      (progress) => {
        console.log(`[${progress.progress || 0}%] ${progress.stage}: ${progress.message}`);
      }
    );
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`\\n⏱️ Conversion took ${duration}s`);
    
    if (result.success) {
      console.log(`✅ SUCCESS in ARM64 simulation!`);
      console.log(`📁 Output: ${result.outputPath}`);
      console.log(`📊 Pages: ${result.pageCount}`);
      
      const outputData = await fs.readFile(result.outputPath);
      console.log(`📤 Output size: ${outputData.length} bytes`);
      console.log(`📐 Size difference: ${outputData.length - pdfData.length} bytes`);
      
      if (Math.abs(outputData.length - pdfData.length) < 100) {
        console.log('⚠️ SAME SIZE - Passthrough mode was used (this means ARM64 fallback worked)');
      } else {
        console.log('✅ DIFFERENT SIZE - Real processing occurred in ARM64 mode!');
      }
      
      // Open result for inspection
      const { exec } = require('child_process');
      const outputDir = path.dirname(result.outputPath);
      exec(`open "${outputDir}"`, (error) => {
        if (error) {
          console.log('💡 Manual check: Open Downloads folder to see result');
        } else {
          console.log('📂 Opened Downloads folder - check the ARM64 result!');
        }
      });
      
    } else {
      console.log(`❌ FAILED in ARM64 simulation: ${result.error}`);
    }
    
  } catch (error) {
    console.error('❌ ARM64 simulation test failed:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  } finally {
    // Restore original values
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: false
    });
    global.__dirname = originalDirname;
    console.log('\\n🔄 Restored original environment');
  }
}

testArm64Simulation();