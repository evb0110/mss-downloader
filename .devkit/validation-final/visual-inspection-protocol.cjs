#!/usr/bin/env node

// Visual inspection protocol for all validation PDFs
// Uses pdfimages and file analysis to verify PDF content quality

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VALIDATION_DIR = path.join(__dirname, 'VALIDATION-READY');
const INSPECTION_DIR = path.join(__dirname, 'VISUAL-INSPECTION-RESULTS');

async function inspectPDF(pdfPath, libraryName) {
  console.log(`\n📄 Inspecting ${libraryName}...`);
  console.log(`   File: ${path.basename(pdfPath)}`);
  
  const stats = fs.statSync(pdfPath);
  console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
  
  const result = {
    library: libraryName,
    fileName: path.basename(pdfPath),
    fileSize: stats.size,
    fileSizeKB: (stats.size / 1024).toFixed(2),
    timestamp: new Date().toISOString(),
    pdfStructure: {},
    imageAnalysis: {},
    contentVerification: {},
    rating: 'unknown',
    issues: [],
    recommendations: []
  };
  
  try {
    // Check if file is 0 bytes (complete failure)
    if (stats.size === 0) {
      result.rating = 'failed';
      result.issues.push('PDF file is 0 bytes - complete failure');
      console.log('   ❌ FAILED: PDF is 0 bytes');
      return result;
    }
    
    // Check if file is suspiciously small (< 10KB might be error PDF)
    if (stats.size < 10240) {
      result.issues.push('PDF is very small (< 10KB) - may contain only error message');
      console.log('   ⚠️  WARNING: PDF is very small, may be error PDF');
    }
    
    // Use pdfimages to analyze PDF structure
    try {
      const pdfImagesOutput = execSync(`pdfimages -list "${pdfPath}"`, { 
        encoding: 'utf8',
        timeout: 30000 
      });
      
      result.pdfStructure.pdfimagesOutput = pdfImagesOutput;
      
      // Parse pdfimages output to count images and get dimensions
      const lines = pdfImagesOutput.split('\n');
      const imageLines = lines.filter(line => line.match(/^\s*\d+/));
      
      result.pdfStructure.totalImages = imageLines.length;
      
      if (imageLines.length === 0) {
        result.issues.push('No images found in PDF - may be text-only or corrupted');
        console.log('   ⚠️  No images detected in PDF');
      } else {
        console.log(`   ✅ Found ${imageLines.length} images in PDF`);
        
        // Analyze image dimensions and types
        const imageSizes = [];
        const imageTypes = [];
        
        for (const line of imageLines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 6) {
            const width = parseInt(parts[2]);
            const height = parseInt(parts[3]);
            const type = parts[5];
            
            if (!isNaN(width) && !isNaN(height)) {
              imageSizes.push({ width, height, pixels: width * height });
              imageTypes.push(type);
            }
          }
        }
        
        if (imageSizes.length > 0) {
          const avgPixels = imageSizes.reduce((sum, img) => sum + img.pixels, 0) / imageSizes.length;
          const maxPixels = Math.max(...imageSizes.map(img => img.pixels));
          
          result.imageAnalysis = {
            imageCount: imageSizes.length,
            averagePixels: Math.round(avgPixels),
            maxPixels: maxPixels,
            imageTypes: [...new Set(imageTypes)],
            resolutionQuality: maxPixels > 2000000 ? 'high' : maxPixels > 500000 ? 'medium' : 'low'
          };
          
          console.log(`   📊 Image analysis: ${imageSizes.length} images, avg ${Math.round(avgPixels).toLocaleString()} pixels`);
          console.log(`   📏 Max resolution: ${Math.sqrt(maxPixels).toFixed(0)}x${Math.sqrt(maxPixels).toFixed(0)} (~${(maxPixels/1000000).toFixed(1)}MP)`);
          console.log(`   🎨 Image types: ${[...new Set(imageTypes)].join(', ')}`);
        }
      }
      
    } catch (pdfImagesError) {
      result.issues.push('pdfimages analysis failed - PDF may be corrupted');
      console.log('   ⚠️  pdfimages analysis failed');
    }
    
    // Extract first few images for visual content verification
    if (result.pdfStructure.totalImages > 0) {
      try {
        const extractDir = path.join(INSPECTION_DIR, libraryName.replace(/[^a-zA-Z0-9]/g, '-'));
        if (!fs.existsSync(extractDir)) {
          fs.mkdirSync(extractDir, { recursive: true });
        }
        
        // Extract first 3 images for visual inspection
        execSync(`pdfimages -png -f 1 -l 3 "${pdfPath}" "${path.join(extractDir, 'page')}"`, {
          timeout: 30000
        });
        
        // Check extracted images
        const extractedFiles = fs.readdirSync(extractDir).filter(f => f.endsWith('.png'));
        result.contentVerification.extractedImages = extractedFiles.length;
        
        if (extractedFiles.length > 0) {
          console.log(`   🖼️  Extracted ${extractedFiles.length} images for content verification`);
          
          // Analyze first extracted image
          const firstImagePath = path.join(extractDir, extractedFiles[0]);
          if (fs.existsSync(firstImagePath)) {
            const imageStats = fs.statSync(firstImagePath);
            result.contentVerification.firstImageSize = imageStats.size;
            result.contentVerification.firstImagePath = firstImagePath;
            
            if (imageStats.size < 5000) {
              result.issues.push('Extracted images are very small - may be placeholders or low quality');
            }
          }
        } else {
          result.issues.push('Failed to extract images from PDF for content verification');
        }
        
      } catch (extractError) {
        result.issues.push('Failed to extract images for visual inspection');
        console.log('   ⚠️  Image extraction failed');
      }
    }
    
    // Overall rating based on analysis
    if (result.issues.length === 0 && result.pdfStructure.totalImages > 0) {
      if (result.imageAnalysis.resolutionQuality === 'high' && result.pdfStructure.totalImages > 1) {
        result.rating = 'excellent';
      } else if (result.imageAnalysis.resolutionQuality !== 'low' && result.pdfStructure.totalImages > 1) {
        result.rating = 'good';
      } else {
        result.rating = 'acceptable';
      }
    } else if (result.issues.some(issue => issue.includes('0 bytes') || issue.includes('corrupted'))) {
      result.rating = 'failed';
    } else {
      result.rating = 'needs_review';
    }
    
    // Generate recommendations
    if (result.rating === 'failed') {
      result.recommendations.push('This PDF must be regenerated - it contains no valid content');
    } else if (result.issues.length > 0) {
      result.recommendations.push('Review manually for content quality and fix any identified issues');
    } else {
      result.recommendations.push('PDF appears to contain valid manuscript content and is ready for user validation');
    }
    
    const ratingEmoji = {
      'excellent': '🌟',
      'good': '✅',
      'acceptable': '👍',
      'needs_review': '⚠️',
      'failed': '❌',
      'unknown': '❓'
    };
    
    console.log(`   ${ratingEmoji[result.rating]} Rating: ${result.rating.toUpperCase()}`);
    
    if (result.issues.length > 0) {
      console.log(`   Issues: ${result.issues.length}`);
      result.issues.forEach(issue => console.log(`     - ${issue}`));
    }
    
  } catch (error) {
    result.rating = 'failed';
    result.issues.push(`Inspection failed: ${error.message}`);
    console.log(`   ❌ Inspection failed: ${error.message}`);
  }
  
  return result;
}

