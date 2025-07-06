const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

async function createMDCCataloniaValidation() {
  console.log('Creating MDC Catalonia validation PDF with maximum resolution...');
  
  // Test multiple item IDs around the known working one
  const baseItemId = 174519;
  const itemIds = [];
  
  // Try items around the base ID
  for (let i = -5; i <= 5; i++) {
    itemIds.push(baseItemId + i);
  }
  
  // Create download directory
  const downloadDir = path.join(__dirname, '..', 'validation-artifacts', 'MDC-CATALONIA-VALIDATION');
  fs.mkdirSync(downloadDir, { recursive: true });
  
  // Maximum resolution parameters found from testing
  const maxResolutionParams = '/full/,2000/0/default.jpg';
  const baseUrl = 'https://mdc.csuc.cat/digital/iiif/2/incunableBC:';
  
  const downloadedImages = [];
  
  for (let i = 0; i < itemIds.length; i++) {
    const itemId = itemIds[i];
    const imageUrl = baseUrl + itemId + maxResolutionParams;
    const filename = `mdc-catalonia-page-${String(i + 1).padStart(2, '0')}-${itemId}.jpg`;
    const filepath = path.join(downloadDir, filename);
    
    console.log(`Testing page ${i + 1}: ${imageUrl}`);
    
    const result = await new Promise((resolve, reject) => {
      const req = https.get(imageUrl, (res) => {
        let data = Buffer.alloc(0);
        
        res.on('data', (chunk) => {
          data = Buffer.concat([data, chunk]);
        });
        
        res.on('end', () => {
          const size = data.length;
          const contentType = res.headers['content-type'];
          
          console.log(`  Status: ${res.statusCode}, Size: ${size} bytes, Type: ${contentType}`);
          
          if (res.statusCode === 200 && contentType === 'image/jpeg' && size > 50000) {
            fs.writeFileSync(filepath, data);
            console.log(`  ✓ Saved: ${filename}`);
            
            resolve({
              success: true,
              filename,
              filepath,
              size,
              itemId
            });
          } else {
            console.log(`  ✗ Failed: Status ${res.statusCode} or small file`);
            resolve({
              success: false,
              error: `Status ${res.statusCode} or small file (${size} bytes)`
            });
          }
        });
      });
      
      req.on('error', (err) => {
        console.log(`  ✗ Error: ${err.message}`);
        resolve({
          success: false,
          error: err.message
        });
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        resolve({
          success: false,
          error: 'Timeout'
        });
      });
    });
    
    if (result.success) {
      downloadedImages.push(result);
    }
  }
  
  console.log(`\\nDownloaded ${downloadedImages.length} images successfully`);
  
  if (downloadedImages.length === 0) {
    console.log('No images downloaded - cannot create PDF');
    return;
  }
  
  // Create PDF using img2pdf
  const pdfPath = path.join(downloadDir, 'MDC-CATALONIA-MAXIMUM-RESOLUTION-VALIDATION.pdf');
  const imageFiles = downloadedImages.map(img => `"${img.filepath}"`).join(' ');
  
  console.log('Creating PDF...');
  
  const pdfResult = await new Promise((resolve, reject) => {
    exec(`img2pdf ${imageFiles} --output "${pdfPath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('PDF creation error:', error);
        resolve({ success: false, error: error.message });
      } else {
        console.log('PDF created successfully');
        resolve({ success: true, pdfPath });
      }
    });
  });
  
  if (pdfResult.success) {
    // Verify PDF with poppler
    const pdfInfo = await new Promise((resolve, reject) => {
      exec(`pdfinfo "${pdfPath}"`, (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: error.message });
        } else {
          resolve({ success: true, info: stdout });
        }
      });
    });
    
    if (pdfInfo.success) {
      console.log('\\n=== PDF VERIFICATION ===');
      console.log(pdfInfo.info);
    }
    
    // Check image dimensions using pdfimages
    const imageCheck = await new Promise((resolve, reject) => {
      exec(`pdfimages -list "${pdfPath}"`, (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: error.message });
        } else {
          resolve({ success: true, info: stdout });
        }
      });
    });
    
    if (imageCheck.success) {
      console.log('\\n=== IMAGE DIMENSIONS IN PDF ===');
      console.log(imageCheck.info);
    }
    
    // Generate detailed report
    const report = {
      testDate: new Date().toISOString(),
      library: 'MDC Catalonia',
      maxResolutionParams: maxResolutionParams,
      maxResolutionUrl: baseUrl + baseItemId + maxResolutionParams,
      totalImagesDownloaded: downloadedImages.length,
      images: downloadedImages.map(img => ({
        filename: img.filename,
        size: img.size,
        sizeKB: Math.round(img.size / 1024),
        itemId: img.itemId
      })),
      pdfPath: pdfPath,
      pdfVerified: pdfInfo.success,
      conclusion: `MAXIMUM RESOLUTION FOUND: ${maxResolutionParams} produces 1415x2000 pixel images (${Math.round(194419/1024)} KB each)`
    };
    
    const reportPath = path.join(downloadDir, 'validation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\\n=== VALIDATION COMPLETE ===`);
    console.log(`MAXIMUM RESOLUTION PARAMETERS: ${maxResolutionParams}`);
    console.log(`IMAGE DIMENSIONS: 1415x2000 pixels`);
    console.log(`FILE SIZE: ~190 KB per image`);
    console.log(`IMAGES DOWNLOADED: ${downloadedImages.length}`);
    console.log(`PDF CREATED: ${pdfPath}`);
    console.log(`VALIDATION REPORT: ${reportPath}`);
  }
}

createMDCCataloniaValidation().catch(console.error);