#!/usr/bin/env node

/**
 * BNE Deep Analysis Script
 * Deeper investigation into BNE's image serving system
 */

const fs = require('fs');
const { execSync } = require('child_process');

const testUrls = [
  'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1',
  'https://bdh-rd.bne.es/viewer.vm?id=0000060229&page=1',
  'https://bdh-rd.bne.es/viewer.vm?id=0000015300&page=1'
];

class BNEDeepAnalyzer {
  constructor() {
    this.results = {
      pageAnalysis: [],
      imageEndpoints: [],
      apiEndpoints: [],
      downloadTests: []
    };
  }

  log(message) {
    console.log(`[BNE Deep] ${message}`);
  }

  async analyzePageSource(url) {
    this.log(`Deep analyzing page source: ${url}`);
    
    try {
      const response = await this.fetchPage(url);
      
      // Look for image URLs in JavaScript variables
      const imageUrlPatterns = [
        /imageUrl\s*[:=]\s*["']([^"']+)["']/gi,
        /src\s*[:=]\s*["']([^"']+\.jpg[^"']*)["']/gi,
        /url\s*[:=]\s*["']([^"']+image[^"']*)["']/gi,
        /path\s*[:=]\s*["']([^"']+)["']/gi,
        /bdh-rd\.bne\.es[^"'\s]+/gi
      ];

      const foundUrls = new Set();
      for (const pattern of imageUrlPatterns) {
        const matches = response.match(pattern) || [];
        matches.forEach(match => foundUrls.add(match));
      }

      // Look for PDF endpoint
      const pdfPattern = /pdf\.raw\?[^"'\s]+/gi;
      const pdfMatches = response.match(pdfPattern) || [];

      // Look for API endpoints
      const apiPattern = /\/api\/[^"'\s]+/gi;
      const apiMatches = response.match(apiPattern) || [];

      // Extract manuscript ID
      const idMatch = url.match(/id=(\d+)/);
      const manuscriptId = idMatch ? idMatch[1] : null;

      const analysis = {
        url: url,
        manuscriptId: manuscriptId,
        imageUrls: Array.from(foundUrls),
        pdfEndpoints: pdfMatches,
        apiEndpoints: apiMatches,
        hasJavaScript: response.includes('<script'),
        hasAjax: response.includes('ajax') || response.includes('fetch'),
        totalLength: response.length
      };

      this.results.pageAnalysis.push(analysis);
      return analysis;
    } catch (error) {
      this.log(`Error analyzing page ${url}: ${error.message}`);
      return { url, error: error.message };
    }
  }

  async fetchPage(url) {
    const curlCommand = `curl -s -L -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" "${url}"`;
    return execSync(curlCommand, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 20 });
  }

  async testImageEndpoints(manuscriptId) {
    this.log(`Testing image endpoints for manuscript ${manuscriptId}`);
    
    const endpointTests = [
      `https://bdh-rd.bne.es/imagen.do?id=${manuscriptId}&page=1`,
      `https://bdh-rd.bne.es/image.do?id=${manuscriptId}&page=1`,
      `https://bdh-rd.bne.es/viewer/image?id=${manuscriptId}&page=1`,
      `https://bdh-rd.bne.es/images/${manuscriptId}/page1.jpg`,
      `https://bdh-rd.bne.es/images/${manuscriptId}_001.jpg`,
      `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=1&jpeg=true`,
      `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=1`,
      `https://bdh-rd.bne.es/fulltext/${manuscriptId}.pdf`,
      `https://bdh-rd.bne.es/viewer.vm?id=${manuscriptId}&page=1&format=image`,
      `https://bdh-rd.bne.es/viewer.vm?id=${manuscriptId}&page=1&type=jpeg`
    ];

    const results = [];
    for (const testUrl of endpointTests) {
      try {
        const response = await this.testEndpoint(testUrl);
        results.push({
          url: testUrl,
          status: response.status,
          contentType: response.contentType,
          size: response.size,
          isImage: response.contentType.includes('image'),
          isPdf: response.contentType.includes('pdf'),
          success: response.status === 200 && (response.contentType.includes('image') || response.contentType.includes('pdf'))
        });
      } catch (error) {
        results.push({
          url: testUrl,
          error: error.message
        });
      }
    }

    this.results.imageEndpoints.push({
      manuscriptId,
      tests: results
    });

    return results;
  }

  async testEndpoint(url) {
    const curlCommand = `curl -s -I -L -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" "${url}"`;
    const headers = execSync(curlCommand, { encoding: 'utf8' });
    
    const statusMatch = headers.match(/HTTP\/[\d.]+\s+(\d+)/);
    const status = statusMatch ? parseInt(statusMatch[1]) : 0;
    
    const contentLengthMatch = headers.match(/content-length:\s*(\d+)/i);
    const contentLength = contentLengthMatch ? parseInt(contentLengthMatch[1]) : 0;
    
    const contentTypeMatch = headers.match(/content-type:\s*([^\r\n]+)/i);
    const contentType = contentTypeMatch ? contentTypeMatch[1].trim() : '';

    return {
      status: status,
      size: contentLength,
      contentType: contentType
    };
  }

  async testPdfDownload(manuscriptId) {
    this.log(`Testing PDF download for manuscript ${manuscriptId}`);
    
    const pdfUrls = [
      `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}`,
      `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=1&jpeg=true`,
      `https://bdh-rd.bne.es/fulltext/${manuscriptId}.pdf`,
      `https://bdh-rd.bne.es/viewer.vm?id=${manuscriptId}&format=pdf`
    ];

    const results = [];
    for (const url of pdfUrls) {
      try {
        const response = await this.testEndpoint(url);
        results.push({
          url: url,
          status: response.status,
          contentType: response.contentType,
          size: response.size,
          isPdf: response.contentType.includes('pdf'),
          success: response.status === 200 && response.contentType.includes('pdf')
        });
      } catch (error) {
        results.push({
          url: url,
          error: error.message
        });
      }
    }

    return results;
  }

  async performDeepAnalysis() {
    this.log('Starting deep BNE analysis...');

    // Deep analyze page sources
    for (const url of testUrls) {
      await this.analyzePageSource(url);
    }

    // Test image endpoints
    const testIds = ['0000007619', '0000060229', '0000015300'];
    for (const id of testIds) {
      await this.testImageEndpoints(id);
      const pdfResults = await this.testPdfDownload(id);
      this.results.downloadTests.push({
        manuscriptId: id,
        pdfTests: pdfResults
      });
    }

    // Save results
    await this.saveResults();
    this.log('Deep analysis complete!');
  }

  async saveResults() {
    const reportPath = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/bne-deep-analysis.json';
    const markdownPath = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/bne-deep-analysis.md';
    
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    
    const markdown = this.generateMarkdown();
    fs.writeFileSync(markdownPath, markdown);
    
    this.log(`Results saved to: ${reportPath}`);
    this.log(`Markdown report: ${markdownPath}`);
  }

  generateMarkdown() {
    return `# BNE Deep Analysis Report

## Page Analysis Results

${this.results.pageAnalysis.map(analysis => `
### Manuscript ${analysis.manuscriptId}
- **URL:** ${analysis.url}
- **Page Size:** ${analysis.totalLength} bytes
- **Has JavaScript:** ${analysis.hasJavaScript}
- **Has AJAX:** ${analysis.hasAjax}
- **Image URLs Found:** ${analysis.imageUrls.length}
- **PDF Endpoints:** ${analysis.pdfEndpoints.length}
- **API Endpoints:** ${analysis.apiEndpoints.length}

**Sample Image URLs:**
${analysis.imageUrls.slice(0, 3).map(url => `- ${url}`).join('\n')}

**PDF Endpoints:**
${analysis.pdfEndpoints.map(url => `- ${url}`).join('\n')}
`).join('\n')}

## Image Endpoint Testing

${this.results.imageEndpoints.map(test => `
### Manuscript ${test.manuscriptId}

**Successful Endpoints:**
${test.tests.filter(t => t.success).map(t => `- ${t.url} (${t.contentType}, ${t.size} bytes)`).join('\n')}

**Failed Endpoints:**
${test.tests.filter(t => !t.success && !t.error).map(t => `- ${t.url} (Status: ${t.status})`).join('\n')}
`).join('\n')}

## PDF Download Testing

${this.results.downloadTests.map(test => `
### Manuscript ${test.manuscriptId}

**PDF Test Results:**
${test.pdfTests.map(t => `- ${t.url}: ${t.success ? 'SUCCESS' : 'FAILED'} (${t.contentType})`).join('\n')}
`).join('\n')}

## Key Findings

1. **Page Structure:** ${this.results.pageAnalysis.every(a => a.hasJavaScript) ? 'All pages use JavaScript' : 'Mixed JavaScript usage'}
2. **AJAX Usage:** ${this.results.pageAnalysis.some(a => a.hasAjax) ? 'AJAX detected' : 'No AJAX detected'}
3. **Image Endpoints:** ${this.results.imageEndpoints.flatMap(e => e.tests).filter(t => t.success).length} successful endpoints found
4. **PDF Support:** ${this.results.downloadTests.flatMap(d => d.pdfTests).some(t => t.success) ? 'PDF downloads available' : 'No PDF downloads found'}

## Implementation Strategy

Based on the analysis, the recommended approach is:
${this.results.imageEndpoints.flatMap(e => e.tests).filter(t => t.success).length > 0 ? 
  '1. Use discovered image endpoints for direct image access' : 
  '1. JavaScript-based image extraction required'}
2. ${this.results.downloadTests.flatMap(d => d.pdfTests).some(t => t.success) ? 
     'Leverage PDF download endpoints where available' : 
     'Implement page-by-page image download'}
3. Test authentication requirements for image access
4. Implement page count detection mechanism

---

*Generated by BNE Deep Analysis Agent*
`;
  }
}

async function main() {
  const analyzer = new BNEDeepAnalyzer();
  await analyzer.performDeepAnalysis();
}

main().catch(console.error);