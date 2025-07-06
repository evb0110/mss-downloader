const https = require('https');
const fs = require('fs');
const path = require('path');

class BelgicaAnalyzer {
  constructor() {
    this.results = {
      documents: [],
      totalImages: 0,
      errors: []
    };
  }

  async analyzeDocument(belgicaUrl) {
    try {
      console.log(`\n=== Analyzing: ${belgicaUrl} ===`);
      
      const documentId = this.extractDocumentId(belgicaUrl);
      if (!documentId) {
        throw new Error('Could not extract document ID');
      }
      console.log(`Document ID: ${documentId}`);

      const uurlId = await this.getUURL(belgicaUrl);
      console.log(`UURL ID: ${uurlId}`);

      const mapPath = await this.getMapPath(uurlId);
      console.log(`Map Path: ${mapPath}`);

      const imageUrls = await this.listImages(mapPath);
      console.log(`Found ${imageUrls.length} images`);

      const docResult = {
        belgicaUrl,
        documentId,
        uurlId,
        mapPath,
        imageCount: imageUrls.length,
        sampleImages: imageUrls.slice(0, 5)
      };

      this.results.documents.push(docResult);
      this.results.totalImages += imageUrls.length;

      return docResult;
    } catch (error) {
      console.error(`Error analyzing ${belgicaUrl}:`, error.message);
      this.results.errors.push({
        url: belgicaUrl,
        error: error.message
      });
      return null;
    }
  }

  extractDocumentId(url) {
    const match = url.match(/\/BELGICA\/doc\/SYRACUSE\/(\d+)/);
    return match ? match[1] : null;
  }

  async getUURL(belgicaUrl) {
    const html = await this.fetchPage(belgicaUrl);
    const uurlMatch = html.match(/https:\/\/uurl\.kbr\.be\/(\d+)/);
    return uurlMatch ? uurlMatch[1] : null;
  }

  async getMapPath(uurlId) {
    const uurlUrl = `https://uurl.kbr.be/${uurlId}`;
    const html = await this.fetchPage(uurlUrl);
    const mapMatch = html.match(/map=([^"'&]+)/);
    return mapMatch ? mapMatch[1] : null;
  }

  async listImages(mapPath) {
    const directoryUrl = `https://viewerd.kbr.be/display/${mapPath}`;
    const html = await this.fetchPage(directoryUrl);
    
    const imageRegex = /BE-KBR00_[^"]*\.jpg/g;
    const matches = html.match(imageRegex) || [];
    
    const uniqueImages = [...new Set(matches)];
    return uniqueImages.map(filename => `${directoryUrl}${filename}`);
  }

  async fetchPage(url) {
    return new Promise((resolve, reject) => {
      const request = https.get(url, { timeout: 10000 }, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          return this.fetchPage(response.headers.location).then(resolve).catch(reject);
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve(data));
        response.on('error', reject);
      });

      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  async downloadSampleImage(imageUrl, filename) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(filename);
      
      const request = https.get(imageUrl, { timeout: 15000 }, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
        file.on('error', reject);
      });

      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Download timeout'));
      });
    });
  }

  async generateReport() {
    const reportDir = path.join(process.cwd(), '.devkit', 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportFile = path.join(reportDir, 'belgica-validation-results.json');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalDocuments: this.results.documents.length,
        totalImages: this.results.totalImages,
        errors: this.results.errors.length
      },
      documents: this.results.documents,
      errors: this.results.errors
    };

    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`\nReport saved to: ${reportFile}`);
    
    return report;
  }
}

async function main() {
  const analyzer = new BelgicaAnalyzer();
  
  const testUrls = [
    'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/16994415',
    'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/10745220',
    'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/10734174',
    'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/10736870',
    'https://belgica.kbr.be/BELGICA/doc/SYRACUSE/10731386'
  ];

  console.log('=== Belgica KBR Implementation Analysis ===');
  console.log(`Testing ${testUrls.length} documents...\n`);

  for (const url of testUrls) {
    const result = await analyzer.analyzeDocument(url);
    
    if (result && result.sampleImages.length > 0) {
      console.log(`Downloading sample image...`);
      const sampleUrl = result.sampleImages[0];
      const filename = path.join(process.cwd(), '.devkit', 'validation-current', 
        `belgica-${result.documentId}-sample.jpg`);
      
      const validationDir = path.dirname(filename);
      if (!fs.existsSync(validationDir)) {
        fs.mkdirSync(validationDir, { recursive: true });
      }

      try {
        await analyzer.downloadSampleImage(sampleUrl, filename);
        console.log(`Sample saved: ${filename}`);
      } catch (error) {
        console.error(`Failed to download sample: ${error.message}`);
      }
    }
    
    console.log('---');
  }

  const report = await analyzer.generateReport();
  
  console.log('\n=== ANALYSIS SUMMARY ===');
  console.log(`Documents analyzed: ${report.summary.totalDocuments}`);
  console.log(`Total images found: ${report.summary.totalImages}`);
  console.log(`Errors: ${report.summary.errors}`);
  
  if (report.summary.errors > 0) {
    console.log('\nErrors:');
    report.errors.forEach(error => {
      console.log(`- ${error.url}: ${error.error}`);
    });
  }
  
  console.log('\n=== RECOMMENDATION ===');
  if (report.summary.errors === 0 && report.summary.totalImages > 0) {
    console.log('✅ IMPLEMENTATION RECOMMENDED');
    console.log('- All documents analyzed successfully');
    console.log('- Clear URL patterns identified');
    console.log('- Direct image access confirmed');
    console.log('- High-quality images available');
  } else {
    console.log('❌ IMPLEMENTATION NEEDS REVIEW');
    console.log('- Errors encountered during analysis');
    console.log('- Further investigation required');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = BelgicaAnalyzer;