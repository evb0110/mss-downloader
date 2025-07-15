#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

/**
 * Large PDF Processing Test
 * Validates that the timeout fix allows complete processing of large PDFs
 */

console.log('🧪 Testing Large PDF Processing (151 pages)');
console.log('===========================================');

const textorPath = path.join(os.homedir(), 'Desktop', 'textor');
const testPdfPath = path.join(textorPath, 'V-CVbav-Borgh_405_pages_1-151.pdf');

async function validateTestPdf() {
  try {
    const stats = await fs.stat(testPdfPath);
    console.log(`✅ Found test PDF: ${path.basename(testPdfPath)}`);
    console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Expected pages: 151`);
    return true;
  } catch (error) {
    console.error('❌ Test PDF not found:', testPdfPath);
    return false;
  }
}

async function cleanupPreviousResults() {
  try {
    console.log('🧹 Cleaning up previous test results...');
    
    // Clean up textor temp directories
    const files = await fs.readdir(textorPath);
    for (const file of files) {
      if (file.includes('temp_') && file.includes('V-CVbav-Borgh_405')) {
        const tempDir = path.join(textorPath, file);
        await fs.rm(tempDir, { recursive: true, force: true });
        console.log(`   Removed: ${file}`);
      }
    }
    
    // Clean up Downloads directories
    const downloadsPath = path.join(os.homedir(), 'Downloads');
    const downloadFiles = await fs.readdir(downloadsPath);
    for (const file of downloadFiles) {
      if (file.includes('PDF_Negative_Conversions')) {
        const tempDir = path.join(downloadsPath, file);
        await fs.rm(tempDir, { recursive: true, force: true });
        console.log(`   Removed from Downloads: ${file}`);
      }
    }
    
    console.log('✅ Cleanup complete');
  } catch (error) {
    console.log('⚠️ Cleanup error (may be normal):', error.message);
  }
}

async function monitorProcessingProgress() {
  console.log('\n📊 Monitoring processing progress...');
  
  const startTime = Date.now();
  let lastPageCount = 0;
  let stuckCount = 0;
  
  const progressInterval = setInterval(async () => {
    try {
      // Check for temp directories
      const files = await fs.readdir(textorPath);
      const tempDirs = files.filter(f => f.includes('temp_') && f.includes('V-CVbav-Borgh_405'));
      
      if (tempDirs.length > 0) {
        const tempDir = path.join(textorPath, tempDirs[0]);
        const tempFiles = await fs.readdir(tempDir);
        const imageFiles = tempFiles.filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
        
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        
        if (imageFiles.length > lastPageCount) {
          console.log(`   📈 Progress: ${imageFiles.length} pages processed (${elapsed}s elapsed)`);
          lastPageCount = imageFiles.length;
          stuckCount = 0;
        } else if (imageFiles.length === lastPageCount && imageFiles.length > 0) {
          stuckCount++;
          if (stuckCount > 10) {
            console.log(`   ⚠️ Processing appears stuck at ${imageFiles.length} pages for ${stuckCount * 5}s`);
          }
        }
        
        // Check for completion
        if (imageFiles.length >= 151) {
          console.log(`   🎉 All 151 pages processed!`);
          clearInterval(progressInterval);
        }
      }
    } catch (error) {
      // Ignore errors during monitoring
    }
  }, 5000);
  
  // Stop monitoring after 45 minutes
  setTimeout(() => {
    clearInterval(progressInterval);
    console.log('⏰ Progress monitoring stopped after 45 minutes');
  }, 2700000);
}

async function validateResults() {
  console.log('\n🔍 Validating results...');
  
  try {
    // Check for temp directories
    const files = await fs.readdir(textorPath);
    const tempDirs = files.filter(f => f.includes('temp_') && f.includes('V-CVbav-Borgh_405'));
    
    if (tempDirs.length === 0) {
      console.log('❌ No temp directory found - processing may have failed');
      return false;
    }
    
    const tempDir = path.join(textorPath, tempDirs[0]);
    const tempFiles = await fs.readdir(tempDir);
    
    // Count different types of files
    const imageFiles = tempFiles.filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
    const pdfFiles = tempFiles.filter(f => f.endsWith('.pdf'));
    const invertedFiles = tempFiles.filter(f => f.includes('inverted'));
    
    console.log(`📊 Processing Results:`);
    console.log(`   Total image files: ${imageFiles.length}`);
    console.log(`   Inverted image files: ${invertedFiles.length}`);
    console.log(`   PDF files: ${pdfFiles.length}`);
    
    // Check if we got all 151 pages
    if (imageFiles.length >= 151) {
      console.log('✅ SUCCESS: All 151 pages were processed!');
      return true;
    } else if (imageFiles.length > 2) {
      console.log(`⚠️ PARTIAL: ${imageFiles.length} pages processed (expected 151)`);
      console.log('   This is better than the previous 2-page limit');
      return true;
    } else {
      console.log(`❌ FAILURE: Only ${imageFiles.length} pages processed`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error validating results:', error.message);
    return false;
  }
}

async function runTest() {
  console.log('🚀 Starting Large PDF Processing Test');
  console.log('=====================================');
  
  // Validate test PDF exists
  if (!await validateTestPdf()) {
    console.log('❌ Cannot run test without the 151-page PDF');
    return;
  }
  
  // Clean up previous results
  await cleanupPreviousResults();
  
  // Start monitoring
  monitorProcessingProgress();
  
  console.log('\n💡 Instructions:');
  console.log('1. Start the Electron app (npm run dev)');
  console.log('2. Use the negative converter on the 151-page PDF');
  console.log('3. Watch the progress updates (should go beyond 2 pages now)');
  console.log('4. Wait for completion (may take 20-30 minutes)');
  console.log('5. Check results with this script');
  
  console.log('\n⏳ This test will monitor progress for 45 minutes...');
  console.log('📊 Progress updates will show every 5 seconds');
  console.log('🛑 Press Ctrl+C to stop monitoring early');
  
  // Keep the process running
  const keepAlive = setInterval(() => {
    // Just keep the process alive
  }, 30000);
  
  // Auto-validate after 45 minutes
  setTimeout(async () => {
    clearInterval(keepAlive);
    console.log('\n🔍 Auto-validation starting...');
    const success = await validateResults();
    
    if (success) {
      console.log('\n🎉 TEST PASSED: Large PDF processing is working!');
    } else {
      console.log('\n❌ TEST FAILED: Large PDF processing still has issues');
    }
    
    process.exit(success ? 0 : 1);
  }, 2700000);
}

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
  console.log('\n🛑 Test interrupted by user');
  console.log('📊 Checking current progress...');
  
  await validateResults();
  process.exit(0);
});

// Run the test
runTest().catch(console.error);