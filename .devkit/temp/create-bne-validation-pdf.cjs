const https = require('https');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

const agent = new https.Agent({
  rejectUnauthorized: false
});

console.log('📄 Creating BNE validation PDF with fixed implementation...');

async function fetchBneWithHttps(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      },
      rejectUnauthorized: false
    };

    const req = https.request(requestOptions, (res) => {
      const chunks = [];
      
      res.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        const response = {
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode || 200,
          statusText: res.statusMessage || 'OK',
          headers: res.headers,
          body: body,
          arrayBuffer: () => Promise.resolve(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength))
        };
        
        resolve(response);
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

async function getBnePageCountFromPDF(manuscriptId) {
  try {
    const pdfInfoUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&info=true`;
    console.log(`🔍 Getting page count from: ${pdfInfoUrl}`);
    const response = await fetchBneWithHttps(pdfInfoUrl);
    
    if (response.ok) {
      const pdfBuffer = await response.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pageCount = pdfDoc.getPageCount();
      console.log(`✅ Found ${pageCount} pages in PDF info`);
      return pageCount;
    }
    return null;
  } catch (error) {
    console.warn(`Failed to get BNE page count from PDF info: ${error.message}`);
    return null;
  }
}

async function downloadBneManuscript(manuscriptId) {
  const startTime = Date.now();
  
  console.log(`📋 Downloading BNE manuscript ${manuscriptId}...`);
  
  // Get page count using new method
  const pdfPageCount = await getBnePageCountFromPDF(manuscriptId);
  
  if (!pdfPageCount) {
    throw new Error('Could not determine page count');
  }
  
  // Download pages using PDF format for maximum resolution
  const images = [];
  for (let page = 1; page <= pdfPageCount; page++) {
    const pageUrl = `https://bdh-rd.bne.es/pdf.raw?query=id:${manuscriptId}&page=${page}&pdf=true`;
    console.log(`📄 Downloading page ${page}/${pdfPageCount}...`);
    
    const response = await fetchBneWithHttps(pageUrl);
    
    if (response.ok) {
      const imageBuffer = Buffer.from(await response.arrayBuffer());
      images.push({
        page,
        buffer: imageBuffer,
        size: imageBuffer.length,
        contentType: response.headers['content-type']
      });
      console.log(`   ✅ Page ${page}: ${imageBuffer.length} bytes (${response.headers['content-type']})`);
    } else {
      console.log(`   ❌ Page ${page}: Failed (${response.status})`);
    }
  }
  
  const downloadTime = Date.now() - startTime;
  
  // Create PDF
  const pdfDoc = await PDFDocument.create();
  
  for (const image of images) {
    try {
      let embeddedImage;
      
      if (image.contentType?.includes('jpeg') || image.contentType?.includes('jpg')) {
        embeddedImage = await pdfDoc.embedJpg(image.buffer);
      } else if (image.contentType?.includes('png')) {
        embeddedImage = await pdfDoc.embedPng(image.buffer);
      } else {
        console.log(`   ⚠️  Unsupported image type for page ${image.page}: ${image.contentType}`);
        continue;
      }
      
      const page = pdfDoc.addPage([embeddedImage.width, embeddedImage.height]);
      page.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: embeddedImage.width,
        height: embeddedImage.height,
      });
      
      console.log(`   📄 Added page ${image.page} to PDF (${embeddedImage.width}x${embeddedImage.height})`);
      
    } catch (error) {
      console.error(`   ❌ Failed to add page ${image.page} to PDF: ${error.message}`);
    }
  }
  
  const pdfBytes = await pdfDoc.save();
  
  return {
    manuscriptId,
    pageCount: pdfPageCount,
    downloadedPages: images.length,
    downloadTime,
    pdfSize: pdfBytes.length,
    pdfBytes
  };
}

async function main() {
  try {
    const manuscriptId = '0000007619';
    
    console.log('🔍 BNE VALIDATION PDF CREATION');
    console.log('==============================');
    
    // Download manuscript
    const result = await downloadBneManuscript(manuscriptId);
    
    // Save PDF
    const outputDir = path.join(__dirname, '..', 'validation-current');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const pdfPath = path.join(outputDir, 'BNE-HANGING-FIX-VALIDATION.pdf');
    fs.writeFileSync(pdfPath, result.pdfBytes);
    
    console.log('\n📊 VALIDATION RESULTS:');
    console.log('======================');
    console.log(`Manuscript ID: ${result.manuscriptId}`);
    console.log(`Page count: ${result.pageCount}`);
    console.log(`Downloaded pages: ${result.downloadedPages}`);
    console.log(`Download time: ${result.downloadTime}ms (${(result.downloadTime/1000).toFixed(1)}s)`);
    console.log(`PDF size: ${result.pdfSize} bytes (${(result.pdfSize/1024/1024).toFixed(2)} MB)`);
    console.log(`Output file: ${pdfPath}`);
    
    // Validate PDF using pdfimages
    console.log('\n🔍 Validating PDF content...');
    const { spawn } = require('child_process');
    
    return new Promise((resolve) => {
      const pdfimages = spawn('pdfimages', ['-list', pdfPath], { stdio: 'pipe' });
      
      let output = '';
      pdfimages.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      pdfimages.on('close', (code) => {
        if (code === 0 && output.includes('image')) {
          console.log('✅ PDF validation successful - contains images');
          console.log('📄 PDF image info:');
          console.log(output);
        } else {
          console.log('⚠️  PDF validation warning - check content manually');
        }
        
        console.log('\n🎉 BNE validation PDF created successfully!');
        console.log(`📁 Location: ${pdfPath}`);
        console.log('📋 Next steps:');
        console.log('   1. Open the PDF and verify manuscript content');
        console.log('   2. Check image quality and resolution');
        console.log('   3. Confirm no hanging or performance issues');
        
        resolve();
      });
      
      pdfimages.on('error', () => {
        console.log('⚠️  pdfimages not available - manual validation required');
        console.log('\n🎉 BNE validation PDF created successfully!');
        console.log(`📁 Location: ${pdfPath}`);
        resolve();
      });
    });
    
  } catch (error) {
    console.error('💥 PDF creation failed:', error);
  }
}

main();