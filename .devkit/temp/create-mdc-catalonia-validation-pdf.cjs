const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

async function createMDCCataloniaValidationPDF() {
  console.log('Creating MDC Catalonia validation PDF with maximum resolution...');
  
  // First get the manifest to understand available pages
  const manifestUrl = 'https://mdc.csuc.cat/digital/api/singleitem/collection/incunableBC/id/174519';
  
  try {
    const manifestResponse = await new Promise((resolve, reject) => {
      https.get(manifestUrl, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ data, statusCode: res.statusCode }));
      }).on('error', reject);
    });
    
    if (manifestResponse.statusCode !== 200) {
      throw new Error(`Failed to get manifest: ${manifestResponse.statusCode}`);
    }
    
    const manifest = JSON.parse(manifestResponse.data);
    console.log('Manifest loaded successfully');
    
    // Get the parent collection to find more pages
    const parentId = manifest.parentId;
    console.log('Parent collection ID:', parentId);
    
    // Try to get collection pages
    const collectionUrl = `https://mdc.csuc.cat/digital/api/collection/${parentId}`;
    console.log('Fetching collection:', collectionUrl);
    
    const collectionResponse = await new Promise((resolve, reject) => {
      https.get(collectionUrl, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ data, statusCode: res.statusCode }));
      }).on('error', reject);
    });
    
    let itemIds = [];
    if (collectionResponse.statusCode === 200) {
      const collection = JSON.parse(collectionResponse.data);
      console.log('Collection loaded successfully');
      
      if (collection.items && Array.isArray(collection.items)) {
        itemIds = collection.items.slice(0, 10).map(item => item.id); // Get first 10 items
        console.log(`Found ${itemIds.length} items in collection`);
      }
    }
    
    // If we couldn't get collection items, use the single item
    if (itemIds.length === 0) {
      itemIds = ['174519'];
      console.log('Using single item ID as fallback');
    }
    
    // Create download directory
    const downloadDir = path.join(__dirname, '..', 'validation-artifacts', 'MDC-CATALONIA-VALIDATION');
    fs.mkdirSync(downloadDir, { recursive: true });
    
    // Download images using maximum resolution parameters
    const maxResolutionParams = '/full/,2000/0/default.jpg';
    const baseUrl = 'https://mdc.csuc.cat/digital/iiif/2/incunableBC:';
    
    const downloadedImages = [];
    
    for (let i = 0; i < Math.min(itemIds.length, 10); i++) {
      const itemId = itemIds[i];
      const imageUrl = baseUrl + itemId + maxResolutionParams;
      const filename = `mdc-catalonia-page-${String(i + 1).padStart(2, '0')}-${itemId}.jpg`;
      const filepath = path.join(downloadDir, filename);
      
      console.log(`Downloading page ${i + 1}: ${imageUrl}`);
      
      const result = await new Promise((resolve, reject) => {
        https.get(imageUrl, (res) => {
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
        }).on('error', (err) => {
          console.log(`  ✗ Error: ${err.message}`);
          resolve({
            success: false,
            error: err.message
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
    const imageFiles = downloadedImages.map(img => img.filepath).join(' ');
    
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
      
      // Generate detailed report
      const report = {
        testDate: new Date().toISOString(),
        library: 'MDC Catalonia',
        maxResolutionParams: maxResolutionParams,
        totalImagesDownloaded: downloadedImages.length,
        images: downloadedImages.map(img => ({
          filename: img.filename,
          size: img.size,
          itemId: img.itemId
        })),
        pdfPath: pdfPath,
        pdfVerified: pdfInfo.success
      };
      
      const reportPath = path.join(downloadDir, 'validation-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      
      console.log(`\\n=== VALIDATION COMPLETE ===`);
      console.log(`MAXIMUM RESOLUTION PARAMETERS: ${maxResolutionParams}`);
      console.log(`IMAGES DOWNLOADED: ${downloadedImages.length}`);
      console.log(`PDF CREATED: ${pdfPath}`);
      console.log(`VALIDATION REPORT: ${reportPath}`);
    }
    
  } catch (error) {
    console.error('Error during validation:', error);
  }
}

createMDCCataloniaValidationPDF().catch(console.error);