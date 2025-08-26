// Download actual Bordeaux image variants to compare quality
const https = require('https');
const fs = require('fs');
const path = require('path');

const variants = [
  {
    name: 'thumb_1024',
    url: 'https://selene.bordeaux.fr/thumb/1024/330636101_MS_0778/330636101_MS_0778_0001.jpg'
  },
  {
    name: 'thumb_full', 
    url: 'https://selene.bordeaux.fr/thumb/full/330636101_MS_0778/330636101_MS_0778_0001.jpg'
  },
  {
    name: 'viewer',
    url: 'https://selene.bordeaux.fr/viewer/330636101_MS_0778/330636101_MS_0778_0001.jpg'
  }
];

const outputDir = '/Users/evb/WebstormProjects/mss-downloader/.devkit/bordeaux-samples';

// Create output directory
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function downloadFile(url, filename) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(path.join(outputDir, filename));
    
    const req = https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        const stats = fs.statSync(path.join(outputDir, filename));
        console.log(`Downloaded ${filename}: ${Math.round(stats.size / 1024)}KB`);
        resolve(stats.size);
      });
    });
    
    req.on('error', (err) => {
      fs.unlink(path.join(outputDir, filename), () => {});
      reject(err);
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function downloadAll() {
  console.log(`Downloading Bordeaux image variants to: ${outputDir}`);
  
  for (const variant of variants) {
    try {
      const filename = `page1_${variant.name}.jpg`;
      await downloadFile(variant.url, filename);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
    } catch (err) {
      console.log(`Failed to download ${variant.name}: ${err.message}`);
    }
  }
  
  console.log(`\nAll downloads completed. Check files in: ${outputDir}`);
  console.log('Compare image sizes and quality to determine which is high-resolution.');
}

downloadAll();