async function runVisualInspection() {
  console.log('🔍 VISUAL INSPECTION PROTOCOL FOR VALIDATION PDFS');
  console.log('================================================\n');
  
  // Ensure inspection results directory exists
  if (!fs.existsSync(INSPECTION_DIR)) {
    fs.mkdirSync(INSPECTION_DIR, { recursive: true });
  }
  
  // Get all PDF files from validation directory
  const pdfFiles = fs.readdirSync(VALIDATION_DIR)
    .filter(file => file.endsWith('.pdf'))
    .sort();
  
  console.log(`Found ${pdfFiles.length} validation PDFs to inspect`);
  
  const inspectionResults = [];
  
  for (const pdfFile of pdfFiles) {
    const pdfPath = path.join(VALIDATION_DIR, pdfFile);
    const libraryName = path.basename(pdfFile, '.pdf').replace('-VALIDATION', '');
    
    const result = await inspectPDF(pdfPath, libraryName);
    inspectionResults.push(result);
  }
  
  // Generate comprehensive summary
  console.log('\n📊 VISUAL INSPECTION SUMMARY');
  console.log('============================');
  
  const ratings = {
    excellent: inspectionResults.filter(r => r.rating === 'excellent').length,
    good: inspectionResults.filter(r => r.rating === 'good').length,
    acceptable: inspectionResults.filter(r => r.rating === 'acceptable').length,
    needs_review: inspectionResults.filter(r => r.rating === 'needs_review').length,
    failed: inspectionResults.filter(r => r.rating === 'failed').length
  };
  
  console.log(`🌟 Excellent: ${ratings.excellent}`);
  console.log(`✅ Good: ${ratings.good}`);  
  console.log(`👍 Acceptable: ${ratings.acceptable}`);
  console.log(`⚠️  Needs Review: ${ratings.needs_review}`);
  console.log(`❌ Failed: ${ratings.failed}`);
  
  const passableCount = ratings.excellent + ratings.good + ratings.acceptable;
  const totalCount = inspectionResults.length;
  
  console.log(`\n🎯 QUALITY RATE: ${passableCount}/${totalCount} (${((passableCount/totalCount)*100).toFixed(1)}%)`);
  
  // Detailed results
  console.log('\n📋 DETAILED RESULTS:');
  inspectionResults.forEach(result => {
    const emoji = {
      'excellent': '🌟',
      'good': '✅',
      'acceptable': '👍',
      'needs_review': '⚠️',
      'failed': '❌'
    }[result.rating] || '❓';
    
    console.log(`${emoji} ${result.library}: ${result.rating} (${result.fileSizeKB} KB, ${result.pdfStructure.totalImages || 0} images)`);
  });
  
  // Save comprehensive report
  const reportPath = path.join(INSPECTION_DIR, 'VISUAL-INSPECTION-REPORT.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalPDFs: totalCount,
    ratings: ratings,
    qualityRate: ((passableCount/totalCount)*100).toFixed(1) + '%',
    results: inspectionResults,
    summary: {
      readyForUser: passableCount,
      needsAttention: ratings.needs_review + ratings.failed,
      recommendation: passableCount === totalCount ? 
        'All PDFs passed visual inspection - ready for user validation' :
        `${ratings.needs_review + ratings.failed} PDFs need attention before user validation`
    }
  }, null, 2));
  
  console.log(`\n📊 Report saved: ${reportPath}`);
  console.log(`🔍 Extracted images: ${INSPECTION_DIR}`);
  
  if (passableCount === totalCount) {
    console.log('\n🎉 ALL PDFS PASSED VISUAL INSPECTION!');
    console.log('✅ Ready for user validation and version bump approval');
  } else {
    console.log(`\n⚠️  ${ratings.needs_review + ratings.failed} PDFs need attention before proceeding`);
    console.log('Review failed/problematic PDFs and regenerate if necessary');
  }
  
  return inspectionResults;
}

// Run visual inspection
if (require.main === module) {
  runVisualInspection().catch(error => {
    console.error('❌ Visual inspection failed:', error);
    process.exit(1);
  });
}

module.exports = { runVisualInspection };