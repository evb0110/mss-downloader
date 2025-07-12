export class PdfRendererService {
  async invertImageData(imageDataArray: Uint8Array[], outputDir: string): Promise<string[]> {
    console.log(`🔄 Inverting ${imageDataArray.length} images using Canvas API...`);
    
    const invertedFiles: string[] = [];
    
    for (let i = 0; i < imageDataArray.length; i++) {
      const imageData = imageDataArray[i];
      console.log(`   🔄 Inverting image ${i + 1}/${imageDataArray.length}`);
      
      try {
        console.log(`     📄 Processing ${imageData.length} bytes of image data`);
        
        // Create a blob from the image data
        const blob = new Blob([imageData], { type: 'image/png' });
        const imageUrl = URL.createObjectURL(blob);
        
        // Load image into an HTML Image element
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = imageUrl;
        });
        
        console.log(`     📐 Image loaded: ${img.width}x${img.height}`);
        
        // Create canvas for inversion
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Failed to get canvas 2D context');
        }
        
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw the image to canvas
        ctx.drawImage(img, 0, 0);
        
        // Get image data for pixel manipulation
        const imageDataCanvas = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageDataCanvas.data;
        
        console.log(`     🔀 Inverting ${pixels.length / 4} pixels...`);
        
        // Invert each pixel (RGB channels, keep alpha)
        for (let j = 0; j < pixels.length; j += 4) {
          pixels[j] = 255 - pixels[j];     // Red
          pixels[j + 1] = 255 - pixels[j + 1]; // Green
          pixels[j + 2] = 255 - pixels[j + 2]; // Blue
          // pixels[j + 3] stays the same (Alpha)
        }
        
        // Put the inverted data back
        ctx.putImageData(imageDataCanvas, 0, 0);
        console.log(`     ✅ Colors inverted successfully`);
        
        // Convert canvas to blob
        const invertedBlob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else throw new Error('Failed to create blob from canvas');
          }, 'image/png');
        });
        
        // Convert blob to array buffer
        const invertedBuffer = await invertedBlob.arrayBuffer();
        console.log(`     📦 Buffer created: ${invertedBuffer.byteLength} bytes`);
        
        // Save inverted image
        const fileName = `inverted-page-${(i + 1).toString().padStart(3, '0')}.png`;
        const invertedPath = `${outputDir}/${fileName}`;
        
        console.log(`     💾 Saving to: ${invertedPath}`);
        // Use IPC to save inverted file
        await window.electronAPI.saveImageFile(invertedPath, new Uint8Array(invertedBuffer));
        console.log(`     ✅ File saved successfully`);
        
        // Clean up
        URL.revokeObjectURL(imageUrl);
        
        invertedFiles.push(invertedPath);
        console.log(`   ✅ Inverted page ${i + 1}: ${invertedPath}`);
        
      } catch (error) {
        console.error(`   ❌ Failed to invert image ${i + 1}:`, error);
        console.error('   Error details:', error);
        // Create a placeholder name if inversion fails
        const fileName = `failed-invert-page-${(i + 1).toString().padStart(3, '0')}.png`;
        invertedFiles.push(`${outputDir}/${fileName}`);
      }
    }
    
    console.log(`✅ Successfully inverted ${invertedFiles.length} images`);
    return invertedFiles;
  }

  async createPdfFromImages(imageFiles: string[], outputDir: string): Promise<string> {
    console.log(`📄 Creating PDF from ${imageFiles.length} images...`);
    
    try {
      // Load pdf-lib
      const { PDFDocument } = await import('pdf-lib');
      
      // Create a new PDF document
      const pdfDoc = await PDFDocument.create();
      
      for (let i = 0; i < imageFiles.length; i++) {
        const imagePath = imageFiles[i];
        console.log(`   📄 Adding page ${i + 1}/${imageFiles.length}: ${imagePath}`);
        
        try {
          // Read the image file
          const response = await fetch(`file://${imagePath}`);
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status}`);
          }
          const imageBytes = await response.arrayBuffer();
          
          // Embed the image
          const image = await pdfDoc.embedPng(new Uint8Array(imageBytes));
          
          // Create a page with the same dimensions as the image
          const page = pdfDoc.addPage([image.width, image.height]);
          
          // Draw the image on the page
          page.drawImage(image, {
            x: 0,
            y: 0,
            width: image.width,
            height: image.height,
          });
          
          console.log(`   ✅ Added page ${i + 1}: ${image.width}x${image.height}`);
          
        } catch (error) {
          console.error(`   ❌ Failed to add page ${i + 1}:`, error);
          throw error;
        }
      }
      
      // Save the PDF
      console.log(`   💾 Saving PDF document...`);
      const pdfBytes = await pdfDoc.save();
      
      // Save PDF to output directory
      const pdfFileName = 'converted-document.pdf';
      const pdfPath = `${outputDir}/${pdfFileName}`;
      
      // Use IPC to save PDF file
      await window.electronAPI.saveImageFile(pdfPath, new Uint8Array(pdfBytes));
      
      console.log(`✅ Successfully created PDF: ${pdfPath}`);
      return pdfPath;
      
    } catch (error) {
      console.error('❌ PDF creation failed:', error);
      throw error;
    }
  }

  async renderPdfToImages(pdfData: number[], outputDir: string): Promise<{ files: string[], imageData: Uint8Array[] }> {
    console.log(`🖼️ Rendering PDF to images from data (${pdfData.length} bytes)`);
    
    try {
      // Load PDF.js
      const pdfjsLib = await import('pdfjs-dist');
      
      // Set up worker path (works for both dev and production)
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
      
      // Convert array back to Uint8Array
      const pdfUint8Array = new Uint8Array(pdfData);
      console.log(`📄 Converted to Uint8Array: ${pdfUint8Array.length} bytes`);
      
      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({ data: pdfUint8Array });
      const pdfDocument = await loadingTask.promise;
      
      console.log(`📄 PDF loaded - ${pdfDocument.numPages} pages`);
      
      // Limit to first 10 pages for testing to avoid timeout/memory issues
      const maxPages = Math.min(pdfDocument.numPages, 10);
      if (pdfDocument.numPages > 10) {
        console.log(`⚠️ Large PDF detected (${pdfDocument.numPages} pages), limiting to first ${maxPages} pages for testing`);
      }
      
      const imageFiles: string[] = [];
      const imageDataArray: Uint8Array[] = [];
      
      // Render each page
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        console.log(`   🖼️ Rendering page ${pageNum}/${maxPages}...`);
        
        const page = await pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 }); // 2x for quality
        
        // Create canvas using browser API
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (!context) {
          throw new Error(`Failed to get 2D context for page ${pageNum}`);
        }
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        // Render PDF page to canvas
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;
        
        // Convert to blob
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else throw new Error(`Failed to create blob for page ${pageNum}`);
          }, 'image/png');
        });
        
        // Convert blob to array buffer
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Save original to file using IPC
        const fileName = `page-${pageNum.toString().padStart(3, '0')}.png`;
        const filePath = `${outputDir}/${fileName}`;
        
        // Use IPC to save file in main process
        await window.electronAPI.saveImageFile(filePath, uint8Array);
        
        imageFiles.push(filePath);
        imageDataArray.push(uint8Array); // Keep image data for inversion
        console.log(`   ✅ Saved page ${pageNum}: ${filePath}`);
      }
      
      console.log(`✅ Successfully rendered ${imageFiles.length} pages`);
      return { files: imageFiles, imageData: imageDataArray };
      
    } catch (error) {
      console.error('❌ PDF rendering failed:', error);
      throw error;
    }
  }
}