export class PdfRendererService {
  async invertImageFiles(imageFiles: string[], outputDir: string): Promise<string[]> {
    console.log(`🔄 Inverting ${imageFiles.length} images using Canvas API (disk-based)...`);
    
    const invertedFiles: string[] = [];
    
    for (let i = 0; i < imageFiles.length; i++) {
      const originalFilePath = imageFiles[i];
      console.log(`   🔄 Inverting image ${i + 1}/${imageFiles.length}: ${originalFilePath}`);
      
      try {
        // Read image from disk using fetch
        const response = await fetch(`file://${originalFilePath}`);
        if (!response.ok) {
          throw new Error(`Failed to read image file: ${response.status}`);
        }
        
        const blob = await response.blob();
        console.log(`     📄 Read ${blob.size} bytes from disk`);
        
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
        
        // Convert canvas to blob with high-quality JPEG
        const invertedBlob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else throw new Error('Failed to create blob from canvas');
          }, 'image/jpeg', 0.95); // 95% quality to prevent artifacts
        });
        
        // Convert blob to array buffer
        const invertedBuffer = await invertedBlob.arrayBuffer();
        console.log(`     📦 Buffer created: ${invertedBuffer.byteLength} bytes`);
        
        // Save inverted image as JPEG for smaller file size
        const fileName = `inverted-page-${(i + 1).toString().padStart(3, '0')}.jpg`;
        const invertedPath = `${outputDir}/${fileName}`;
        
        console.log(`     💾 Saving to: ${invertedPath}`);
        // Use IPC to save inverted file
        await window.electronAPI.saveImageFile(invertedPath, new Uint8Array(invertedBuffer));
        console.log(`     ✅ File saved successfully`);
        
        // Clean up memory immediately
        URL.revokeObjectURL(imageUrl);
        canvas.width = 0;
        canvas.height = 0;
        
        invertedFiles.push(invertedPath);
        console.log(`   ✅ Inverted page ${i + 1}: ${invertedPath}`);
        
      } catch (error) {
        console.error(`   ❌ Failed to invert image ${i + 1}:`, error);
        console.error('   Error details:', error);
        // Create a placeholder name if inversion fails  
        const fileName = `failed-invert-page-${(i + 1).toString().padStart(3, '0')}.jpg`;
        invertedFiles.push(`${outputDir}/${fileName}`);
      }
    }
    
    console.log(`✅ Successfully inverted ${invertedFiles.length} images`);
    return invertedFiles;
  }

  async createPdfFromImages(imageFiles: string[], outputDir: string, customFileName?: string): Promise<string> {
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
          
          // Embed the image (JPEG format)
          const image = await pdfDoc.embedJpg(new Uint8Array(imageBytes));
          
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
      
      // Use custom filename if provided, otherwise generate default
      const pdfFileName = customFileName || 'converted-document_inverted.pdf';
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

  async renderPdfFromFile(pdfPath: string, outputDir: string): Promise<string[]> {
    console.log(`🖼️ Reading PDF file from: ${pdfPath}`);
    
    try {
      // Read PDF file from disk
      const response = await fetch(`file://${pdfPath}`);
      if (!response.ok) {
        throw new Error(`Failed to read PDF file: ${response.status}`);
      }
      
      const pdfBuffer = await response.arrayBuffer();
      const pdfUint8Array = new Uint8Array(pdfBuffer);
      console.log(`📄 PDF file loaded: ${pdfUint8Array.length} bytes`);
      
      // Use Uint8Array directly to avoid array length limits
      return this.renderPdfFromUint8Array(pdfUint8Array, outputDir);
    } catch (error) {
      console.error('❌ Failed to read PDF file:', error);
      throw error;
    }
  }

  async renderPdfFromUint8Array(pdfUint8Array: Uint8Array, outputDir: string): Promise<string[]> {
    console.log(`🖼️ Rendering PDF to images from Uint8Array (${pdfUint8Array.length} bytes)`);
    
    try {
      // Load PDF.js
      const pdfjsLib = await import('pdfjs-dist');
      
      // Set up worker path (works for both dev and production)
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
      
      console.log(`📄 Loading PDF document directly from Uint8Array: ${pdfUint8Array.length} bytes`);
      
      // Load PDF document directly from Uint8Array
      const loadingTask = pdfjsLib.getDocument({ data: pdfUint8Array });
      const pdfDocument = await loadingTask.promise;
      
      console.log(`📄 PDF loaded - ${pdfDocument.numPages} pages`);
      
      // Process all pages (no artificial limit)
      const maxPages = pdfDocument.numPages;
      console.log(`📄 Processing all ${maxPages} pages...`);
      
      const imageFiles: string[] = [];
      
      // Render each page (memory efficient - no storing in memory)
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        console.log(`   🖼️ Rendering page ${pageNum}/${maxPages}...`);
        
        const page = await pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 }); // 1.5x for good quality/size balance
        
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
        
        // Convert to blob with high-quality JPEG to avoid artifacts
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else throw new Error(`Failed to create blob for page ${pageNum}`);
          }, 'image/jpeg', 0.95); // 95% quality to prevent artifacts and flashing
        });
        
        // Convert blob to array buffer
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Save to file using IPC (immediately to disk, not in memory)  
        const fileName = `page-${pageNum.toString().padStart(3, '0')}.jpg`;
        const filePath = `${outputDir}/${fileName}`;
        
        // Use IPC to save file in main process
        await window.electronAPI.saveImageFile(filePath, uint8Array);
        
        imageFiles.push(filePath);
        console.log(`   ✅ Saved page ${pageNum}: ${filePath}`);
        
        // Clear canvas and context to free memory
        canvas.width = 0;
        canvas.height = 0;
      }
      
      console.log(`✅ Successfully rendered ${imageFiles.length} pages to disk`);
      return imageFiles;
      
    } catch (error) {
      console.error('❌ PDF rendering failed:', error);
      throw error;
    }
  }

  async renderPdfToImages(pdfData: number[], outputDir: string): Promise<string[]> {
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
      
      // Process all pages (no artificial limit)
      const maxPages = pdfDocument.numPages;
      console.log(`📄 Processing all ${maxPages} pages...`);
      
      const imageFiles: string[] = [];
      
      // Render each page (memory efficient - no storing in memory)
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        console.log(`   🖼️ Rendering page ${pageNum}/${maxPages}...`);
        
        const page = await pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 }); // 1.5x for good quality/size balance
        
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
        
        // Convert to blob with high-quality JPEG to avoid artifacts
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else throw new Error(`Failed to create blob for page ${pageNum}`);
          }, 'image/jpeg', 0.95); // 95% quality to prevent artifacts and flashing
        });
        
        // Convert blob to array buffer
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Save to file using IPC (immediately to disk, not in memory)  
        const fileName = `page-${pageNum.toString().padStart(3, '0')}.jpg`;
        const filePath = `${outputDir}/${fileName}`;
        
        // Use IPC to save file in main process
        await window.electronAPI.saveImageFile(filePath, uint8Array);
        
        imageFiles.push(filePath);
        console.log(`   ✅ Saved page ${pageNum}: ${filePath}`);
        
        // Clear canvas and context to free memory
        canvas.width = 0;
        canvas.height = 0;
      }
      
      console.log(`✅ Successfully rendered ${imageFiles.length} pages to disk`);
      return imageFiles;
      
    } catch (error) {
      console.error('❌ PDF rendering failed:', error);
      throw error;
    }
  }
}