#!/usr/bin/env node

/**
 * BNE (Biblioteca Nacional de España) Analysis Script
 * Analyzes the BNE library to understand implementation patterns
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Test URLs provided
const testUrls = [
  'https://bdh-rd.bne.es/viewer.vm?id=0000007619&page=1',
  'https://bdh-rd.bne.es/viewer.vm?id=0000060229&page=1',
  'https://bdh-rd.bne.es/viewer.vm?id=0000015300&page=1',
  'https://bdh-rd.bne.es/viewer.vm?id=0000040654&page=1',
  'https://bdh-rd.bne.es/viewer.vm?id=0000115597&page=1',
  'https://bdh-rd.bne.es/viewer.vm?id=0000005030&page=1'
];

const reportPath = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/bne-analysis-report.md';
const dataPath = '/Users/e.barsky/Desktop/Personal/Electron/mss-downloader/.devkit/reports/bne-analysis-data.json';

class BNEAnalyzer {
  constructor() {
    this.results = {
      urlAnalysis: [],
      viewerType: '',
      manifestDiscovery: [],
      imageAccessPatterns: [],
      maxResolutionTests: [],
      authenticationTests: [],
      recommendations: [],
      implementation: {
        complexity: '',
        estimated_effort: '',
        key_challenges: []
      }
    };
  }

  log(message) {
    console.log(`[BNE Analysis] ${message}`);
  }

  async analyzeUrl(url) {
    this.log(`Analyzing URL: ${url}`);
    
    try {
      // Extract manuscript ID from URL
      const idMatch = url.match(/id=(\d+)/);
      const manuscriptId = idMatch ? idMatch[1] : null;
      
      if (!manuscriptId) {
        this.log(`Could not extract manuscript ID from URL: ${url}`);
        return null;
      }

      // Fetch the viewer page
      const response = await this.fetchPage(url);
      const analysis = {
        url: url,
        manuscriptId: manuscriptId,
        pageContent: response.substring(0, 5000), // First 5k chars
        viewerDetection: this.detectViewerType(response),
        manifestUrls: this.extractManifestUrls(response),
        imagePatterns: this.extractImagePatterns(response),
        jsIncludes: this.extractJavaScriptIncludes(response)
      };

      this.results.urlAnalysis.push(analysis);
      return analysis;
    } catch (error) {
      this.log(`Error analyzing URL ${url}: ${error.message}`);
      return { url, error: error.message };
    }
  }

  async fetchPage(url) {
    try {
      const curlCommand = `curl -s -L -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" "${url}"`;
      const response = execSync(curlCommand, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 });
      return response;
    } catch (error) {
      throw new Error(`Failed to fetch ${url}: ${error.message}`);
    }
  }

  detectViewerType(content) {
    const patterns = {
      iiif: /iiif/i,
      mirador: /mirador/i,
      leaflet: /leaflet/i,
      openlayers: /openlayers/i,
      zoomify: /zoomify/i,
      custom: /bdh-rd\.bne\.es/i
    };

    const detected = [];
    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(content)) {
        detected.push(type);
      }
    }

    return detected.length > 0 ? detected : ['unknown'];
  }

  extractManifestUrls(content) {
    const patterns = [
      /https?:\/\/[^"'\s]+\.json/g,
      /https?:\/\/[^"'\s]+manifest[^"'\s]*/g,
      /https?:\/\/bdh-rd\.bne\.es[^"'\s]+/g
    ];

    const urls = new Set();
    for (const pattern of patterns) {
      const matches = content.match(pattern) || [];
      matches.forEach(url => urls.add(url));
    }

    return Array.from(urls);
  }

  extractImagePatterns(content) {
    const patterns = [
      /https?:\/\/[^"'\s]+\.jpg/gi,
      /https?:\/\/[^"'\s]+\.jpeg/gi,
      /https?:\/\/[^"'\s]+\.png/gi,
      /https?:\/\/[^"'\s]+\.tiff?/gi,
      /https?:\/\/bdh-rd\.bne\.es[^"'\s]+image[^"'\s]*/gi
    ];

    const images = new Set();
    for (const pattern of patterns) {
      const matches = content.match(pattern) || [];
      matches.forEach(img => images.add(img));
    }

    return Array.from(images);
  }

  extractJavaScriptIncludes(content) {
    const scriptPattern = /<script[^>]*src=["']([^"']+)["'][^>]*>/gi;
    const scripts = [];
    let match;
    
    while ((match = scriptPattern.exec(content)) !== null) {
      scripts.push(match[1]);
    }

    return scripts;
  }

  async testMaxResolution(manuscriptId) {
    this.log(`Testing maximum resolution for manuscript ${manuscriptId}`);
    
    const resolutionTests = [
      'full/full',
      'full/max',
      'full/2000',
      'full/4000',
      'full/1200',
      'full/800'
    ];

    const results = [];
    for (const res of resolutionTests) {
      try {
        const testUrl = `https://bdh-rd.bne.es/ImageProxy?id=${manuscriptId}&page=1&size=${res}`;
        const response = await this.testImageUrl(testUrl);
        results.push({
          resolution: res,
          url: testUrl,
          success: response.success,
          size: response.size,
          contentType: response.contentType
        });
      } catch (error) {
        results.push({
          resolution: res,
          error: error.message
        });
      }
    }

    this.results.maxResolutionTests.push({
      manuscriptId,
      tests: results
    });

    return results;
  }

  async testImageUrl(url) {
    try {
      const curlCommand = `curl -s -I -L -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" "${url}"`;
      const headers = execSync(curlCommand, { encoding: 'utf8' });
      
      const statusMatch = headers.match(/HTTP\/[\d.]+\s+(\d+)/);
      const status = statusMatch ? parseInt(statusMatch[1]) : 0;
      
      const contentLengthMatch = headers.match(/content-length:\s*(\d+)/i);
      const contentLength = contentLengthMatch ? parseInt(contentLengthMatch[1]) : 0;
      
      const contentTypeMatch = headers.match(/content-type:\s*([^\r\n]+)/i);
      const contentType = contentTypeMatch ? contentTypeMatch[1].trim() : '';

      return {
        success: status === 200,
        size: contentLength,
        contentType: contentType,
        status: status
      };
    } catch (error) {
      throw new Error(`Failed to test image URL ${url}: ${error.message}`);
    }
  }

  async performFullAnalysis() {
    this.log('Starting comprehensive BNE analysis...');

    // Analyze all test URLs
    for (const url of testUrls) {
      await this.analyzeUrl(url);
    }

    // Test maximum resolution for a few manuscripts
    const testIds = ['0000007619', '0000060229', '0000015300'];
    for (const id of testIds) {
      await this.testMaxResolution(id);
    }

    // Generate recommendations
    this.generateRecommendations();

    // Save results
    await this.saveResults();

    this.log('Analysis complete!');
  }

  generateRecommendations() {
    this.log('Generating implementation recommendations...');

    // Analyze viewer type
    const viewerTypes = new Set();
    this.results.urlAnalysis.forEach(analysis => {
      if (analysis.viewerDetection) {
        analysis.viewerDetection.forEach(type => viewerTypes.add(type));
      }
    });

    this.results.viewerType = Array.from(viewerTypes).join(', ');

    // Generate recommendations based on findings
    this.results.recommendations = [
      'URL Pattern: https://bdh-rd.bne.es/viewer.vm?id=MANUSCRIPT_ID&page=PAGE_NUMBER',
      'Manuscript ID extraction: Extract from id parameter in URL',
      'Page discovery: Need to determine total pages through API or page navigation',
      'Image access: Test different image proxy endpoints for optimal resolution',
      'Authentication: Test if authentication is required for image access'
    ];

    // Implementation complexity assessment
    const hasIIIF = this.results.urlAnalysis.some(analysis => 
      analysis.viewerDetection && analysis.viewerDetection.includes('iiif')
    );

    this.results.implementation.complexity = hasIIIF ? 'Medium' : 'High';
    this.results.implementation.estimated_effort = hasIIIF ? '2-3 hours' : '4-6 hours';
    this.results.implementation.key_challenges = [
      'Determine image endpoint patterns',
      'Implement page count discovery',
      'Test maximum resolution options',
      'Handle authentication if required'
    ];
  }

  async saveResults() {
    this.log('Saving analysis results...');

    // Save JSON data
    fs.writeFileSync(dataPath, JSON.stringify(this.results, null, 2));

    // Generate markdown report
    const report = this.generateMarkdownReport();
    fs.writeFileSync(reportPath, report);

    this.log(`Results saved to: ${reportPath}`);
    this.log(`Data saved to: ${dataPath}`);
  }

  generateMarkdownReport() {
    const date = new Date().toISOString().split('T')[0];
    
    return `# BNE (Biblioteca Nacional de España) Library Analysis Report

**Date:** ${date}
**Analyzer:** Claude Code BNE Analysis Agent

## Executive Summary

- **Library:** Biblioteca Nacional de España (BNE)
- **Base URL:** https://bdh-rd.bne.es/
- **Viewer Type:** ${this.results.viewerType}
- **Implementation Complexity:** ${this.results.implementation.complexity}
- **Estimated Effort:** ${this.results.implementation.estimated_effort}

## URL Analysis Results

${this.results.urlAnalysis.map(analysis => `
### Manuscript ID: ${analysis.manuscriptId}
- **URL:** ${analysis.url}
- **Viewer Detection:** ${analysis.viewerDetection ? analysis.viewerDetection.join(', ') : 'None'}
- **Manifest URLs Found:** ${analysis.manifestUrls ? analysis.manifestUrls.length : 0}
- **Image Patterns Found:** ${analysis.imagePatterns ? analysis.imagePatterns.length : 0}
- **JavaScript Includes:** ${analysis.jsIncludes ? analysis.jsIncludes.length : 0}
`).join('\n')}

## Maximum Resolution Testing

${this.results.maxResolutionTests.map(test => `
### Manuscript ${test.manuscriptId}
${test.tests.map(t => `
- **Resolution:** ${t.resolution}
- **Success:** ${t.success ? 'Yes' : 'No'}
- **Size:** ${t.size ? `${t.size} bytes` : 'Unknown'}
- **Content Type:** ${t.contentType || 'Unknown'}
- **URL:** ${t.url}
`).join('\n')}
`).join('\n')}

## Implementation Recommendations

${this.results.recommendations.map(rec => `- ${rec}`).join('\n')}

## Key Challenges

${this.results.implementation.key_challenges.map(challenge => `- ${challenge}`).join('\n')}

## Technical Details

### Detected Viewer Technologies
${Array.from(new Set(this.results.urlAnalysis.flatMap(a => a.viewerDetection || []))).map(tech => `- ${tech}`).join('\n')}

### Sample Manifest URLs
${Array.from(new Set(this.results.urlAnalysis.flatMap(a => a.manifestUrls || []))).slice(0, 5).map(url => `- ${url}`).join('\n')}

### Sample Image Patterns
${Array.from(new Set(this.results.urlAnalysis.flatMap(a => a.imagePatterns || []))).slice(0, 5).map(pattern => `- ${pattern}`).join('\n')}

## Next Steps

1. **Implement URL Pattern Recognition:** Create regex patterns for BNE URL detection
2. **Develop Image Endpoint Discovery:** Test various image proxy endpoints
3. **Create Page Count Detection:** Implement method to determine total pages
4. **Build Download Logic:** Create download service for BNE manuscripts
5. **Implement Maximum Resolution Testing:** Ensure highest quality downloads
6. **Add Authentication Handling:** If required for image access

## Validation Protocol

When implementing BNE support, ensure:
- [ ] URL pattern recognition works correctly
- [ ] Manuscript ID extraction is accurate
- [ ] Page count detection functions properly
- [ ] Maximum resolution is identified and used
- [ ] All downloaded images are valid manuscript pages
- [ ] PDF generation works correctly
- [ ] Authentication handling (if required) functions properly

---

*Generated by Claude Code BNE Analysis Agent*
`;
  }
}

// Execute analysis
async function main() {
  const analyzer = new BNEAnalyzer();
  await analyzer.performFullAnalysis();
}

main().catch(console.error);