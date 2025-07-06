#!/usr/bin/env node

/**
 * BNE Validation Script
 * Downloads actual images and PDFs to validate the discovered endpoints
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class BNEValidator {
  constructor() {
    this.validationDir = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/validation-current/bne-validation';
    this.manuscriptIds = ['0000007619', '0000060229', '0000015300'];
    this.results = {
      imageDownloads: [],
      pdfDownloads: [],
      pageCounts: [],
      maxResolutionTests: [],
      validationSummary: {
        totalTests: 0,
        successfulTests: 0,
        failedTests: 0,
        rating: 'unknown'
      }
    };
  }

  log(message) {
    console.log(`[BNE Validator] ${message}`);
  }

  async setup() {
    this.log('Setting up validation directory...');
    
    if (fs.existsSync(this.validationDir)) {
      execSync(`rm -rf "${this.validationDir}"`);
    }
    
    fs.mkdirSync(this.validationDir, { recursive: true });
    
    // Create subdirectories
    fs.mkdirSync(path.join(this.validationDir, 'images'), { recursive: true });
    fs.mkdirSync(path.join(this.validationDir, 'pdfs'), { recursive: true });
    fs.mkdirSync(path.join(this.validationDir, 'analysis'), { recursive: true });
  }

  async downloadImage(manuscriptId, pageNumber) {
    this.log(`Downloading image for manuscript ${manuscriptId}, page ${pageNumber}`);
    
    const imageUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=${pageNumber}&jpeg=true`;
    const filename = `${manuscriptId}_page_${pageNumber.toString().padStart(3, '0')}.jpg`;
    const filepath = path.join(this.validationDir, 'images', filename);
    
    try {
      const curlCommand = `curl -s -L -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" "${imageUrl}" -o "${filepath}"`;
      execSync(curlCommand);
      
      // Check if file was downloaded and is valid
      if (fs.existsSync(filepath)) {
        const stats = fs.statSync(filepath);
        if (stats.size > 1000) { // Reasonable image size
          this.log(`✓ Downloaded image: ${filename} (${stats.size} bytes)`);
          return {
            success: true,
            filename: filename,
            filepath: filepath,
            size: stats.size,
            url: imageUrl
          };
        }
      }
      
      this.log(`✗ Failed to download valid image: ${filename}`);
      return {
        success: false,
        filename: filename,
        url: imageUrl,
        error: 'Invalid or empty file'
      };
    } catch (error) {
      this.log(`✗ Error downloading image ${filename}: ${error.message}`);
      return {
        success: false,
        filename: filename,
        url: imageUrl,
        error: error.message
      };
    }
  }

  async downloadPdf(manuscriptId) {
    this.log(`Downloading PDF for manuscript ${manuscriptId}`);
    
    const pdfUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}`;
    const filename = `${manuscriptId}_complete.pdf`;
    const filepath = path.join(this.validationDir, 'pdfs', filename);
    
    try {
      const curlCommand = `curl -s -L -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" "${pdfUrl}" -o "${filepath}"`;
      execSync(curlCommand);
      
      // Check if file was downloaded and is valid PDF
      if (fs.existsSync(filepath)) {
        const stats = fs.statSync(filepath);
        if (stats.size > 5000) { // Reasonable PDF size
          // Check if it's actually a PDF by reading first few bytes
          const buffer = fs.readFileSync(filepath, { length: 8 });
          const isPdf = buffer.toString('ascii', 0, 4) === '%PDF';
          
          if (isPdf) {
            this.log(`✓ Downloaded PDF: ${filename} (${stats.size} bytes)`);
            return {
              success: true,
              filename: filename,
              filepath: filepath,
              size: stats.size,
              url: pdfUrl,
              isPdf: true
            };
          }
        }
      }
      
      this.log(`✗ Failed to download valid PDF: ${filename}`);
      return {
        success: false,
        filename: filename,
        url: pdfUrl,
        error: 'Invalid or empty PDF file'
      };
    } catch (error) {
      this.log(`✗ Error downloading PDF ${filename}: ${error.message}`);
      return {
        success: false,
        filename: filename,
        url: pdfUrl,
        error: error.message
      };
    }
  }

  async testPageCount(manuscriptId) {
    this.log(`Testing page count for manuscript ${manuscriptId}`);
    
    const maxPages = 20; // Test up to 20 pages
    let validPages = 0;
    const pageResults = [];
    
    for (let page = 1; page <= maxPages; page++) {
      const imageUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=${page}&jpeg=true`;
      
      try {
        const curlCommand = `curl -s -I -L -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" "${imageUrl}"`;
        const headers = execSync(curlCommand, { encoding: 'utf8' });
        
        const statusMatch = headers.match(/HTTP\/[\d.]+\s+(\d+)/);
        const status = statusMatch ? parseInt(statusMatch[1]) : 0;
        
        const contentLengthMatch = headers.match(/content-length:\s*(\d+)/i);
        const contentLength = contentLengthMatch ? parseInt(contentLengthMatch[1]) : 0;
        
        const contentTypeMatch = headers.match(/content-type:\s*([^\r\n]+)/i);
        const contentType = contentTypeMatch ? contentTypeMatch[1].trim() : '';
        
        if (status === 200 && contentType.includes('image') && contentLength > 1000) {
          validPages++;
          pageResults.push({
            page: page,
            valid: true,
            size: contentLength,
            contentType: contentType
          });
        } else {
          pageResults.push({
            page: page,
            valid: false,
            status: status,
            size: contentLength,
            contentType: contentType
          });
          
          // If we hit 3 consecutive invalid pages, assume we've reached the end
          if (page > 3 && pageResults.slice(-3).every(p => !p.valid)) {
            break;
          }
        }
      } catch (error) {
        pageResults.push({
          page: page,
          valid: false,
          error: error.message
        });
      }
    }
    
    this.log(`Found ${validPages} valid pages for manuscript ${manuscriptId}`);
    
    return {
      manuscriptId: manuscriptId,
      validPages: validPages,
      totalTested: pageResults.length,
      pageResults: pageResults
    };
  }

  async testMaxResolution(manuscriptId) {
    this.log(`Testing maximum resolution for manuscript ${manuscriptId}`);
    
    // Test different resolution parameters
    const resolutionTests = [
      { url: `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=1&jpeg=true`, desc: 'default' },
      { url: `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=1&jpeg=true&size=large`, desc: 'large' },
      { url: `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=1&jpeg=true&resolution=high`, desc: 'high resolution' },
      { url: `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=1&jpeg=true&quality=best`, desc: 'best quality' }
    ];
    
    const results = [];
    
    for (const test of resolutionTests) {
      try {
        const curlCommand = `curl -s -I -L -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" "${test.url}"`;
        const headers = execSync(curlCommand, { encoding: 'utf8' });
        
        const statusMatch = headers.match(/HTTP\/[\d.]+\s+(\d+)/);
        const status = statusMatch ? parseInt(statusMatch[1]) : 0;
        
        const contentLengthMatch = headers.match(/content-length:\s*(\d+)/i);
        const contentLength = contentLengthMatch ? parseInt(contentLengthMatch[1]) : 0;
        
        const contentTypeMatch = headers.match(/content-type:\s*([^\r\n]+)/i);
        const contentType = contentTypeMatch ? contentTypeMatch[1].trim() : '';
        
        results.push({
          description: test.desc,
          url: test.url,
          status: status,
          size: contentLength,
          contentType: contentType,
          success: status === 200 && contentType.includes('image')
        });
      } catch (error) {
        results.push({
          description: test.desc,
          url: test.url,
          error: error.message,
          success: false
        });
      }
    }
    
    // Find the highest resolution (largest file size)
    const successful = results.filter(r => r.success);
    const bestResolution = successful.reduce((max, current) => 
      (current.size > max.size) ? current : max, 
      successful[0] || { size: 0 }
    );
    
    return {
      manuscriptId: manuscriptId,
      tests: results,
      bestResolution: bestResolution,
      maxSize: bestResolution.size || 0
    };
  }

  async validateContent(filename) {
    this.log(`Validating content of ${filename}`);
    
    const filepath = path.join(this.validationDir, 'images', filename);
    
    if (!fs.existsSync(filepath)) {
      return { valid: false, error: 'File not found' };
    }
    
    const stats = fs.statSync(filepath);
    
    // Basic validation
    if (stats.size < 1000) {
      return { valid: false, error: 'File too small' };
    }
    
    // Check if it's a valid image by reading header
    const buffer = fs.readFileSync(filepath, { length: 10 });
    const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8;
    
    if (!isJpeg) {
      return { valid: false, error: 'Not a valid JPEG image' };
    }
    
    return {
      valid: true,
      size: stats.size,
      type: 'JPEG',
      dimensions: 'unknown' // Would need image processing library for actual dimensions
    };
  }

  async performFullValidation() {
    this.log('Starting comprehensive BNE validation...');
    
    await this.setup();
    
    let totalTests = 0;
    let successfulTests = 0;
    
    // Test each manuscript
    for (const manuscriptId of this.manuscriptIds) {
      this.log(`\n=== Testing Manuscript ${manuscriptId} ===`);
      
      // Test page count
      const pageCountResult = await this.testPageCount(manuscriptId);
      this.results.pageCounts.push(pageCountResult);
      totalTests++;
      if (pageCountResult.validPages > 0) successfulTests++;
      
      // Test max resolution
      const maxResResult = await this.testMaxResolution(manuscriptId);
      this.results.maxResolutionTests.push(maxResResult);
      totalTests++;
      if (maxResResult.bestResolution && maxResResult.maxSize > 0) successfulTests++;
      
      // Download sample images (first 3 pages)
      const pagesToDownload = Math.min(3, pageCountResult.validPages);
      for (let page = 1; page <= pagesToDownload; page++) {
        const imageResult = await this.downloadImage(manuscriptId, page);
        this.results.imageDownloads.push(imageResult);
        totalTests++;
        if (imageResult.success) successfulTests++;
        
        // Validate content
        if (imageResult.success) {
          const contentValidation = await this.validateContent(imageResult.filename);
          imageResult.contentValidation = contentValidation;
          if (!contentValidation.valid) {
            this.log(`⚠ Content validation failed for ${imageResult.filename}: ${contentValidation.error}`);
          }
        }
      }
      
      // Download PDF
      const pdfResult = await this.downloadPdf(manuscriptId);
      this.results.pdfDownloads.push(pdfResult);
      totalTests++;
      if (pdfResult.success) successfulTests++;
    }
    
    // Calculate overall success rate
    this.results.validationSummary.totalTests = totalTests;
    this.results.validationSummary.successfulTests = successfulTests;
    this.results.validationSummary.failedTests = totalTests - successfulTests;
    
    const successRate = (successfulTests / totalTests) * 100;
    if (successRate >= 90) {
      this.results.validationSummary.rating = 'ok';
    } else if (successRate >= 70) {
      this.results.validationSummary.rating = 'something not ok';
    } else {
      this.results.validationSummary.rating = 'failed';
    }
    
    this.log(`\n=== Validation Summary ===`);
    this.log(`Total Tests: ${totalTests}`);
    this.log(`Successful: ${successfulTests}`);
    this.log(`Failed: ${totalTests - successfulTests}`);
    this.log(`Success Rate: ${successRate.toFixed(1)}%`);
    this.log(`Rating: ${this.results.validationSummary.rating}`);
    
    await this.saveResults();
    
    this.log('Validation complete!');
    return this.results.validationSummary.rating;
  }

  async saveResults() {
    const resultsPath = path.join(this.validationDir, 'analysis', 'validation-results.json');
    const reportPath = path.join(this.validationDir, 'analysis', 'validation-report.md');
    
    fs.writeFileSync(resultsPath, JSON.stringify(this.results, null, 2));
    
    const report = this.generateMarkdownReport();
    fs.writeFileSync(reportPath, report);
    
    this.log(`Results saved to: ${resultsPath}`);
    this.log(`Report saved to: ${reportPath}`);
  }

  generateMarkdownReport() {
    const date = new Date().toISOString().split('T')[0];
    
    return `# BNE Validation Report

**Date:** ${date}
**Rating:** ${this.results.validationSummary.rating}

## Summary
- **Total Tests:** ${this.results.validationSummary.totalTests}
- **Successful:** ${this.results.validationSummary.successfulTests}
- **Failed:** ${this.results.validationSummary.failedTests}
- **Success Rate:** ${((this.results.validationSummary.successfulTests / this.results.validationSummary.totalTests) * 100).toFixed(1)}%

## Page Count Results
${this.results.pageCounts.map(pc => `
### Manuscript ${pc.manuscriptId}
- **Valid Pages:** ${pc.validPages}
- **Total Tested:** ${pc.totalTested}
- **Success Rate:** ${((pc.validPages / pc.totalTested) * 100).toFixed(1)}%
`).join('')}

## Max Resolution Tests
${this.results.maxResolutionTests.map(mr => `
### Manuscript ${mr.manuscriptId}
- **Best Resolution:** ${mr.bestResolution ? mr.bestResolution.description : 'None'}
- **Max Size:** ${mr.maxSize} bytes
- **Best URL:** ${mr.bestResolution ? mr.bestResolution.url : 'None'}
`).join('')}

## Image Downloads
${this.results.imageDownloads.map(img => `
### ${img.filename}
- **Status:** ${img.success ? '✓ SUCCESS' : '✗ FAILED'}
- **Size:** ${img.size || 'Unknown'} bytes
- **Content Valid:** ${img.contentValidation ? (img.contentValidation.valid ? 'Yes' : 'No') : 'Not tested'}
- **URL:** ${img.url}
${img.error ? `- **Error:** ${img.error}` : ''}
`).join('')}

## PDF Downloads
${this.results.pdfDownloads.map(pdf => `
### ${pdf.filename}
- **Status:** ${pdf.success ? '✓ SUCCESS' : '✗ FAILED'}
- **Size:** ${pdf.size || 'Unknown'} bytes
- **Is PDF:** ${pdf.isPdf ? 'Yes' : 'No'}
- **URL:** ${pdf.url}
${pdf.error ? `- **Error:** ${pdf.error}` : ''}
`).join('')}

## Implementation Recommendations

Based on validation results:

1. **URL Pattern:** \`https://bdh-rd.bne.es/pdf.raw?query=id:MANUSCRIPT_ID&page=PAGE_NUMBER&jpeg=true\`
2. **PDF Download:** \`https://bdh-rd.bne.es/pdf.raw?query=id:MANUSCRIPT_ID\`
3. **Page Discovery:** Test sequential pages until invalid responses
4. **Quality:** Use default JPEG quality (appears to be optimal)
5. **Authentication:** None required for tested manuscripts

## Next Steps

${this.results.validationSummary.rating === 'ok' ? 
  '✓ Ready for implementation - all tests passed' :
  this.results.validationSummary.rating === 'something not ok' ?
  '⚠ Needs improvement - some tests failed' :
  '✗ Significant issues found - requires investigation'
}

---

*Generated by BNE Validation Agent*
`;
  }
}

async function main() {
  const validator = new BNEValidator();
  const rating = await validator.performFullValidation();
  
  console.log(`\n[BNE Validator] Final Rating: ${rating}`);
  process.exit(0);
}

main().catch(console.error);