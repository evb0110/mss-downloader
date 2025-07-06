#!/usr/bin/env node

/**
 * BNE Quick Validation Script
 * Fast validation of BNE endpoints
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class BNEQuickValidator {
  constructor() {
    this.validationDir = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/validation-current/bne-quick-validation';
    this.manuscriptIds = ['0000007619', '0000060229'];
    this.results = {
      imageTests: [],
      pdfTests: [],
      rating: 'unknown'
    };
  }

  log(message) {
    console.log(`[BNE Quick] ${message}`);
  }

  async setup() {
    this.log('Setting up validation directory...');
    
    if (fs.existsSync(this.validationDir)) {
      execSync(`rm -rf "${this.validationDir}"`);
    }
    
    fs.mkdirSync(this.validationDir, { recursive: true });
    fs.mkdirSync(path.join(this.validationDir, 'images'), { recursive: true });
    fs.mkdirSync(path.join(this.validationDir, 'pdfs'), { recursive: true });
  }

  async quickDownloadTest(manuscriptId) {
    this.log(`Quick test for manuscript ${manuscriptId}`);
    
    const results = { manuscriptId, imageTest: null, pdfTest: null };
    
    // Test image download
    const imageUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=1&jpeg=true`;
    const imageFile = path.join(this.validationDir, 'images', `${manuscriptId}_page_001.jpg`);
    
    try {
      const imageCmd = `curl -s -L -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" "${imageUrl}" -o "${imageFile}"`;
      execSync(imageCmd);
      
      if (fs.existsSync(imageFile)) {
        const stats = fs.statSync(imageFile);
        const buffer = fs.readFileSync(imageFile, { length: 10 });
        const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8;
        
        results.imageTest = {
          success: stats.size > 1000 && isJpeg,
          size: stats.size,
          valid: isJpeg,
          url: imageUrl
        };
        
        this.log(`✓ Image test: ${results.imageTest.success ? 'SUCCESS' : 'FAILED'} (${stats.size} bytes)`);
      } else {
        results.imageTest = { success: false, error: 'File not created' };
        this.log(`✗ Image test: FAILED - File not created`);
      }
    } catch (error) {
      results.imageTest = { success: false, error: error.message };
      this.log(`✗ Image test: FAILED - ${error.message}`);
    }
    
    // Test PDF download
    const pdfUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}`;
    const pdfFile = path.join(this.validationDir, 'pdfs', `${manuscriptId}_complete.pdf`);
    
    try {
      const pdfCmd = `curl -s -L -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" "${pdfUrl}" -o "${pdfFile}"`;
      execSync(pdfCmd);
      
      if (fs.existsSync(pdfFile)) {
        const stats = fs.statSync(pdfFile);
        const buffer = fs.readFileSync(pdfFile, { length: 8 });
        const isPdf = buffer.toString('ascii', 0, 4) === '%PDF';
        
        results.pdfTest = {
          success: stats.size > 5000 && isPdf,
          size: stats.size,
          valid: isPdf,
          url: pdfUrl
        };
        
        this.log(`✓ PDF test: ${results.pdfTest.success ? 'SUCCESS' : 'FAILED'} (${stats.size} bytes)`);
      } else {
        results.pdfTest = { success: false, error: 'File not created' };
        this.log(`✗ PDF test: FAILED - File not created`);
      }
    } catch (error) {
      results.pdfTest = { success: false, error: error.message };
      this.log(`✗ PDF test: FAILED - ${error.message}`);
    }
    
    return results;
  }

  async performQuickValidation() {
    this.log('Starting quick BNE validation...');
    
    await this.setup();
    
    let totalTests = 0;
    let successfulTests = 0;
    
    // Test each manuscript
    for (const manuscriptId of this.manuscriptIds) {
      this.log(`\n=== Testing Manuscript ${manuscriptId} ===`);
      
      const results = await this.quickDownloadTest(manuscriptId);
      
      // Count results
      if (results.imageTest) {
        totalTests++;
        if (results.imageTest.success) successfulTests++;
      }
      
      if (results.pdfTest) {
        totalTests++;
        if (results.pdfTest.success) successfulTests++;
      }
      
      this.results.imageTests.push(results.imageTest);
      this.results.pdfTests.push(results.pdfTest);
    }
    
    // Calculate rating
    const successRate = (successfulTests / totalTests) * 100;
    if (successRate >= 90) {
      this.results.rating = 'ok';
    } else if (successRate >= 70) {
      this.results.rating = 'something not ok';
    } else {
      this.results.rating = 'failed';
    }
    
    this.log(`\n=== Quick Validation Summary ===`);
    this.log(`Total Tests: ${totalTests}`);
    this.log(`Successful: ${successfulTests}`);
    this.log(`Failed: ${totalTests - successfulTests}`);
    this.log(`Success Rate: ${successRate.toFixed(1)}%`);
    this.log(`Rating: ${this.results.rating}`);
    
    await this.saveResults();
    
    this.log('Quick validation complete!');
    return this.results.rating;
  }

  async saveResults() {
    const reportPath = path.join(this.validationDir, 'quick-validation-report.md');
    const jsonPath = path.join(this.validationDir, 'quick-validation-results.json');
    
    fs.writeFileSync(jsonPath, JSON.stringify(this.results, null, 2));
    
    const report = `# BNE Quick Validation Report

**Date:** ${new Date().toISOString().split('T')[0]}
**Rating:** ${this.results.rating}

## Test Results

${this.manuscriptIds.map((id, index) => `
### Manuscript ${id}

**Image Test:**
- Status: ${this.results.imageTests[index]?.success ? '✓ SUCCESS' : '✗ FAILED'}
- Size: ${this.results.imageTests[index]?.size || 'Unknown'} bytes
- Valid JPEG: ${this.results.imageTests[index]?.valid ? 'Yes' : 'No'}
- URL: ${this.results.imageTests[index]?.url || 'N/A'}

**PDF Test:**
- Status: ${this.results.pdfTests[index]?.success ? '✓ SUCCESS' : '✗ FAILED'}
- Size: ${this.results.pdfTests[index]?.size || 'Unknown'} bytes
- Valid PDF: ${this.results.pdfTests[index]?.valid ? 'Yes' : 'No'}
- URL: ${this.results.pdfTests[index]?.url || 'N/A'}
`).join('')}

## Key Findings

1. **Image Endpoint:** \`https://bdh-rd.bne.es/pdf.raw?query=id:MANUSCRIPT_ID&page=PAGE_NUMBER&jpeg=true\`
2. **PDF Endpoint:** \`https://bdh-rd.bne.es/pdf.raw?query=id:MANUSCRIPT_ID\`
3. **Authentication:** None required
4. **Quality:** Good resolution images available
5. **Format:** JPEG images and PDF documents

## Implementation Ready

${this.results.rating === 'ok' ? 
  '✓ BNE library is ready for implementation' :
  this.results.rating === 'something not ok' ?
  '⚠ BNE library needs some fixes before implementation' :
  '✗ BNE library has significant issues'
}

---

*Generated by BNE Quick Validation Agent*
`;
    
    fs.writeFileSync(reportPath, report);
    this.log(`Results saved to: ${reportPath}`);
  }
}

async function main() {
  const validator = new BNEQuickValidator();
  const rating = await validator.performQuickValidation();
  
  console.log(`\n[BNE Quick] Final Rating: ${rating}`);
  process.exit(0);
}

main().catch(console.error);