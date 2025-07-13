const { app, BrowserWindow } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('disable-web-security');
app.commandLine.appendSwitch('allow-running-insecure-content');

async function testPdfRenderer() {
  console.log('🧪 Testing PDF renderer in Electron environment...');
  
  await app.whenReady();
  
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });

  // Load a simple HTML page that will run our test
  const testHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>PDF Renderer Test</title>
    </head>
    <body>
      <h1>PDF Renderer Test</h1>
      <script type="module">
        console.log('🖼️ Testing PDF rendering...');
        
        const testPdfPath = '${path.join(__dirname, 'test-for-images.pdf')}';
        const outputDir = '${path.join(__dirname, 'pdf-images-output')}';
        
        console.log('📄 PDF path:', testPdfPath);
        console.log('📁 Output dir:', outputDir);
        
        try {
          // Import PDF.js
          const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.mjs');
          
          console.log('✅ PDF.js loaded');
          
          // Load PDF file
          const response = await fetch('file://' + testPdfPath);
          const pdfArrayBuffer = await response.arrayBuffer();
          
          console.log('📄 PDF file loaded:', pdfArrayBuffer.byteLength, 'bytes');
          
          // Load PDF document
          const loadingTask = pdfjsLib.getDocument({ data: pdfArrayBuffer });
          const pdfDocument = await loadingTask.promise;
          
          console.log('📄 PDF document loaded -', pdfDocument.numPages, 'pages');
          
          // Render first page
          const page = await pdfDocument.getPage(1);
          const viewport = page.getViewport({ scale: 2.0 });
          
          console.log('📐 Page viewport:', viewport.width, 'x', viewport.height);
          
          // Create canvas
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          
          if (!context) {
            throw new Error('Failed to get 2D context');
          }
          
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          
          console.log('🖼️ Canvas created:', canvas.width, 'x', canvas.height);
          
          // Render PDF page to canvas
          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;
          
          console.log('✅ PDF page rendered to canvas');
          
          // Check if canvas has content (not all black/white)
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const pixels = imageData.data;
          
          let nonWhitePixels = 0;
          let nonBlackPixels = 0;
          
          for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            
            if (!(r === 255 && g === 255 && b === 255)) {
              nonWhitePixels++;
            }
            if (!(r === 0 && g === 0 && b === 0)) {
              nonBlackPixels++;
            }
          }
          
          console.log('🎨 Canvas analysis:');
          console.log('   Total pixels:', pixels.length / 4);
          console.log('   Non-white pixels:', nonWhitePixels);
          console.log('   Non-black pixels:', nonBlackPixels);
          
          if (nonWhitePixels > 100 && nonBlackPixels > 100) {
            console.log('✅ SUCCESS: Canvas contains real content!');
          } else {
            console.log('❌ WARNING: Canvas appears to be mostly empty');
          }
          
          // Convert to blob
          const blob = await new Promise((resolve) => {
            canvas.toBlob(resolve, 'image/png');
          });
          
          console.log('📄 Canvas converted to blob:', blob.size, 'bytes');
          
          if (blob.size > 1000) {
            console.log('✅ SUCCESS: Generated meaningful image data');
          } else {
            console.log('❌ WARNING: Image data is very small');
          }
          
          console.log('🎉 PDF rendering test completed successfully!');
          
        } catch (error) {
          console.error('❌ PDF rendering test failed:', error);
        }
        
        // Exit after test
        setTimeout(() => {
          require('electron').remote?.getCurrentWindow()?.close();
        }, 1000);
      </script>
    </body>
    </html>
  `;

  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(testHtml));
  
  win.webContents.on('console-message', (event, level, message) => {
    console.log(`[RENDERER] ${message}`);
  });

  win.on('closed', () => {
    app.quit();
  });
}

testPdfRenderer().catch(console.error);